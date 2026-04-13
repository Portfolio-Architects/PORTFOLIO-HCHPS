/**
 * Data API Client — Cloudflare KV 기반
 * 
 * Cloudflare Pages Functions (/api/data) 엔드포인트와 통신
 * E2EE (End-to-End Encryption) 및 Token 인증 추가
 */

import { encryptPayload, decryptPayload, getAuthToken } from '@/lib/crypto';
import { getDomainSchema } from '@/lib/schemas';

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

/**
 * 지정된 시트(혹은 KV 저장소 슬롯)에서 데이터를 읽어와 복호화(Decryption) 후 반환합니다.
 * 
 * @typeParam T - 반환할 데이터 행(row)의 타입
 * @param sheetName - 읽어올 대상 시트 이름 (예: 'budgets', 'tasks')
 * @returns 복호화 처리된 데이터 배열. 실패하거나 오프라인 모드일 경우 빈 배열(`[]`)을 반환합니다.
 * 
 * @remarks
 * 백엔드 단에서 평문으로 반환된 데이터 중 `_enc` 해시 필드가 있는 항목들은 `decryptPayload`를 통해 
 * 클라이언트 단에서 복호화됩니다. 세션 토큰(`sessionAuthToken`) 인증 헤더를 동반합니다.
 */
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
        const rawRows = await Promise.all(decryptedPromises);
        
        // Zod Runtimes Validation (Fail-Safe)
        const schema = getDomainSchema(sheetName);
        const validRows: any[] = [];
        for (const row of rawRows) {
          if ('safeParse' in schema) {
            const result = schema.safeParse(row);
            if (result.success) {
              validRows.push(result.data);
            } else {
              console.warn(`[Zod Error] Corrupted data suppressed in sheet ${sheetName}:`, result.error.errors, 'Row:', row.id);
            }
          } else {
            validRows.push(row);
          }
        }
        return validRows as T[];
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

/**
 * 새 행(Row)을 저장소에 추가(Add)합니다.
 * 백그라운드 로직에 의해 E2EE 암호화된 `_enc` 페이로드로 치환되어 서버에 전송됩니다.
 * 
 * @param sheetName - 저장할 대상 시트 이름
 * @param data - 저장할 원본 객체 (암호화 전)
 * @returns 성공 여부 (true/false)
 */
export async function addRow<T extends Record<string, unknown>>(sheetName: string, data: T): Promise<boolean> {
  return writeData(sheetName, 'add', data);
}

/**
 * 특정 ID의 행(Row) 데이터를 통째로 변경(Update)합니다.
 * 
 * @param sheetName - 저장할 대상 시트 이름
 * @param id - 변경할 대상의 고유 ID 식별자
 * @param data - 변경할 내용의 객체 (재암호화 수행됨)
 * @returns 성공 여부 (true/false)
 */
export async function updateRow(sheetName: string, id: string, data: Record<string, unknown>): Promise<boolean> {
  return writeData(sheetName, 'update', data, id);
}

/**
 * 특정 ID의 행(Row) 데이터를 삭제(Delete)합니다.
 * 
 * @param sheetName - 삭제를 수행할 시트 이름
 * @param id - 삭제 대상 식별자 ID
 * @returns 성공 여부 (true/false)
 */
export async function deleteRow(sheetName: string, id: string): Promise<boolean> {
  return writeData(sheetName, 'delete', undefined, id);
}

/**
 * 저장소의 전체 데이터를 덮어씁니다(Replace All). 동기화 및 마이그레이션 백업 재조립용입니다.
 * 
 * @param sheetName - 대상 시트 이름
 * @param data - 새롭게 완전히 대체할 배열 (각 요소 모두 일괄 암호화 대상)
 * @returns 성공 여부 (true/false)
 */
export async function replaceAll<T>(sheetName: string, data: T[]): Promise<boolean> {
  return writeData(sheetName, 'replace', data);
}

// ============ Config check ============

export function isGoogleSheetsConfigured(): boolean {
  return true; // Always "configured" since we use Cloudflare KV
}
