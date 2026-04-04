'use client';

import { useEffect, useState, useMemo } from 'react';
import * as Y from 'yjs';
import YPartyKitProvider from 'y-partykit/provider';

// PartyKit 기본 개발 데브서버 포트 또는 배포 환경 도메인
const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || '127.0.0.1:1999';

// 싱글톤 패턴: 앱 전역에서 Y.Doc을 하나만 씁니다 (HMR 환경에서 초기화되는 것 방지)
const globalYDoc = (typeof window !== 'undefined' && (window as any).__globalYDoc) 
  ? (window as any).__globalYDoc 
  : new Y.Doc();

if (typeof window !== 'undefined') {
  (window as any).__globalYDoc = globalYDoc;
}

export function useYjsStore(roomId: string = 'hchps-global') {
  const [provider, setProvider] = useState<YPartyKitProvider | null>(null);

  // 전역 마인드맵 궤도 렌더링은 globalYDoc을 쓰고, 위키 다큐멘트 등 개별 에디터 창은 독립적인 Y.Doc을 생성해 격리합니다.
  const ydoc = useMemo(() => {
    return roomId === 'hchps-global' ? globalYDoc : new Y.Doc();
  }, [roomId]);

  useEffect(() => {
    // 이미 연결되어 있으면(개발 서버 HMR 환경 등) 재연결하지 않도록 방어 코드
    const newProvider = new YPartyKitProvider(PARTYKIT_HOST, roomId, ydoc);
    
    // 로컬 브라우저 IndexedDB에 영구 보존(Persistence) 계층을 추가하여 서버 재시작 시에도 롤백되지 않게 보호합니다.
    let indexeddbProvider: any = null;
    if (typeof window !== 'undefined') {
      import('y-indexeddb').then(({ IndexeddbPersistence }) => {
        indexeddbProvider = new IndexeddbPersistence(roomId, ydoc);
      });
    }
    
    setProvider(newProvider);

    return () => {
      // HMR 환경에서 소켓 끊어짐 방지를 위해 사실상 컴포넌트 마운트 해제될 때 정리
      newProvider.destroy();
    };
  }, [roomId, ydoc]);

  return { ydoc, provider };
}
