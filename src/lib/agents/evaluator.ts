/**
 * Phase 8 Harness: Evaluator Agent
 * Evaluates generated code or payloads against Zod schemas and TypeScript constraints.
 */
import { z } from 'zod';

export async function evaluatePayload<T>(payload: unknown, schema: z.ZodSchema<T>): Promise<{ success: boolean; errors?: string; data?: T }> {
  const result = schema.safeParse(payload);
  if (!result.success) {
    // Loud Failure Signal - format for self-healing feedback
    const formattedErrors = result.error.errors.map(err => `Field [${err.path.join('.')}] - ${err.message}`).join('\n');
    const resolutionSuggestion = `The payload structure is invalid. Errors:\n${formattedErrors}\nPlease ensure your JSON keys match the exact path and types expected by the schema.`;
    
    return {
      success: false,
      errors: resolutionSuggestion
    };
  }
  return { success: true, data: result.data };
}
