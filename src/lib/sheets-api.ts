/**
 * Data API Client — Cloudflare KV 기반
 * 
 * Cloudflare Pages Functions (/api/data) 엔드포인트와 통신
 * E2EE (End-to-End Encryption) 및 Token 인증 추가
 */

import { encryptPayload, decryptPayload, getAuthToken } from '@/lib/crypto';

const API_BASE = 'https://portfolio-hchps.pages.dev/api/data';

function getAuthHeaders(): Record<string, string> {
  try {
    const token = getAuthToken();
    return { 'Authorization': `Bearer ${token}` };
  } catch {
    return {};
  }
}

// ============ Read ============

export async function readSheet<T>(sheetName: string): Promise<T[]> {
  try {
    const res = await fetch(`${API_BASE}?sheet=${encodeURIComponent(sheetName)}&_t=${Date.now()}`, {
      headers: { 
        ...getAuthHeaders(),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      cache: 'no-store'
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        // E2EE Decryption
        const decryptedPromises = json.data.map(async (row: any) => {
          if (row._enc) {
            try {
              const dec = await decryptPayload(row._enc);
              return { id: row.id, ...(dec as any) };
            } catch (e) {
              console.error('Decryption failed for row', row.id, e);
              return row; // Return base object if decryption fails
            }
          }
          return row; // Legacy plaintext fallback
        });
        return await Promise.all(decryptedPromises) as T[];
      }
    }
    return [];
  } catch (err) {
    console.warn(`데이터 읽기 실패 (오프라인 모드): ${sheetName}`, err);
    return [];
  }
}

// ============ Write ============

async function writeData(sheetName: string, action: string, data?: unknown, id?: string): Promise<boolean> {
  try {
    let payload = data;
    
    // E2EE Encryption
    if (data && typeof data === 'object') {
      if (Array.isArray(data)) {
        payload = await Promise.all(data.map(async (row) => {
          if (!row.id) return row;
          const { id, ...rest } = row;
          const _enc = await encryptPayload(rest);
          return { id, _enc };
        }));
      } else {
        const { id, ...rest } = data as any;
        if (id) {
          const _enc = await encryptPayload(rest);
          payload = { id, _enc };
        } else {
          // Fallback encryption without ID mapping if ID doesn't exist
          payload = { _enc: await encryptPayload(data) };
        }
      }
    }

    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ sheet: sheetName, action, data: payload, id }),
    });
    
    if (!res.ok) {
      throw new Error(`Cloudflare Data API returned ${res.status}`);
    }
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
