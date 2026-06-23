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

async function test() {
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const systemPrompt = `당신은 비정형 문서 텍스트로부터 핵심 개체(Node)와 이들의 관계(Edge)를 추출하여 시맨틱 온톨로지 지식 그래프를 구성하는 데이터 추출기입니다.
제공된 텍스트를 정밀 분석하고, 반드시 다음 JSON 형식에 정확히 매칭되는 구조화된 데이터를 생성해 주세요.

<JSON_FORMAT>
{
  "nodes": [
    {
      "id": "Unique English ID using lowercase letters and underscores (e.g. kim_chulsoo)",
      "label": "Korean display name of the node",
      "group": "CORE_PROJECT | MACRO_RESEARCH | DCF_MODELING | DATA_PIPELINE | INFRASTRUCTURE | SYSTEM_RISK | OTHER",
      "baseValue": 80, // Importance score from 0 to 100
      "layerId": 2 // Layer hierarchy: 0 (Person), 1 (Budget/Assets), 2 (Task/Meeting), 3 (Wiki/Document)
    }
  ],
  "edges": [
    {
      "source": "Source node ID",
      "target": "Target node ID",
      "weight": 1.0, // Relationship weight from -1.0 to 1.0 (positive default)
      "type": "CAUSAL_DRIVE | DEPENDENCY | FEEDBACK_LOOP | BOTTLENECK | DECOUPLING | ASSIGNEE | BUDGET_SOURCE | COMPONENTS"
    }
  ]
}
</JSON_FORMAT>

사용자 텍스트:
20260203_세브란스헬스체크업_건강검진프로그램_국문(2026).pdf
연세대 세브란스 빌딩 헬스체크업 센터 건강검진 프로그램.
오창선 주무관이 검진 예산을 기획 및 집행하며 총 4,500,000원의 검진 예산이 배정됨.
`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    });
    
    console.log("Generating content...");
    const result = await model.generateContent(systemPrompt);
    
    console.log("\n=== Response metadata ===");
    console.log("Prompt feedback:", JSON.stringify(result.response.promptFeedback, null, 2));
    
    if (result.response.candidates && result.response.candidates.length > 0) {
      const candidate = result.response.candidates[0];
      console.log("Finish Reason:", candidate.finishReason);
      console.log("Finish Message:", candidate.finishMessage);
      console.log("Safety Ratings:", JSON.stringify(candidate.safetyRatings, null, 2));
      console.log("Content Text Length:", candidate.content?.parts?.[0]?.text?.length);
      console.log("Content Text Preview:", JSON.stringify(candidate.content?.parts?.[0]?.text));
    } else {
      console.log("No candidates returned.");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
