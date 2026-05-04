interface Env {
  WIKI_VECTORS: any; // VectorizeIndex
  AI: any;
  HCHPS_AUTH_TOKEN?: string;
}

function getCorsHeaders(request: Request): Record<string, string> {
  let allowedOrigin = 'https://portfolio-hchps.pages.dev';
  const origin = request.headers.get('Origin') || '';
  if (origin === 'http://localhost:3001' || origin === 'http://127.0.0.1:3001' || origin.startsWith('http://192.168.')) {
    allowedOrigin = origin;
  }
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  };
}

function jsonResponse(request: Request, data: unknown, status = 200): Response {
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
    return jsonResponse(context.request, { success: false, error: 'Unauthorized' }, 401);
  }

  // Security: Payload Size Limit (1MB) to prevent OOM
  const contentLength = parseInt(context.request.headers.get('Content-Length') || '0', 10);
  if (contentLength > 1048576) {
    return jsonResponse(context.request, { success: false, error: 'Payload Too Large' }, 413);
  }

  try {
    const body = await context.request.json() as { query: string; limit?: number };
    if (!body || !body.query) {
      return jsonResponse(context.request, { success: false, error: 'Query is required' }, 400);
    }

    // 1. Generate embedding for query using BAAI bge-m3
    const embeddingResponse = await context.env.AI.run('@cf/baai/bge-m3', {
      text: [body.query]
    });
    
    // bge-m3 returns shape: { shape: [1, 1024], data: [...] }
    const vector = embeddingResponse.data[0];

    // 2. Query Vectorize
    const results = await context.env.WIKI_VECTORS.query(vector, {
      topK: body.limit || 3,
      returnValues: true,
      returnMetadata: true
    });

    return jsonResponse(context.request, { success: true, matches: results.matches });
  } catch (error: any) {
    return jsonResponse(context.request, { success: false, error: error.message || 'Internal AI Error' }, 500);
  }
};
