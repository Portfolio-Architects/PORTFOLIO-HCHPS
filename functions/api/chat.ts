interface Env {
  HCHPS_AUTH_TOKEN?: string; // Cloudflare Pages 환경변수
  AI: any; // Cloudflare AI Binding
}

function getCorsHeaders(request?: Request): Record<string, string> {
  let allowedOrigin = 'https://portfolio-hchps.pages.dev';
  if (request) {
    const origin = request.headers.get('Origin') || '';
    if (origin === 'http://localhost:3001' || origin === 'http://127.0.0.1:3001' || origin.startsWith('http://192.168.') || origin === 'https://portfolio-architects.github.io') {
      allowedOrigin = origin;
    }
  }
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  };
}

function jsonResponse(data: unknown, status = 200, request?: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(request)
    },
  });
}

function authenticate(request: Request, env: Env): boolean {
  const configuredKey = env.HCHPS_AUTH_TOKEN;
  if (!configuredKey) {
    console.error("CRITICAL SECURITY WARN: HCHPS_AUTH_TOKEN is missing in environment variables.");
    return false;
  }

  let token = null;
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  return !!token && token === configuredKey;
}

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, {
    headers: getCorsHeaders(context.request),
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!authenticate(context.request, context.env)) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, context.request);
  }

  // Security: Payload Size Limit (1MB) to prevent OOM
  const contentLength = parseInt(context.request.headers.get('Content-Length') || '0', 10);
  if (contentLength > 1048576) {
    return jsonResponse({ success: false, error: 'Payload Too Large' }, 413, context.request);
  }

  try {
    const body = await context.request.json() as {
      messages: { role: string; content: string }[];
      stream?: boolean;
    };

    if (!body || !Array.isArray(body.messages)) {
      return jsonResponse({ success: false, error: 'Missing or invalid messages array' }, 400, context.request);
    }

    // Security: Validate message lengths
    for (const msg of body.messages) {
      if (typeof msg.content !== 'string' || msg.content.length > 5000) {
         return jsonResponse({ success: false, error: 'Message content exceeds maximum allowed length' }, 400, context.request);
      }
    }

    // Cloudflare Workers AI - Request stream if specified
    let response;
    try {
      response = await context.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: body.messages,
        stream: body.stream === true
      });
    } catch (primaryError) {
      console.warn('[AI] Primary model unavailable, falling back to secondary...', primaryError);
      try {
        response = await context.env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: body.messages,
          stream: body.stream === true
        });
      } catch (fallbackError) {
        throw new Error('클라우드 AI 서버가 현재 일시적으로 혼잡합니다 (과부하). 약 1~2분 뒤 다시 시도해주세요.');
      }
    }

    if (body.stream) {
      // Return the ReadableStream directly with SSE headers
      return new Response(response, {
        headers: {
          'Content-Type': 'text/event-stream',
          ...getCorsHeaders(context.request)
        }
      });
    }

    // Fallback to legacy full JSON response if not streaming
    return jsonResponse({ success: true, response: response.response }, 200, context.request);
  } catch (error: any) {
    return jsonResponse({ success: false, error: error.message || 'Internal AI Error' }, 500, context.request);
  }
};
