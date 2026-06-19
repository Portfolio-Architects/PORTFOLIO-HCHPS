import { useMutation } from '@tanstack/react-query';

interface SemanticSearchPayload {
  query: string;
  limit?: number;
}

export interface SemanticMatch {
  id: string;
  score: number;
  text: string;
  metadata?: any;
}

export function useSemanticSearch() {
  return useMutation({
    mutationFn: async (payload: SemanticSearchPayload) => {
      const apiBase = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
        ? '' : 'https://portfolio-hchps.pages.dev';

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const { getAuthToken } = await import('@/lib/crypto');
        headers['Authorization'] = `Bearer ${getAuthToken()}`;
      } catch {
        // ignore
      }

      const res = await fetch(`${apiBase}/api/semantic-search`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Vectorize search failed');
      }
      return data.matches as SemanticMatch[];
    }
  });
}
