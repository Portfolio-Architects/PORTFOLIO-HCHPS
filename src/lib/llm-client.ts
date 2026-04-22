export async function askLlama(messages: { role: string; content: string }[]): Promise<string> {
  const apiBase = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    ? '' : 'https://portfolio-hchps.pages.dev';

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { getAuthToken } = await import('@/lib/crypto');
    headers['Authorization'] = `Bearer ${getAuthToken()}`;
  } catch (e) {
    // ignore
  }

  const res = await fetch(`${apiBase}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages, stream: false }),
  });

  if (!res.ok) {
    throw new Error(`LLM API failed: ${res.status}`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'LLM error');
  }

  return data.response;
}

export async function askLlamaStream(messages: { role: string; content: string }[], onChunk: (text: string) => void): Promise<void> {
  const apiBase = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    ? '' : 'https://portfolio-hchps.pages.dev';

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { getAuthToken } = await import('@/lib/crypto');
    headers['Authorization'] = `Bearer ${getAuthToken()}`;
  } catch (e) {
    // ignore
  }

  const res = await fetch(`${apiBase}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages, stream: true }),
  });

  if (!res.ok) {
    throw new Error(`LLM Stream API failed: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder('utf-8');
  let accumulated = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    accumulated += decoder.decode(value, { stream: true });
    
    // Server-sent events parsing
    const lines = accumulated.split('\n');
    accumulated = lines.pop() || ''; // Keep the incomplete line, if any

    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const data = JSON.parse(line.substring(6));
          if (data.response) {
            onChunk(data.response);
          }
        } catch (e) {
          // ignore incomplete json chunk parsing errors
        }
      }
    }
  }
}
