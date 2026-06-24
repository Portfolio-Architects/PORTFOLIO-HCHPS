import { useMutation } from '@tanstack/react-query';

interface AILinkerPayload {
  sourceId: string;
  sourceLabel: string;
  targetId: string;
  targetLabel: string;
}

export interface AILinkerResponse {
  connected: boolean;
  type: string;
  summary: string;
}

export function useAILinker() {
  return useMutation<AILinkerResponse, Error, AILinkerPayload>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/ai-linker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze semantic relation');
      }
      return data;
    }
  });
}
