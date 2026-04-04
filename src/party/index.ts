import type { Party, PartyKitServer } from "partykit/server";
import { onConnect } from "y-partykit";

export default {
  // 클라이언트(프론트엔드)가 이 방(Room)에 접속할 때마다 호출
  onConnect(ws, room) {
    // y-partykit의 내장 onConnect 핸들러: 
    // yjs 문서 객체를 클라우드에 자동 로드(persist)하고, 웹소켓 양방향 이진 통신을 관리합니다.
    return onConnect(ws, room, { persist: true });
  }
} satisfies PartyKitServer;
