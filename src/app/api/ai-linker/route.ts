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

    const prompt = `Analyze relationship between 2 nodes. Output JSON only.
Format: {"connected": true, "type": "DEPENDENCY", "summary": "1줄 요약"}
Types: CAUSAL_DRIVE, DEPENDENCY, FEEDBACK_LOOP, BOTTLENECK, DECOUPLING.
Node 1: ${sourceLabel}
Node 2: ${targetLabel}`;

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
