'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { readSheet, addRow, deleteRow } from '@/lib/sheets-api';

export interface SignalEntry {
  id: string;
  text: string;
  keywords: string[];
  createdAt: string;
}

const STORAGE_KEY = 'hchps-signal-log';
const SHEET_NAME = 'SIGNAL_LOG';

function extractKeywords(text: string): string[] {
  // Remove common particles/josa and extract meaningful words
  const cleaned = text
    .replace(/[.,!?~…·\-()[\]{}'\"``""'']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const stopWords = new Set([
    '이', '가', '은', '는', '을', '를', '의', '에', '에서', '으로', '로',
    '와', '과', '도', '만', '까지', '부터', '에게', '한테', '께',
    '하다', '되다', '있다', '없다', '이다', '아니다',
    '그', '저', '이', '그것', '저것', '이것',
    '나', '너', '우리', '저희', '그녀', '그들',
    '아', '오', '음', '흠', '뭐', '좀', '진짜', '정말', '너무',
    '했다', '했어', '한다', '하고', '해서', '하면', '할',
    '것', '수', '때', '중', '등', '및', '또', '더',
    '안', '못', '잘', '다', '매우', '아주', '참',
  ]);

  const words = cleaned.split(' ').filter(w => 
    w.length >= 2 && !stopWords.has(w) && !/^\d+$/.test(w)
  );

  // Deduplicate
  return [...new Set(words)];
}

function generateId(): string {
  return `sig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function useSignal() {
  const [entries, setEntries] = useState<SignalEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const initialLoadDone = useRef(false);

  // Initial load from Google Sheets (with localStorage fallback)
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    readSheet<SignalEntry>(SHEET_NAME)
      .then(rows => {
        if (rows.length > 0) {
          // Parse keywords back from JSON string if needed
          const parsed = rows.map(row => ({
            ...row,
            keywords: typeof row.keywords === 'string'
              ? JSON.parse(row.keywords as string)
              : Array.isArray(row.keywords) ? row.keywords : [],
          }));
          setEntries(parsed);
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed)); } catch { /* */ }
        }
      })
      .catch(() => {
        // Silently fall back to localStorage data
      });
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch { /* */ }
  }, [entries]);

  const addSignal = useCallback((text: string) => {
    const keywords = extractKeywords(text);
    const entry: SignalEntry = {
      id: generateId(),
      text,
      keywords,
      createdAt: new Date().toISOString(),
    };
    // Optimistic update
    setEntries(prev => [entry, ...prev]);
    // Background sync to Google Sheets
    addRow(SHEET_NAME, { ...entry, keywords: JSON.stringify(keywords) }).catch(() => {
      console.warn('시그널 Sheets 동기화 실패 (로컬 저장 완료)');
    });
    return entry;
  }, []);

  const deleteSignal = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    // Background sync
    deleteRow(SHEET_NAME, id).catch(() => {
      console.warn('시그널 삭제 Sheets 동기화 실패');
    });
  }, []);

  // Aggregate keywords with frequency
  const keywordMap = entries.reduce<Record<string, number>>((acc, entry) => {
    entry.keywords.forEach(kw => {
      acc[kw] = (acc[kw] || 0) + 1;
    });
    return acc;
  }, {});

  return { entries, addSignal, deleteSignal, keywordMap };
}
