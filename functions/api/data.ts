/**
 * Cloudflare Pages Function — Data API
 * KV 기반 CRUD 엔드포인트
 * 
 * GET  /api/data?sheet=TASKS         → 해당 시트 데이터 전체 읽기
 * POST /api/data { sheet, action, data, id } → add/update/delete/replace
 */

interface Env {
  HCHPS_DATA: KVNamespace;
}

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
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// Handle CORS preflight
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};

// GET: Read all data for a sheet
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const sheet = url.searchParams.get('sheet');

  if (!sheet) {
    return jsonResponse({ success: false, error: 'Missing sheet parameter' }, 400);
  }

  try {
    const raw = await context.env.HCHPS_DATA.get(kvKey(sheet));
    const data = raw ? JSON.parse(raw) : [];
    return jsonResponse({ success: true, data });
  } catch (err) {
    return jsonResponse({ success: false, error: String(err) }, 500);
  }
};

// POST: Write data (add, update, delete, replace)
export const onRequestPost: PagesFunction<Env> = async (context) => {
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
          return jsonResponse({ success: false, error: `ID not found: ${id}` }, 404);
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
          return jsonResponse({ success: false, error: `ID not found: ${id}` }, 404);
        }
        break;
      }

      case 'replace': {
        rows = Array.isArray(data) ? data : [];
        break;
      }

      default:
        return jsonResponse({ success: false, error: `Unknown action: ${action}` }, 400);
    }

    await context.env.HCHPS_DATA.put(key, JSON.stringify(rows));
    return jsonResponse({ success: true });

  } catch (err) {
    return jsonResponse({ success: false, error: String(err) }, 500);
  }
};
