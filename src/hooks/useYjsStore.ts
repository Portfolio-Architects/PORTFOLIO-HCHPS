'use client';

import { useEffect, useMemo } from 'react';
import * as Y from 'yjs';
import YPartyKitProvider from 'y-partykit/provider';
import { getAuthToken } from '@/lib/crypto';

declare global {
  interface Window {
    __globalYDoc?: Y.Doc;
    __globalYProvider?: YPartyKitProvider;
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
    if (typeof window === 'undefined') return;

    // 로컬 환경에서 로컬 PartyKit 개발 서버(1999)를 직접 띄워서 사용하려는 경우에만 localStorage 설정을 활성화합니다.
    // 그 외 기본값은 클라우드 PartyKit 서버로 연결하여 콘솔 오류를 방지하고 즉각 연동을 보장합니다.
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
      // 룸 연결 끊기 및 프로바이더 정리 (메모리 누수 및 좀비 소켓 방지)
      provider.destroy();
    };
  }, [roomId, ydoc]);

  return { ydoc };
}
