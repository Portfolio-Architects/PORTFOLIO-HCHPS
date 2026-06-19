/**
 * Phase 8 Harness: Orchestrator Agent
 * Coordinates Planner, Generator, and Evaluator. Manages the Self-Healing Loop.
 */
import { createPlan } from './planner';
import { generateContent } from './generator';
import { evaluatePayload } from './evaluator';
import { z } from 'zod';

// PartyKit 서버에 에이전트 실시간 진행 상태 브로드캐스팅 헬퍼
async function broadcastAgentStatus(
  agentId: string,
  name: string,
  status: 'idle' | 'running' | 'success' | 'failed',
  step?: string,
  attempts?: number,
  maxAttempts?: number,
  feedback?: string
) {
  try {
    const payload = {
      type: 'agent-status',
      id: agentId,
      name,
      status,
      currentStep: step,
      attempts,
      maxAttempts,
      feedback,
      lastUpdated: new Date().toISOString()
    };
    
    const isProduction = process.env.NODE_ENV === 'production';
    const host = isProduction 
      ? 'https://hchps-party.portfolio-architects.partykit.dev' 
      : 'http://localhost:1999';

    if (typeof fetch === 'undefined') {
      // Node 환경 혹은 Jest 테스트 환경에서 fetch 폴리필이 없는 경우 방어막
      return;
    }

    await fetch(`${host}/parties/hchps-party/hchps-global`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    // 비동기 격리: 중계 실패가 에이전트 실행 흐름을 깰 수 없도록 안전 처리
    console.warn('[HARNESS Orchestrator] Broadcast status failed:', err);
  }
}

export async function executeTaskWithSelfHealing<T>(
  goal: string,
  context: any,
  schema: z.ZodSchema<T>,
  maxRetries: number = 3
): Promise<{ success: boolean; data?: T; attempts: number; finalError?: string }> {
  console.log('[HARNESS Orchestrator] Starting task:', goal);
  
  // 상태 초기화 브로드캐스트
  await broadcastAgentStatus('planner', 'Planner', 'running', 'Decomposing goals...', 1, maxRetries);
  await broadcastAgentStatus('generator', 'Generator', 'idle', undefined, 0, maxRetries);
  await broadcastAgentStatus('evaluator', 'Evaluator', 'idle', undefined, 0, maxRetries);

  // Step 1: Plan
  const plan = await createPlan(goal);
  console.log('[HARNESS Orchestrator] Plan generated:', plan);
  await broadcastAgentStatus('planner', 'Planner', 'success', `Plan created: ${plan.length} steps.`);
  
  const fullInstructions = `Goal: ${goal}\nPlan:\n${plan.join('\n')}`;
  
  let currentAttempt = 1;
  let lastErrors = '';

  while (currentAttempt <= maxRetries) {
    console.log(`[HARNESS Orchestrator] Attempt ${currentAttempt}/${maxRetries}...`);
    
    try {
      // Step 2: Generate (with previous error context if any)
      await broadcastAgentStatus('generator', 'Generator', 'running', `Generating JSON payload (Step 2)`, currentAttempt, maxRetries);
      const rawOutput = await generateContent(fullInstructions, context, lastErrors ? lastErrors : undefined);
      
      let parsedPayload: unknown;
      try {
        parsedPayload = JSON.parse(rawOutput);
      } catch (parseError: any) {
        lastErrors = `JSON Parsing Failed. Output must be strictly valid JSON. Error: ${parseError.message}\nRaw Output was:\n${rawOutput}`;
        await broadcastAgentStatus('generator', 'Generator', 'failed', 'JSON parsing failed. Retrying...', currentAttempt, maxRetries, lastErrors);
        currentAttempt++;
        continue;
      }

      // Step 3: Evaluate
      await broadcastAgentStatus('evaluator', 'Evaluator', 'running', 'Validating payload against Zod schema (Step 3)', currentAttempt, maxRetries);
      const evaluation = await evaluatePayload(parsedPayload, schema);
      
      if (evaluation.success) {
        console.log(`[HARNESS Orchestrator] Success on attempt ${currentAttempt}!`);
        await broadcastAgentStatus('generator', 'Generator', 'success', 'Valid structure generated.', currentAttempt, maxRetries);
        await broadcastAgentStatus('evaluator', 'Evaluator', 'success', 'Zod schema validation passed.', currentAttempt, maxRetries);
        return { success: true, data: evaluation.data, attempts: currentAttempt };
      } else {
        console.warn(`[HARNESS Orchestrator] Evaluator rejected payload on attempt ${currentAttempt}. Feedback loop initiated.`);
        lastErrors = evaluation.errors || 'Unknown validation error';
        await broadcastAgentStatus('evaluator', 'Evaluator', 'failed', 'Zod validation rejected.', currentAttempt, maxRetries, lastErrors);
        await broadcastAgentStatus('generator', 'Generator', 'failed', 'Regenerating with Zod feedback...', currentAttempt, maxRetries, lastErrors);
        currentAttempt++;
      }
      
    } catch (error: any) {
      console.error('[HARNESS Orchestrator] Unhandled error in loop:', error);
      lastErrors = `Fatal Generator Error: ${error.message}`;
      await broadcastAgentStatus('generator', 'Generator', 'failed', `Fatal error: ${error.message}`, currentAttempt, maxRetries, lastErrors);
      currentAttempt++;
    }
  }

  console.error('[HARNESS Orchestrator] Max retries reached. Self-healing failed.');
  await broadcastAgentStatus('generator', 'Generator', 'failed', 'Max attempts reached. Task failed.', maxRetries, maxRetries, lastErrors);
  await broadcastAgentStatus('evaluator', 'Evaluator', 'failed', 'Self-healing failed to converge.', maxRetries, maxRetries, lastErrors);
  return { success: false, attempts: maxRetries, finalError: lastErrors };
}
