import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_GEMINI_API_KEY || '';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sourceLabel, targetLabel } = body;

    if (!sourceLabel || !targetLabel) {
      return NextResponse.json({ error: 'sourceLabel and targetLabel are required' }, { status: 400 });
    }

    if (!apiKey) {
      // API Key가 없을 시 Fallback 목데이터 반환
      return NextResponse.json({
        connected: true,
        type: 'DEPENDENCY',
        summary: `[로컬 Fallback] ${sourceLabel}와(과) ${targetLabel} 간의 업무 의존 관계`
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `당신은 보건행정 및 지식 그래프 분석 전문가입니다. 다음 두 노드 간의 연관성과 관계 유형을 분석하십시오.
반드시 지정된 JSON 형식으로만 출력하십시오. 다른 설명문이나 코드블록 마크다운(\`\`\`json) 기호 등은 일절 제외하고 순수 JSON 문자열만 출력하십시오.

관계 유형(type)은 반드시 다음 5가지 중 하나로 매핑해야 합니다:
1. "CAUSAL_DRIVE" (원인과 결과, 한쪽이 다른 쪽을 유도하거나 촉진함)
2. "DEPENDENCY" (한쪽이 완료되거나 작동해야만 다른 쪽이 작동함)
3. "FEEDBACK_LOOP" (양방향 피드백 또는 순환적 연관성)
4. "BOTTLENECK" (한쪽이 다른 쪽의 원활한 흐름을 막는 병목 요인임)
5. "DECOUPLING" (두 노드 간의 기존 종속 관계를 분리하거나 독립시킴)

지정된 JSON 형식:
{
  "connected": true,
  "type": "CAUSAL_DRIVE",
  "summary": "두 노드의 실질적인 관계성을 1줄로 표현한 설명 요약 (20자 내외)"
}

노드 1: ${sourceLabel}
노드 2: ${targetLabel}
`;

    const res = await model.generateContent(prompt);
    const rawText = res.response.text().trim();
    const jsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonText);

    return NextResponse.json({
      connected: parsed.connected ?? true,
      type: parsed.type ?? 'DEPENDENCY',
      summary: parsed.summary ?? `${sourceLabel} - ${targetLabel} 간의 연계 관계`
    });

  } catch (err: any) {
    console.error('[AI Linker API] Error:', err);
    return NextResponse.json({
      connected: true,
      type: 'DEPENDENCY',
      summary: 'AI 관계 분석 일시 오류 (로컬 기본 연결)'
    });
  }
}
