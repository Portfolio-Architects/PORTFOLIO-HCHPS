/**
 * Phase 8 Harness: Planner Agent
 * Decomposes complex user requests into smaller, actionable steps using Gemma 4 LLM.
 */
import { askLlama } from '@/lib/llm-client';

export async function createPlan(prompt: string): Promise<string[]> {
  const sysPrompt = `You are an AI Planner Agent. Decompose the following goal into a numbered list of 3-5 concise, actionable steps for a Generator Agent to execute.\n\nGoal: ${prompt}\n\nOutput only the steps as a JSON array of strings (e.g., ["Step 1", "Step 2"]). No markdown blocks.`;
  
  try {
    const response = await askLlama([{ role: 'user', content: sysPrompt }]);
    const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleanResponse);
  } catch (error) {
    console.error('[HARNESS] Planner Agent failed to call LLM:', error);
    // Fallback stub plan if parsing fails
    return [
      "Analyze current architecture context",
      "Generate necessary domain components",
      "Evaluate against constraints"
    ];
  }
}
