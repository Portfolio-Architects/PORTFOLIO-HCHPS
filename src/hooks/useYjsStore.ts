'use client';

import { useEffect, useMemo } from 'react';
import * as Y from 'yjs';
import type { IndexeddbPersistence } from 'y-indexeddb';

declare global {
  interface Window {
    __globalYDoc?: Y.Doc;
  }
}

// 싱글톤 패턴: 앱 전역에서 Y.Doc을 하나만 씁니다 (HMR 환경에서 초기화되는 것 방지)
const globalYDoc = (typeof window !== 'undefined' && window.__globalYDoc) 
  ? window.__globalYDoc 
  : new Y.Doc();

if (typeof window !== 'undefined') {
  window.__globalYDoc = globalYDoc;
}

export function useYjsStore(roomId: string = 'hchps-global') {
  const ydoc = useMemo(() => {
    return roomId === 'hchps-global' ? globalYDoc : new Y.Doc();
  }, [roomId]);

  useEffect(() => {
    // 순수 인메모리(in-memory) ydoc만 유지. (IndexedDB 자동 백업 제거)
    // Cloudflare KV(`fetchFromCloud`, `syncToCloud`)가 유일한 중앙 저장소가 되도록 강제합니다.
  }, [roomId, ydoc]);

  return { ydoc };
}
