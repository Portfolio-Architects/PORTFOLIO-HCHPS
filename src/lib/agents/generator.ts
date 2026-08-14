/**
 * Phase 8 Harness: Generator Agent
 * Synthesizes code, JSON payloads, or text based on the Planner's steps, with Self-Healing context.
 */
import { askLlama } from '@/lib/llm-client';

function serializeContext(context: any): string {
  if (context === undefined || context === null) return 'null';
  if (typeof context !== 'object') return String(context);
  return JSON.stringify(context, (k, v) => (Array.isArray(v) && v.length > 10 ? v.slice(0, 10) : v));
}

export async function generateContent(step: string, context: any, previousErrors?: string): Promise<string> {
  const cleanContext = serializeContext(context);
  let prompt = `Execute step & output ONLY valid JSON.\nStep: ${step}\nContext: ${cleanContext}`;
  
  if (previousErrors) {
    prompt += `\nFIX ERRORS FROM PREVIOUS ATTEMPT:\n${previousErrors}`;
  }

  try {
    const response = await askLlama([{ role: 'user', content: prompt }]);
    // clean up any markdown blocks if the model ignored the instruction
    return response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  } catch (error) {
    console.error('[HARNESS] Generator Agent failed to call LLM:', error);
    throw error;
  }
}
