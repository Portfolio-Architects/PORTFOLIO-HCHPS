import { useMutation } from '@tanstack/react-query';

interface LlmExtractPayload {
  text?: string;
  fileName?: string;
}

interface LlmExtractResponse {
  success: boolean;
  data: {
    nodes: any[];
    edges: any[];
  };
}

export function useLlmExtract() {
  return useMutation<LlmExtractResponse, Error, LlmExtractPayload>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/llm/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to extract semantic graph');
      }
      return data;
    }
  });
}
