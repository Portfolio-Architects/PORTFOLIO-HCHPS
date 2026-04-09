export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  success: boolean;
  response?: string;
  error?: string;
}

const getApiBaseUrl = () => {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return ''; 
  }
  return 'https://portfolio-hchps.pages.dev';
};

/**
 * Cloudflare Workers AI (Llama 3) 엔드포인트를 호출하는 클라이언트 함수입니다.
 * onChunk 콜백이 제공되면 SSE 형태의 실시간 스트림 출력을 수행합니다.
 */
export async function askLlama(
  messages: ChatMessage[], 
  apiKey?: string, 
  onChunk?: (chunk: string) => void
): Promise<string> {
  const isBrowser = typeof window !== 'undefined';
  const apiBase = getApiBaseUrl();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  } else if (isBrowser) {
    const stored = localStorage.getItem('hchps-api-key');
    if (stored) headers['X-API-Key'] = stored;
  }

  try {
    // 1. Hybrid Edge LLM (Local Ollama) Fallback
    if (isBrowser) {
      try {
        const edgeModel = localStorage.getItem('hchps-local-model') || 'gemma';
        // short timeout for detection
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2초 뒤 포기
        
        const edgeRes = await fetch('http://127.0.0.1:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: edgeModel, messages, stream: !!onChunk }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (edgeRes.ok) {
          console.log(`[Hybrid LLM] Connected to Local Edge LLM (${edgeModel})`);
          
          if (!onChunk) {
            const data = await edgeRes.json();
            return data.message?.content || '';
          }

          const reader = edgeRes.body?.getReader();
          if (!reader) throw new Error('No readable stream');
          const decoder = new TextDecoder();
          let fullContent = '';
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunkStr = decoder.decode(value, { stream: true });
            const lines = chunkStr.split('\n').filter(Boolean);
            for (const line of lines) {
              try {
                const data = JSON.parse(line);
                if (data.message?.content) {
                  fullContent += data.message.content;
                  onChunk(data.message.content);
                }
              } catch(e) {} // ignore incomplete JSON
            }
          }
          return fullContent;
        }
      } catch (err) {
        // Local Edge Server not found (CORS, Refused, Timeout) => Fallback
        console.log('[Hybrid LLM] Local Edge LLM not detected. Falling back to Cloudflare...');
      }
    }

    // 2. Cloudflare Workers AI Fallback
    const res = await fetch(`${apiBase}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages, stream: !!onChunk }),
    });

    if (!res.ok) {
      if ((res.status === 404 || res.status === 500) && isBrowser && window.location.hostname === 'localhost') {
        console.warn('🚨 Local environment without Wrangler detected. Returning mock AI response.');
        const mockResponse = `[Mock AI Response]\n현재 로컬(Next.js 개발 서버) 환경이라 Cloudflare Workers AI 라우트에 접근할 수 없거나 오프라인입니다.\nCloudflare 서버에 배포된 후에는 Llama 3 엔진이 연동되어 실시간 분석 응답을 반환하게 됩니다.\n\n(요청 분석량: ${messages.length}개 메시지 블록)`;
        if (onChunk) {
          // 모의 환경에서도 스트리밍처럼 약간의 의도적인 지연을 주고 동작
          for (const char of mockResponse.split('')) {
            onChunk(char);
          }
          return mockResponse;
        }
        return mockResponse;
      }
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP Error ${res.status}`);
    }

    // 스트리밍을 요청하지 않았을 경우 (Fallback)
    if (!onChunk) {
      const data = await res.json() as ChatResponse;
      if (!data.success) {
        throw new Error(data.error || 'AI Response Failed');
      }
      return data.response || '';
    }

    // 스트리밍 모드 처리 로직 
    if (!res.body) {
      throw new Error('ReadableStream not supported by response');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // 맨 마지막 문장은 잘린 형태일 수 있으므로 버퍼에 보존
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === 'data: [DONE]') continue;
        if (line.startsWith('data: ')) {
          try {
            const dataStr = line.replace('data: ', '').trim();
            if (!dataStr) continue;
            
            const chunkObj = JSON.parse(dataStr);
            if (chunkObj.response) {
              fullContent += chunkObj.response;
              onChunk(chunkObj.response); // 점진적으로 UI에 발행
            }
          } catch (e) {
            console.error('SSE JSON Parsing Error on line:', line, e);
            // 불완전한 JSON 청크는 무시하고 계속 스트림을 수신
          }
        }
      }
    }
    
    return fullContent;
  } catch (error: any) {
    console.error('LLM Inference Error:', error);
    throw error;
  }
}

