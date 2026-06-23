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
          id: { type: "STRING" },
          label: { type: "STRING" },
          group: { type: "STRING" },
          baseValue: { type: "INTEGER" },
          layerId: { type: "INTEGER" }
        },
        required: ["id", "label", "group", "baseValue", "layerId"]
      }
    },
    edges: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          source: { type: "STRING" },
          target: { type: "STRING" },
          weight: { type: "NUMBER" },
          type: { type: "STRING" }
        },
        required: ["source", "target", "weight", "type"]
      }
    }
  },
  required: ["nodes", "edges"]
};

async function test() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
  
  const systemPrompt = `당신은 비정형 문서 텍스트로부터 핵심 개체(Node)와 이들의 관계(Edge)를 추출하여 시맨틱 온톨로지 지식 그래프를 구성하는 데이터 추출기입니다.
제공된 텍스트를 정밀 분석하고, 반드시 다음 JSON 형식에 정확히 매칭되는 구조화된 데이터를 생성해 주세요.

사용자 텍스트:
20260203_세브란스헬스체크업_건강검진프로그램_국문(2026).pdf
연세대 세브란스 빌딩 헬스체크업 센터 건강검진 프로그램.
오창선 주무관이 검진 예산을 기획 및 집행하며 총 4,500,000원의 검진 예산이 배정됨.
`;

  const payload = {
    contents: [
      {
        parts: [
          { text: systemPrompt }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      maxOutputTokens: 2048,
      temperature: 0.1
    }
  };

  try {
    console.log("Sending raw fetch request to Google API...");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    console.log("Response data:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

test();
