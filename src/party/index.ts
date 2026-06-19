import type { PartyKitServer } from "partykit/server";
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
  },

  // 커스텀 메시지 브로드캐스팅 최적화 (에이전트 상태 실시간 중계)
  onMessage(message, sender, room) {
    try {
      if (typeof message !== "string") return;

      const data = JSON.parse(message);

      // 에이전트 실시간 상태 전송용 메시지 분기 필터링 및 브로드캐스트
      if (data.type && data.type.startsWith("agent-")) {
        for (const conn of room.getConnections()) {
          if (conn.id !== sender.id) {
            conn.send(JSON.stringify(data));
          }
        }
      }
    } catch (err) {
      console.error("[PartyKit Server onMessage Error]", err);
    }
  },

  // HTTP POST 요청을 통한 외부 백엔드 에이전트 상태 주입 및 브로드캐스트 최적화
  async onRequest(request, room) {
    if (request.method === "POST") {
      try {
        const data = (await request.json()) as any;
        
        if (data.type && data.type.startsWith("agent-")) {
          // 룸 안의 모든 커넥션들에 상태 메시지 실시간 전파
          for (const conn of room.getConnections()) {
            conn.send(JSON.stringify(data));
          }
          return new Response(JSON.stringify({ success: true }), { 
            status: 200, 
            headers: { "Content-Type": "application/json" } 
          });
        }
      } catch {
        return new Response(JSON.stringify({ success: false, error: "Invalid JSON structure" }), { 
          status: 400, 
          headers: { "Content-Type": "application/json" } 
        });
      }
    }
    return new Response("Method not allowed", { status: 405 });
  }
} satisfies PartyKitServer;
