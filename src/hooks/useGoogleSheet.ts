'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { readSheet, addRow, updateRow, deleteRow } from '@/lib/sheets-api';

/**
 * useGoogleSheet — Google Sheets 기반 상태 관리 훅
 * useLocalStorage를 대체하며, 동일한 인터페이스 제공
 * 
 * - 초기 로드: Google Sheets에서 데이터 읽기 (실패 시 localStorage 폴백)
 * - 쓰기: 로컬 state 즉시 반영 (낙관적 업데이트) + 백그라운드 시트 저장
 * - localStorage는 캐시/폴백으로 유지
 */
export function useGoogleSheet<T extends { id: string }>(
  sheetName: string,
  localStorageKey: string,
  initialValue: T[] = []
): [T[], React.Dispatch<React.SetStateAction<T[]>>, boolean] {
  const [data, setData] = useState<T[]>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const stored = localStorage.getItem(localStorageKey);
      return stored ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);

  // Initial load from Google Sheets
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    readSheet<T>(sheetName)
      .then(rows => {
        if (rows.length > 0) {
          setData(rows);
          // Cache in localStorage
          try { localStorage.setItem(localStorageKey, JSON.stringify(rows)); } catch { /* ignore */ }
        }
      })
      .catch(() => {
        // Silently fall back to localStorage data
      })
      .finally(() => setLoading(false));
  }, [sheetName, localStorageKey]);

  // Sync to localStorage on change
  useEffect(() => {
    try { localStorage.setItem(localStorageKey, JSON.stringify(data)); } catch { /* ignore */ }
  }, [data, localStorageKey]);

  return [data, setData, loading];
}

/**
 * Sheet CRUD helpers — 낙관적 업데이트 + 백그라운드 동기화
 */
export function useSheetCrud<T extends { id: string }>(sheetName: string) {
  const syncAdd = useCallback(async (item: T) => {
    const plain = JSON.parse(JSON.stringify(item));
    await addRow(sheetName, plain);
  }, [sheetName]);

  const syncUpdate = useCallback(async (id: string, updates: Partial<T>) => {
    const plain = JSON.parse(JSON.stringify(updates));
    await updateRow(sheetName, id, plain);
  }, [sheetName]);

  const syncDelete = useCallback(async (id: string) => {
    await deleteRow(sheetName, id);
  }, [sheetName]);

  return { syncAdd, syncUpdate, syncDelete };
}
