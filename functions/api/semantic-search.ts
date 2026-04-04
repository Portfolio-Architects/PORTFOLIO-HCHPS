interface Env {
  WIKI_VECTORS: any; // VectorizeIndex
  AI: any;
  API_KEY?: string;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  });
}

function authenticate(request: Request, env: Env): boolean {
  const configuredKey = env.API_KEY;
  if (!configuredKey) return true;
  const headerKey = request.headers.get('X-API-Key');
  return headerKey === configuredKey;
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
    const body = await context.request.json() as { query: string; limit?: number };
    if (!body || !body.query) {
      return jsonResponse({ success: false, error: 'Query is required' }, 400);
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

    return jsonResponse({ success: true, matches: results.matches });
  } catch (error: any) {
    return jsonResponse({ success: false, error: error.message || 'Internal AI Error' }, 500);
  }
};
