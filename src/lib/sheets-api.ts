/**
 * Google Sheets API — Read & Write Utility
 * CSV 공개 URL로 읽기, Apps Script Web App으로 쓰기
 */

const SPREADSHEET_ID = '1Ktm5PDYOHm4r5te1vnPC5gcAoIuRFxM5w5X5mSF6DGE';

// ⚠️ Apps Script Web App 배포 후 이 URL을 업데이트하세요
const APPS_SCRIPT_URL = '';

// ============ Read: CSV export ============

function csvToRows(csv: string): string[][] {
  const lines = csv.split('\n').filter(l => l.trim().length > 0);
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  });
}

export async function readSheet<T>(sheetName: string): Promise<T[]> {
  // Try Apps Script first (more reliable, returns JSON)
  if (APPS_SCRIPT_URL) {
    try {
      const res = await fetch(`${APPS_SCRIPT_URL}?action=read&sheet=${encodeURIComponent(sheetName)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data as T[];
        }
      }
    } catch {
      console.warn(`Apps Script 읽기 실패, CSV 폴백 시도: ${sheetName}`);
    }
  }

  // Fallback: CSV public URL
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const csv = await res.text();
    const rows = csvToRows(csv);
    if (rows.length < 2) return [];

    const headers = rows[0];
    return rows.slice(1).map(row => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        let val: unknown = row[i] || '';
        // Parse JSON strings
        if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
          try { val = JSON.parse(val); } catch { /* keep string */ }
        }
        // Number conversion
        if (typeof val === 'string' && /^\d+$/.test(val) && !h.toLowerCase().includes('id') && !h.includes('date') && !h.includes('At')) {
          val = parseInt(val, 10);
        }
        // Boolean
        if (val === 'TRUE' || val === 'true') val = true;
        if (val === 'FALSE' || val === 'false') val = false;
        obj[h] = val;
      });
      return obj as T;
    });
  } catch {
    return [];
  }
}

// ============ Write: Apps Script Web App ============

async function writeToSheet(sheetName: string, action: string, data?: unknown, id?: string): Promise<boolean> {
  if (!APPS_SCRIPT_URL) {
    console.warn('Apps Script URL이 설정되지 않았습니다. src/lib/sheets-api.ts의 APPS_SCRIPT_URL을 업데이트하세요.');
    return false;
  }

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // Apps Script requires text/plain for CORS
      body: JSON.stringify({ sheet: sheetName, action, data, id }),
    });
    const json = await res.json();
    return json.success === true;
  } catch (err) {
    console.error(`Sheets 쓰기 실패 [${sheetName}/${action}]:`, err);
    return false;
  }
}

export async function addRow<T extends Record<string, unknown>>(sheetName: string, data: T): Promise<boolean> {
  return writeToSheet(sheetName, 'add', data);
}

export async function updateRow(sheetName: string, id: string, data: Record<string, unknown>): Promise<boolean> {
  return writeToSheet(sheetName, 'update', data, id);
}

export async function deleteRow(sheetName: string, id: string): Promise<boolean> {
  return writeToSheet(sheetName, 'delete', undefined, id);
}

export async function replaceAll<T>(sheetName: string, data: T[]): Promise<boolean> {
  return writeToSheet(sheetName, 'replace', data);
}

// ============ Config check ============

export function isGoogleSheetsConfigured(): boolean {
  return APPS_SCRIPT_URL.length > 0;
}
