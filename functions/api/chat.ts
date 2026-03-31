interface Env {
  API_KEY?: string; // Cloudflare Pages 환경변수
  AI: any; // Cloudflare AI Binding
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    },
  });
}

function authenticate(request: Request, env: Env): boolean {
  const configuredKey = env.API_KEY;
  if (!configuredKey) return true;

  const headerKey = request.headers.get('X-API-Key');
  const url = new URL(request.url);
  const queryKey = url.searchParams.get('key');

  return headerKey === configuredKey || queryKey === configuredKey;
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!authenticate(context.request, context.env)) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  try {
    const body = await context.request.json() as {
      messages: { role: string; content: string }[];
    };

    if (!body || !Array.isArray(body.messages)) {
      return jsonResponse({ success: false, error: 'Missing or invalid messages array' }, 400);
    }

    // Cloudflare Workers AI를 통해 최신 Llama 3 모델(Meta)을 호출
    const response = await context.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: body.messages,
    });

    return jsonResponse({ success: true, response: response.response });
  } catch (error: any) {
    return jsonResponse({ success: false, error: error.message || 'Internal AI Error' }, 500);
  }
};
