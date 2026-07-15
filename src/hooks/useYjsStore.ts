'use client';

import '@/lib/bypass-unload';
import { useEffect, useMemo } from 'react';
import * as Y from 'yjs';
import YPartyKitProvider from 'y-partykit/provider';
import { IndexeddbPersistence, storeState } from 'y-indexeddb';
import { getAuthToken } from '@/lib/crypto';

declare global {
  interface Window {
    __globalYDoc?: Y.Doc;
    __globalYProvider?: YPartyKitProvider;
    __globalYIndexeddb?: IndexeddbPersistence;
  }
}

// 동시성 트랜잭션 락 상태 관리
let isTransacting = false;

/**
 * Yjs 트랜잭션의 동시성 경합을 원천적으로 제어하고 락(Lock)을 가하는 안전 유틸리티
 */
export async function runSafeTransaction(ydoc: Y.Doc, fn: () => void, retries = 5): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    if (!isTransacting) {
      isTransacting = true;
      try {
        ydoc.transact(fn);
        return;
      } finally {
        isTransacting = false;
      }
    }
    // 경합 발생 시 지수 백오프/지연 후 재시도
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
  }
  // 최종 시도
  ydoc.transact(fn);
}

// 싱글톤 패턴: 앱 전역에서 Y.Doc을 하나만 씁니다 (HMR 환경에서 초기화되는 것 방지)
export const globalYDoc = (typeof window !== 'undefined' && window.__globalYDoc) 
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
    if (typeof window === 'undefined') return;

    // 1. IndexedDB 영속성 바인딩 도입 (y-indexeddb)
    const indexeddbProvider = new IndexeddbPersistence(roomId, ydoc);
    if (roomId === 'hchps-global') {
      window.__globalYIndexeddb = indexeddbProvider;
    }

    // 2. Yjs 업데이트 횟수를 카운트해 주기적으로 Compaction (Trim) 트리거
    let updateCount = 0;
    const handleYjsUpdate = () => {
      updateCount++;
      if (updateCount >= 100) {
        updateCount = 0;
        try {
          console.info('[Yjs IndexedDB] Compacting updates storage...');
          storeState(indexeddbProvider, false);
        } catch (e) {
          console.warn('[Yjs IndexedDB] Compaction failed:', e);
        }
      }
    };
    ydoc.on('update', handleYjsUpdate);

    // 로컬 환경에서 로컬 PartyKit 개발 서버(1999)를 직접 띄워서 사용하려는 경우에만 localStorage 설정을 활성화합니다.
    const useLocalParty = typeof window !== 'undefined' && window.localStorage.getItem('use-local-partykit') === 'true';
    const isLocal = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && useLocalParty;
    const host = isLocal ? 'localhost:1999' : 'hchps-party.portfolio-architects.partykit.dev';

    let token = '';
    try {
      token = getAuthToken();
    } catch (e) {
      console.warn('[Yjs Provider] Failed to fetch auth token', e);
    }

    console.info(`[Yjs Provider] Connecting to PartyKit room "${roomId}" at ${host}`);

    // YPartyKitProvider 생성 및 strict token 인증 쿼리 전달
    const provider = new YPartyKitProvider(host, roomId, ydoc, {
      connect: true,
      params: { token }
    });

    // 전역 싱글톤 프로바이더 보관 (HMR 환경 대비)
    if (roomId === 'hchps-global') {
      window.__globalYProvider = provider;
    }

    return () => {
      // 리소스 정리
      ydoc.off('update', handleYjsUpdate);
      
      indexeddbProvider.destroy();
      provider.destroy();
    };
  }, [roomId, ydoc]);

  return { ydoc };
}

