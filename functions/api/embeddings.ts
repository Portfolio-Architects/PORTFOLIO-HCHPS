interface Env {
  WIKI_VECTORS: any;
  AI: any;
  HCHPS_AUTH_TOKEN?: string;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
  } else {
    const url = new URL(request.url);
    token = url.searchParams.get('token');
  }

  return !!token && token === configuredKey;
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!authenticate(context.request, context.env)) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  try {
    const body = await context.request.json() as { id: string; text: string; metadata?: any };
    if (!body || !body.id || !body.text) {
      return jsonResponse({ success: false, error: 'id and text are required' }, 400);
    }

    // Embed the text
    const embeddingResponse = await context.env.AI.run('@cf/baai/bge-m3', {
      text: [body.text]
    });
    
    const vector = embeddingResponse.data[0];

    // Upsert into Vectorize
    const results = await context.env.WIKI_VECTORS.upsert([{
      id: body.id,
      values: vector,
      metadata: body.metadata || { text: body.text } // optionally store the raw text in metadata for RAG retrieval
    }]);

    return jsonResponse({ success: true, count: results.count });
  } catch (error: any) {
    return jsonResponse({ success: false, error: error.message || 'Internal AI Error' }, 500);
  }
};
