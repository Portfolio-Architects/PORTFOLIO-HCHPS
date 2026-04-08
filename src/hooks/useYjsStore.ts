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
    // 로컬 브라우저 IndexedDB에 영구 보존(Persistence) 계층을 추가하여 서버 재시작 시에도 롤백되지 않게 보호합니다.
    let indexeddbProvider: IndexeddbPersistence | null = null;
    if (typeof window !== 'undefined') {
      import('y-indexeddb').then(({ IndexeddbPersistence }) => {
        indexeddbProvider = new IndexeddbPersistence(roomId, ydoc);
      });
    }

    return () => {
      // 컴포넌트 마운트 해제 시 IndexedDB provider 정리 (선택적)
      if (indexeddbProvider) indexeddbProvider.destroy();
    };
  }, [roomId, ydoc]);

  return { ydoc };
}
