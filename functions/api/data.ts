/**
 * Cloudflare Pages Function — Data API
 * KV 기반 CRUD 엔드포인트 (API Key 인증)
 * 
 * GET  /api/data?sheet=TASKS         → 해당 시트 데이터 전체 읽기
 * POST /api/data { sheet, action, data, id } → add/update/delete/replace
 * 
 * 인증: X-API-Key 헤더 또는 ?key= 쿼리 파라미터
 */

interface Env {
  HCHPS_DATA: KVNamespace;
  API_KEY?: string; // Cloudflare Pages 환경변수로 설정
}

// 허용된 시트 이름 (CWE-20: 입력값 검증)
const ALLOWED_SHEETS = new Set([
  'TASKS', 'MEETINGS', 'PROJECTS',
  'BUDGET_CATEGORIES', 'BUDGET_ENTRIES',
  'INVENTORY', 'STOCK_CHANGES',
  'SIGNAL_LOG', 'KNOWLEDGE'
]);

function kvKey(sheet: string): string {
  return `sheet:${sheet}`;
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

// API Key 검증
function authenticate(request: Request, env: Env): boolean {
  const configuredKey = env.API_KEY;
  if (!configuredKey) return true; // 키 미설정 시 인증 스킵 (개발 환경)

  const headerKey = request.headers.get('X-API-Key');
  const url = new URL(request.url);
  const queryKey = url.searchParams.get('key');

  return headerKey === configuredKey || queryKey === configuredKey;
}

// 시트 이름 검증
function validateSheet(sheet: string): boolean {
  return ALLOWED_SHEETS.has(sheet);
}

// Handle CORS preflight
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    },
  });
};

// GET: Read all data for a sheet
export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!authenticate(context.request, context.env)) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  const url = new URL(context.request.url);
  const sheet = url.searchParams.get('sheet');

  if (!sheet) {
    return jsonResponse({ success: false, error: 'Missing sheet parameter' }, 400);
  }

  if (!validateSheet(sheet)) {
    return jsonResponse({ success: false, error: 'Invalid sheet name' }, 400);
  }

  try {
    const raw = await context.env.HCHPS_DATA.get(kvKey(sheet));
    const data = raw ? JSON.parse(raw) : [];
    return jsonResponse({ success: true, data });
  } catch {
    return jsonResponse({ success: false, error: 'Internal error' }, 500);
  }
};

// POST: Write data (add, update, delete, replace)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!authenticate(context.request, context.env)) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  try {
    const body = await context.request.json() as {
      sheet: string;
      action: string;
      data?: Record<string, unknown> | Record<string, unknown>[];
      id?: string;
    };

    const { sheet, action, data, id } = body;
    if (!sheet || !action) {
      return jsonResponse({ success: false, error: 'Missing sheet or action' }, 400);
    }

    if (!validateSheet(sheet)) {
      return jsonResponse({ success: false, error: 'Invalid sheet name' }, 400);
    }

    const key = kvKey(sheet);
    const raw = await context.env.HCHPS_DATA.get(key);
    let rows: Record<string, unknown>[] = raw ? JSON.parse(raw) : [];

    switch (action) {
      case 'add': {
        if (!data || Array.isArray(data)) {
          return jsonResponse({ success: false, error: 'Invalid data for add' }, 400);
        }
        rows.push(data);
        break;
      }

      case 'update': {
        if (!id || !data || Array.isArray(data)) {
          return jsonResponse({ success: false, error: 'Missing id or data for update' }, 400);
        }
        const idx = rows.findIndex(r => r.id === id);
        if (idx === -1) {
          return jsonResponse({ success: false, error: 'ID not found' }, 404);
        }
        rows[idx] = { ...rows[idx], ...data };
        break;
      }

      case 'delete': {
        if (!id) {
          return jsonResponse({ success: false, error: 'Missing id for delete' }, 400);
        }
        const before = rows.length;
        rows = rows.filter(r => r.id !== id);
        if (rows.length === before) {
          return jsonResponse({ success: false, error: 'ID not found' }, 404);
        }
        break;
      }

      case 'replace': {
        rows = Array.isArray(data) ? data : [];
        break;
      }

      default:
        return jsonResponse({ success: false, error: 'Unknown action' }, 400);
    }

    await context.env.HCHPS_DATA.put(key, JSON.stringify(rows));
    return jsonResponse({ success: true });

  } catch {
    return jsonResponse({ success: false, error: 'Internal error' }, 500);
  }
};
