/**
 * Data API Client — Cloudflare KV 기반
 * 
 * Cloudflare Pages Functions (/api/data) 엔드포인트와 통신
 * 기존 Google Sheets API와 동일한 인터페이스 유지
 * localStorage는 캐시/폴백으로 유지
 */

// basePath에 맞게 API URL 구성
const API_BASE = '/PORTFOLIO-HCHPS/api/data';

// ============ Read ============

export async function readSheet<T>(sheetName: string): Promise<T[]> {
  try {
    const res = await fetch(`${API_BASE}?sheet=${encodeURIComponent(sheetName)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data as T[];
      }
    }
    return [];
  } catch {
    console.warn(`데이터 읽기 실패 (오프라인 모드): ${sheetName}`);
    return [];
  }
}

// ============ Write ============

async function writeData(sheetName: string, action: string, data?: unknown, id?: string): Promise<boolean> {
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheet: sheetName, action, data, id }),
    });
    const json = await res.json();
    return json.success === true;
  } catch (err) {
    console.error(`데이터 쓰기 실패 [${sheetName}/${action}]:`, err);
    return false;
  }
}

export async function addRow<T extends Record<string, unknown>>(sheetName: string, data: T): Promise<boolean> {
  return writeData(sheetName, 'add', data);
}

export async function updateRow(sheetName: string, id: string, data: Record<string, unknown>): Promise<boolean> {
  return writeData(sheetName, 'update', data, id);
}

export async function deleteRow(sheetName: string, id: string): Promise<boolean> {
  return writeData(sheetName, 'delete', undefined, id);
}

export async function replaceAll<T>(sheetName: string, data: T[]): Promise<boolean> {
  return writeData(sheetName, 'replace', data);
}

// ============ Config check ============

export function isGoogleSheetsConfigured(): boolean {
  return true; // Always "configured" since we use Cloudflare KV
}
