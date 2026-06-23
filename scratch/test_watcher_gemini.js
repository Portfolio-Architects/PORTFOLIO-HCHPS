const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      process.env[key] = val;
    }
  });
}

const apiKey = process.env.GOOGLE_GEMINI_API_KEY || '';

const responseSchema = {
  type: "OBJECT",
  properties: {
    nodes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING", description: "Unique English ID using lowercase letters and underscores (e.g. kim_chulsoo)" },
          label: { type: "STRING", description: "Korean display name of the node" },
          group: { 
            type: "STRING", 
            enum: ["CORE_PROJECT", "MACRO_RESEARCH", "DCF_MODELING", "DATA_PIPELINE", "INFRASTRUCTURE", "SYSTEM_RISK", "OTHER"],
            description: "Category of the node"
          },
          baseValue: { type: "INTEGER", description: "Importance score from 0 to 100" },
          layerId: { type: "INTEGER", description: "Layer hierarchy: 0 (Person), 1 (Budget/Assets), 2 (Task/Meeting), 3 (Wiki/Document)" }
        },
        required: ["id", "label", "group", "baseValue", "layerId"]
      }
    },
    edges: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          source: { type: "STRING", description: "Source node ID" },
          target: { type: "STRING", description: "Target node ID" },
          weight: { type: "NUMBER", description: "Relationship weight from -1.0 to 1.0 (positive default)" },
          type: { 
            type: "STRING", 
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

async function test(modelName) {
  console.log(`\n======================= Testing model: ${modelName} =======================`);
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
3. 텍스트에 나타나지 않은 가상의 사실을 과도하게 생성하지 마세요. 본문에 직접적으로 등장하는 개체와 관계 위주로 정확하게 요약하세요.
</RULES>

사용자 텍스트:
20260203_세브란스헬스체크업_건강검진프로그램_국문(2026).pdf
연세대 세브란스 빌딩 헬스체크업 센터 건강검진 프로그램.
오창선 주무관이 검진 예산을 기획 및 집행하며 총 4,500,000원의 검진 예산이 배정됨.
`;

  try {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: responseSchema
      }
    });
    
    const result = await model.generateContent(systemPrompt);
    console.log("Raw Response Text:\n", result.response.text());
  } catch (err) {
    console.error("Error during generation:", err);
  }
}

async function run() {
  await test('gemini-2.5-flash');
  await test('gemini-3.5-flash');
}

run();
