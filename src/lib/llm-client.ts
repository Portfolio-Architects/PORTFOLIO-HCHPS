export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  success: boolean;
  response?: string;
  error?: string;
}

/**
 * Cloudflare Workers AI (Llama 3) 엔드포인트를 호출하는 클라이언트 함수입니다.
 */
export async function askLlama(messages: ChatMessage[], apiKey?: string): Promise<string> {
  const isBrowser = typeof window !== 'undefined';
  const basePath = isBrowser && window.location.pathname.startsWith('/PORTFOLIO-HCHPS') 
    ? '/PORTFOLIO-HCHPS' 
    : '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  } else if (isBrowser) {
    // 로컬 스토리지에 저장된 API 키가 있다면 자동 포함 (기존 data.ts와 동일 인증)
    const stored = localStorage.getItem('hchps-api-key');
    if (stored) headers['X-API-Key'] = stored;
  }

  try {
    const res = await fetch(`${basePath}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages }),
    });

    if (!res.ok) {
      if (res.status === 404 && isBrowser && window.location.hostname === 'localhost') {
        // 로컬 next dev 환경이고 wrangler가 켜져 있지 않을 때의 테스트용 대체 응답
        console.warn('🚨 Local environment without Wrangler detected. Returning mock AI response.');
        return `[Mock AI Response]\n현재 로컬(Next.js 개발 서버) 환경이라 Cloudflare Workers AI 라우트에 접근할 수 없습니다.\nCloudflare 서버에 배포된 후 수 초 내외로 Llama 3 엔진이 연동되어 실시간 분석 응답을 반환하게 됩니다.\n\n(요청 분석량: ${messages.length}개 메시지 블록)`;
      }
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP Error ${res.status}`);
    }

    const data = await res.json() as ChatResponse;

    if (!data.success) {
      throw new Error(data.error || 'AI Response Failed');
    }

    return data.response || '';
  } catch (error: any) {
    console.error('LLM Inference Error:', error);
    throw error;
  }
}
