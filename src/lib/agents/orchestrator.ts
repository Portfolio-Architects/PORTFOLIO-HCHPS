/**
 * Phase 8 Harness: Orchestrator Agent
 * Coordinates Planner, Generator, and Evaluator. Manages the Self-Healing Loop.
 */
import { createPlan } from './planner';
import { generateContent } from './generator';
import { evaluatePayload } from './evaluator';
import { z } from 'zod';

export async function executeTaskWithSelfHealing<T>(
  goal: string,
  context: any,
  schema: z.ZodSchema<T>,
  maxRetries: number = 3
): Promise<{ success: boolean; data?: T; attempts: number; finalError?: string }> {
  console.log('[HARNESS Orchestrator] Starting task:', goal);
  
  // Step 1: Plan
  const plan = await createPlan(goal);
  console.log('[HARNESS Orchestrator] Plan generated:', plan);
  
  const fullInstructions = `Goal: ${goal}\nPlan:\n${plan.join('\n')}`;
  
  let currentAttempt = 1;
  let lastErrors = '';

  while (currentAttempt <= maxRetries) {
    console.log(`[HARNESS Orchestrator] Attempt ${currentAttempt}/${maxRetries}...`);
    
    try {
      // Step 2: Generate (with previous error context if any)
      const rawOutput = await generateContent(fullInstructions, context, lastErrors ? lastErrors : undefined);
      
      let parsedPayload: unknown;
      try {
        parsedPayload = JSON.parse(rawOutput);
      } catch (parseError: any) {
        lastErrors = `JSON Parsing Failed. Output must be strictly valid JSON. Error: ${parseError.message}\nRaw Output was:\n${rawOutput}`;
        currentAttempt++;
        continue;
      }

      // Step 3: Evaluate
      const evaluation = await evaluatePayload(parsedPayload, schema);
      
      if (evaluation.success) {
        console.log(`[HARNESS Orchestrator] Success on attempt ${currentAttempt}!`);
        return { success: true, data: evaluation.data, attempts: currentAttempt };
      } else {
        console.warn(`[HARNESS Orchestrator] Evaluator rejected payload on attempt ${currentAttempt}. Feedback loop initiated.`);
        lastErrors = evaluation.errors || 'Unknown validation error';
        currentAttempt++;
      }
      
    } catch (error: any) {
      console.error('[HARNESS Orchestrator] Unhandled error in loop:', error);
      lastErrors = `Fatal Generator Error: ${error.message}`;
      currentAttempt++;
    }
  }

  console.error('[HARNESS Orchestrator] Max retries reached. Self-healing failed.');
  return { success: false, attempts: maxRetries, finalError: lastErrors };
}
