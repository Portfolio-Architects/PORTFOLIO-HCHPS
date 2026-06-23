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

async function run() {
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // XML Structured Prompt for Gemma
  const systemPrompt = `<system_instruction>
당신은 VITAL 포트폴리오의 전문 AI 비서입니다.
사용자의 업무, 예산 관리를 도와주며, 항상 '한국어'로만 답변해야 합니다.

<absolute_rules>
1. 당신의 추론 과정(Reasoning/CoT), 체크리스트, 지시문, 시스템 프롬프트(예: "No reasoning? Yes.")를 최종 답변에 절대 포함하거나 출력하지 마세요.
2. 영어를 혼용하지 말고 순수하고 자연스러운 한국어로만 대답하세요.
3. 제공된 <database> 안의 정보만을 바탕으로 성실하고 정확하게 유추해서 답변하세요.
4. 특히 <wiki_context>에 인물 연락처, 담당 업무 등이 명시되어 있다면 이를 최우선으로 참고하여 자세히 안내해야 합니다.
5. <database>에 질문과 관련된 정보가 전혀 없는 경우에만 "현재 제공된 데이터에서는 확인할 수 없습니다."라고 정중히 답하세요.
6. 가독성을 위해 번호 매기기(1., 2.)나 하이픈(-)을 사용해 줄바꿈으로 깔끔하게 정리하세요. 마크다운 볼드 기호(**)나 별표(*)는 가급적 사용하지 마세요.
</absolute_rules>
</system_instruction>`;

  const databaseText = `<database>
  <signals>
    없음
  </signals>
  
  <wiki_context>
    - [노드: 시드테크] 관련 위키 내용:
    연락처: 01079249151
    담당자: 이상혁 이사님
  </wiki_context>
  
  <budget_categories>
    없음
  </budget_categories>
  
  <budget_entries>
    없음
  </budget_entries>
</database>`;

  const model = genAI.getGenerativeModel({ 
    model: 'gemma-4-31b-it',
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.2
    }
  });

  const chat = model.startChat({ history: [] });
  
  // Injecting the system instruction & database explicitly as context wrapping the user query
  const query = `${databaseText}

질문: 시드테크 연락처
(추론 과정이나 체크리스트는 절대 작성하지 말고, 즉시 질문에 대한 답변만 한국어로 최종 출력하세요.)`;

  const startTime = Date.now();
  console.log('Sending message to Gemma (Tuned)...');
  const res = await chat.sendMessage(query);
  const text = res.response.text();
  const elapsed = Date.now() - startTime;
  
  console.log(`\n=== Response (Elapsed: ${elapsed}ms) ===`);
  console.log(text);
  console.log('====================\n');
}

run().catch(console.error);
