/**
 * Phase 8 Harness: Generator Agent
 * Synthesizes code, JSON payloads, or text based on the Planner's steps, with Self-Healing context.
 */
import { askLlama } from '@/lib/llm-client';

export async function generateContent(step: string, context: any, previousErrors?: string): Promise<string> {
  let prompt = `You are an AI Generator Agent. Your task is to execute the following step and output ONLY valid JSON.\n\nStep: ${step}\nContext: ${JSON.stringify(context)}`;
  
  if (previousErrors) {
    prompt += `\n\nCRITICAL ERROR FROM PREVIOUS ATTEMPT: Your previous output failed validation with the following errors:\n${previousErrors}\n\nPlease fix these errors in your new response. Output ONLY valid JSON, no markdown formatting blocks like \`\`\`json.`;
  } else {
    prompt += `\n\nOutput ONLY valid JSON, no markdown formatting blocks like \`\`\`json.`;
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
