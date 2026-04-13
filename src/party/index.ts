import type { Party, PartyKitServer } from "partykit/server";
import { onConnect } from "y-partykit";

export default {
  // 클라이언트(프론트엔드)가 이 방(Room)에 접속할 때마다 호출
  onConnect(ws, room, ctx) {
    const url = new URL(ctx.request.url);
    const token = url.searchParams.get("token");
    const expectedToken = room.env.HCHPS_AUTH_TOKEN as string;

    // 엄격한 Auth Token 유효성 검사 (하드코딩된 우회 또는 미설정 허용 금지)
    if (!expectedToken || !token || token !== expectedToken) {
      ws.close(1008, "Unauthorized: Strict E2EE Session Token required");
      return;
    }

    // y-partykit의 내장 onConnect 핸들러: 
    // yjs 문서 객체를 클라우드에 자동 로드(persist)하고, 웹소켓 양방향 이진 통신을 관리합니다.
    return onConnect(ws, room, { persist: true });
  }
} satisfies PartyKitServer;
