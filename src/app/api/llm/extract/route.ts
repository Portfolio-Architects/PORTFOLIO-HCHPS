import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_GEMINI_API_KEY || '';

const responseSchema: any = {
  type: "object",
  properties: {
    nodes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Unique English ID using lowercase letters and underscores (e.g. kim_chulsoo)" },
          label: { type: "string", description: "Korean display name of the node" },
          group: { 
            type: "string", 
            enum: ["CORE_PROJECT", "MACRO_RESEARCH", "DCF_MODELING", "DATA_PIPELINE", "INFRASTRUCTURE", "SYSTEM_RISK", "OTHER"],
            description: "Category of the node"
          },
          baseValue: { type: "integer", description: "Importance score from 0 to 100" },
          layerId: { type: "integer", description: "Layer hierarchy: 0 (Person), 1 (Budget/Assets), 2 (Task/Meeting), 3 (Wiki/Document)" }
        },
        required: ["id", "label", "group", "baseValue", "layerId"]
      }
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source: { type: "string", description: "Source node ID" },
          target: { type: "string", description: "Target node ID" },
          weight: { type: "number", description: "Relationship weight from -1.0 to 1.0 (positive default)" },
          type: { 
            type: "string", 
            enum: ["CAUSAL_DRIVE", "DEPENDENCY", "FEEDBACK_LOOP", "BOTTLENECK", "DECOUPLING", "ASSIGNEE", "BUDGET_SOURCE", "COMPONENTS"],
            description: "Relationship type" 
          }
        },
        required: ["source", "target", "weight", "type"]
      }
    }
  },
  required: ["nodes", "edges"]
};

export async function POST(req: Request) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Google Gemini API Key가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const { text } = await req.json();
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing text content for extraction' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const systemPrompt = `당신은 비정형 문서 텍스트로부터 핵심 개체(Node)와 이들의 관계(Edge)를 추출하여 시맨틱 온톨로지 지식 그래프를 구성하는 데이터 추출기입니다.
제공된 텍스트를 정밀 분석하고, 반드시 다음 JSON 형식에 정확히 매칭되는 구조화된 데이터를 생성해 주세요.

<RULES>
1. 답변은 다른 생각이나 서론, 결론 없이 오직 유효한 단일 JSON 문자열만 출력해야 합니다. 마크다운의 \`\`\`json 이나 \`\`\` 마크업도 절대 포함하지 말고, 순수한 JSON 괄호로 시작해 괄호로 끝나도록 하세요.
2. 노드의 layerId 판정 기준:
   - 0: 인물 (직원명, 담당관, 부서, 외부 기관명 등)
   - 1: 예산/비품 (금액, 예산 계정, 구매 비품, 장비 임대비 등)
   - 2: 업무/회의 (수행 태스크, 과제, 회의록 제목, 추진 일련 활동 등)
   - 3: 위키/문서 (참조할 지식 문서명, 보고서 파일명 등)
3. 엣지의 type 판정 기준:
   - ASSIGNEE: 인물 노드(0)가 업무 노드(2)를 담당할 때. (예: 인물 -> 업무)
   - BUDGET_SOURCE: 특정 예산 노드(1)가 다른 업무(2)나 비품(1)의 재원일 때. (예: 예산 -> 업무)
   - COMPONENTS: 어떤 노드가 다른 노드의 구성 요소일 때.
   - CAUSAL_DRIVE: 한 현상이 다른 현상을 인과적으로 유발하거나 밀어줄 때.
   - DEPENDENCY: 특정 업무나 자원이 완수되어야 다른 업무가 시작될 수 있을 때.
   - BOTTLENECK: 병목 현상을 유발할 때.
4. 노드의 group 판정 기준:
   - CORE_PROJECT: 핵심 전략적인 프로젝트 관련
   - MACRO_RESEARCH: 조사 및 분석 관련
   - INFRASTRUCTURE: 기초 환경이나 자원 관련
   - SYSTEM_RISK: 예산 부족, 기한 마감 임박 등 주의가 필요한 요소 관련
   - OTHER: 기타 분류
5. 텍스트에 나타나지 않은 가상의 사실을 과도하게 생성하지 마세요. 본문에 직접적으로 등장하는 개체와 관계 위주로 정확하게 요약하세요.
</RULES>

사용자 텍스트:
${text}
`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.1, // 창의성 최소화하여 정밀 추출
        responseMimeType: 'application/json',
        responseSchema: responseSchema
      }
    });

    let responseText = '';
    let retries = 3;
    while (retries > 0) {
      try {
        const result = await model.generateContent(systemPrompt);
        responseText = result.response.text().trim();
        break;
      } catch (err: any) {
        retries--;
        if (retries === 0) throw err;
        console.warn(`Gemma API call for extract failed, retrying... (${3 - retries} attempts failed):`, err.message);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // JSON 정제 (마크다운 백틱 제거 및 유효한 JSON 영역만 슬라이싱)
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```') || cleaned.includes('```')) {
      cleaned = cleaned.replace(/```json/gi, '').replace(/```/g, '').trim();
    }

    // { 로 시작해서 } 로 끝나는 JSON 본체만 정교하게 슬라이싱
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      cleaned = cleaned.substring(startIdx, endIdx + 1);
    }
    
    // JSON 유효성 검증
    try {
      const parsed = JSON.parse(cleaned);
      return NextResponse.json({ success: true, data: parsed });
    } catch (jsonErr) {
      console.error('[Extract JSON Parse Error] Raw text from Gemma:', responseText, jsonErr);
      return NextResponse.json({ 
        success: false, 
        error: 'AI 응답을 JSON으로 파싱하는 데 실패했습니다.', 
        rawResponse: responseText 
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Extraction API Error:', error);
    return NextResponse.json(
      { success: false, error: `서버 오류 발생: ${error.message}` },
      { status: 500 }
    );
  }
}
