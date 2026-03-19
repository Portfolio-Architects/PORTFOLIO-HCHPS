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

export function extractKeywords(text: string): string[] {
  // Step 1: 특수문자 제거, 공백 정리
  const cleaned = text
    .replace(/[.,!?~…·\-()[\]{}'\"``""''@#$%^&*+=|\\/<>:;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Step 2: 한국어 어미/조사 패턴 → 어근만 남기기
  // 긴 패턴부터 매칭 (greedy)
  const suffixPatterns = [
    // 복합 어미 (3글자 이상)
    '했는데', '됐는데', '겠는데', '었는데', '았는데', '였는데',
    '하면서', '되면서', '으면서', '이면서',
    '했다가', '됐다가', '갔다가', '왔다가', '었다가', '았다가',
    '하더니', '되더니', '었더니', '았더니',
    '하려고', '되려고', '으려고',
    '하니까', '되니까', '으니까',
    '해야지', '돼야지', '어야지', '아야지',
    '했더라', '됐더라', '었더라', '았더라',
    '한다면', '된다면',
    '해야만', '돼야만',
    '하다가', '되다가',
    '해주고', '해줘서',
    '해야해', '돼야해',
    '로써는', '으로써',
    '에서는', '에서도', '까지도', '부터는', '만큼은',
    // 복합 조사 (2글자)
    '했다', '됐다', '갔다', '왔다', '었다', '았다', '였다',
    '하면', '되면', '으면',
    '하고', '되고',
    '해서', '돼서', '어서', '아서',
    '하는', '되는',
    '했어', '됐어', '었어', '았어', '였어',
    '할때', '될때',
    '한다', '된다', '간다', '온다',
    '해야', '돼야',
    '하지', '되지',
    '인데', '은데', '는데',
    '이랑', '이랑',
    '에게', '한테', '에서',
    '으로', '에는', '에도',
    '까지', '부터', '처럼', '만큼', '같이', '보다',
    '라고', '다고', '라는', '다는',
    '라서', '라며', '라면',
    '이다', '이고', '이며', '이라',
    // 단순 어미 (1글자)
    '를', '을', '의', '에', '로', '와', '과', '도',
    '는', '은', '가', '이', '만', '께',
  ];

  function stripSuffix(word: string): string {
    for (const suffix of suffixPatterns) {
      if (word.length > suffix.length + 1 && word.endsWith(suffix)) {
        return word.slice(0, -suffix.length);
      }
    }
    return word;
  }

  // Step 3: 불용어 (stopwords) — 단독 사용 시 의미 없는 단어
  const stopWords = new Set([
    // 대명사
    '나', '너', '저', '우리', '저희', '그녀', '그들', '자기', '여기', '거기', '저기',
    '이것', '그것', '저것', '어디', '무엇', '누구', '어느',
    // 관형사/부사
    '이', '그', '저', '이런', '그런', '저런', '어떤', '무슨', '모든', '각',
    '매우', '아주', '너무', '정말', '진짜', '참', '좀', '약간', '꽤',
    '더', '덜', '가장', '제일', '아마', '혹시', '설마', '과연',
    '또', '다시', '계속', '이미', '아직', '벌써', '곧', '바로', '방금',
    '잘', '못', '안', '꼭', '항상', '자주', '가끔', '별로',
    // 동사/형용사 기본형 (의미 약한)
    '하다', '되다', '있다', '없다', '이다', '아니다',
    '같다', '보다', '주다', '받다', '오다', '가다',
    '알다', '모르다', '싶다', '좋다', '나쁘다',
    // 접속사/감탄사
    '그래서', '그런데', '그리고', '하지만', '그러나', '또한', '즉',
    '때문', '왜냐', '따라서', '그래도', '아무튼', '어쨌든',
    '아', '오', '음', '흠', '뭐', '응', '네', '예', '글쎄',
    // 의존 명사 / 기능어
    '것', '수', '때', '중', '등', '및', '개', '번', '분',
    '정도', '이상', '이하', '이후', '이전', '위해',
    // 기타 자주 등장하는 비(非)핵심 단어
    '했는데', '했다', '있는', '하는', '된다', '됐다',
  ]);

  // Step 4: 단어 분리, 어근 추출, 필터링
  const words = cleaned.split(' ')
    .map(w => stripSuffix(w))        // 어미 제거
    .filter(w => {
      if (w.length < 2) return false;                    // 1글자 제거
      if (stopWords.has(w)) return false;                // 불용어 제거
      if (/^\d+$/.test(w)) return false;                 // 순수 숫자 제거
      if (/^[ㄱ-ㅎㅏ-ㅣ]+$/.test(w)) return false;       // 자모만(ㅋㅋ, ㅎㅎ) 제거
      if (/^[a-zA-Z]{1,2}$/.test(w)) return false;      // 영문 1-2글자 제거
      return true;
    });

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
        } else {
          // KV is empty — push localStorage data to KV if available (one-time migration)
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            try {
              const localData = JSON.parse(stored) as SignalEntry[];
              if (localData.length > 0) {
                // Ensure keywords are stringified when pushing to KV
                const toUpload = localData.map(entry => ({
                  ...entry,
                  keywords: JSON.stringify(entry.keywords)
                }));
                import('@/lib/sheets-api').then(({ replaceAll }) => {
                  replaceAll(SHEET_NAME, toUpload).then(ok => {
                    if (ok) console.log(`[KV Sync] 로컬 데이터 마이그레이션 완료: ${SHEET_NAME} (${localData.length}건)`);
                  });
                });
              }
            } catch { /* ignore parse errors */ }
          }
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
