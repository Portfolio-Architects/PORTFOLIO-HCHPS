/**
 * localStorage → Cloudflare KV 마이그레이션 유틸리티
 * 브라우저에서 한 번 실행하면 localStorage의 모든 데이터를 KV로 업로드
 */

import { replaceAll } from './sheets-api';

const STORAGE_KEYS: Record<string, string> = {
  'hchps-tasks': 'TASKS',
  'hchps-meetings': 'MEETINGS',
  'hchps-projects': 'PROJECTS',
  'hchps-budget-categories': 'BUDGET_CATEGORIES',
  'hchps-budget-entries': 'BUDGET_ENTRIES',
  'hchps-inventory': 'INVENTORY',
  'hchps-stock-changes': 'STOCK_CHANGES',
  'hchps-signal-log': 'SIGNAL_LOG',
};

export async function migrateLocalStorageToKV(): Promise<{ migrated: string[]; skipped: string[]; errors: string[] }> {
  const migrated: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  for (const [localKey, sheetName] of Object.entries(STORAGE_KEYS)) {
    try {
      const raw = localStorage.getItem(localKey);
      if (!raw) {
        skipped.push(`${sheetName}: no local data`);
        continue;
      }

      const data = JSON.parse(raw);
      if (!Array.isArray(data) || data.length === 0) {
        skipped.push(`${sheetName}: empty`);
        continue;
      }

      const success = await replaceAll(sheetName, data);
      if (success) {
        migrated.push(`${sheetName}: ${data.length} items`);
      } else {
        errors.push(`${sheetName}: upload failed`);
      }
    } catch (err) {
      errors.push(`${sheetName}: ${err}`);
    }
  }

  return { migrated, skipped, errors };
}
