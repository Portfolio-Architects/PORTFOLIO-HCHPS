/**
 * Phase 8 Harness: Planner Agent
 * Decomposes complex user requests into smaller, actionable steps using Gemma 4 LLM.
 */
import { askLlama } from '@/lib/llm-client';

export async function createPlan(prompt: string): Promise<string[]> {
  const sysPrompt = `Decompose goal into 3-5 concise step strings. Output JSON array only: ["Step 1", "Step 2"].\nGoal: ${prompt}`;
  
  try {
    const response = await askLlama([{ role: 'user', content: sysPrompt }]);
    const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanResponse);
    return Array.isArray(parsed) ? parsed.map(String) : [
      "Analyze current architecture context",
      "Generate necessary domain components",
      "Evaluate against constraints"
    ];
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
