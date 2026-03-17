'use client';

import { useState, useEffect, useCallback } from 'react';

export interface SignalEntry {
  id: string;
  text: string;
  keywords: string[];
  createdAt: string;
}

const STORAGE_KEY = 'hchps-signal-log';

function extractKeywords(text: string): string[] {
  // Remove common particles/josa and extract meaningful words
  const cleaned = text
    .replace(/[.,!?~…·\-()[\]{}'"``""'']/g, ' ')
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

  // Persist
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
    setEntries(prev => [entry, ...prev]);
    return entry;
  }, []);

  const deleteSignal = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
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
