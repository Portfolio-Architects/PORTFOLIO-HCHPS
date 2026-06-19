import { useMutation } from '@tanstack/react-query';

interface WikiSyncPayload {
  id: string;
  text: string;
}

export function useWikiSync() {
  return useMutation({
    mutationFn: async (payload: WikiSyncPayload) => {
      const isLocal = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
      if (isLocal) return;

      const apiBase = 'https://portfolio-hchps.pages.dev';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const { getAuthToken } = await import('@/lib/crypto');
        headers['Authorization'] = `Bearer ${getAuthToken()}`;
      } catch {
        // ignore
      }

      const res = await fetch(`${apiBase}/api/embeddings`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        throw new Error(`Embedding sync failed with status ${res.status}`);
      }
      return res.json();
    }
  });
}
