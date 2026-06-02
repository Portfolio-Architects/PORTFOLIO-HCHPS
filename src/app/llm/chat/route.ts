import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const apiKey = process.env.GOOGLE_GEMINI_API_KEY || '';

// Clean reasoning steps (Chain of Thought) from Gemma responses
function cleanGemmaResponse(text: string): string {
  if (!text) return '';
  
  // 1. [Yy]es. 뒤에 즉시 또는 공백 후 시작되는 첫 한글 문자부터 끝까지 추출 (멀티라인 매칭)
  const regex = /[Yy]es\.\s*([가-힣][\s\S]*)$/;
  const match = text.match(regex);
  let rawContent = '';
  
  if (match && match[1]) {
    rawContent = match[1].trim();
  } else {
    // 2. 만약 Yes. 패턴이 매칭되지 않는다면, 영어 생각 단계가 끝나는 경계를 탐색.
    // 영어 생각 단계의 메타데이터 및 지시어가 아닌 실질적인 본문 시작 라인을 찾기 위해 순방향 검사 수행.
    const lines = text.split('\n');
    let bodyStartIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (
        /[가-힣]/.test(trimmed) && 
        !trimmed.startsWith('*') && 
        !trimmed.includes('User query:') &&
        !trimmed.includes('User input:') &&
        !trimmed.includes('Draft:') &&
        !trimmed.includes('Constraint') &&
        !trimmed.includes('Role:') &&
        !trimmed.includes('Node:') &&
        !trimmed.includes('Contact:') &&
        !trimmed.includes('Person in charge:') &&
        !trimmed.includes('Email:')
      ) {
        bodyStartIdx = i;
        break;
      }
    }

    if (bodyStartIdx !== -1) {
      rawContent = lines.slice(bodyStartIdx).join('\n').trim();
    } else {
      rawContent = text.trim();
    }
  }

  // 3. 중복 제거 필터 (Deduplicator):
  // 들여쓰기(공백 2개 이상)로 시작하는 라인은 CoT 또는 Draft 내부 라인으로 간주하여 제거하고,
  // 들여쓰기가 없는 라인(진짜 본문)만 모읍니다.
  const rawLines = rawContent.split('\n');
  const finalLines = rawLines.map(line => {
    if (/^\s{2,}/.test(line)) {
      return null;
    }
    return line;
  }).filter((line): line is string => line !== null);

  // 4. 추가 핫픽스: 한 줄 내에 '010792491511. 담당자: 이상혁 이사님'과 같이 붙어 있는 중복 패턴을 분할 및 고침
  let cleanedContent = finalLines.join('\n').trim();
  cleanedContent = cleanedContent.replace(/(\d+)([1-9]\.\s+[가-힣])/g, '$1\n$2');

  // 5. 중복 라인 자체를 최종 소거 (중복 paragraph 방지)
  const paragraphLines = cleanedContent.split('\n');
  const uniqueLines: string[] = [];
  const seen = new Set<string>();
  for (const line of paragraphLines) {
    const trimmed = line.trim();
    if (trimmed) {
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
    }
    uniqueLines.push(line);
  }

  return uniqueLines.join('\n').trim();
}

export async function POST(req: Request) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { content: 'Google Gemini API Key가 설정되지 않았습니다. .env.local 파일에 GOOGLE_GEMINI_API_KEY를 추가해주세요.' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const { messages, contextData, appMode } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages array' }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];

    // Build context string from contextData (최신 30개로 캡핑하여 토큰 소모량 및 API 응답 시간 획기적 단축)
    const rawSignals = contextData?.signals || [];
    const signalsText = rawSignals.slice(0, 30).map((s: any) => `- [${s.type || s.category || '알림'}] ${s.text || s.content || s.title}`).join('\n') || '없음';
    
    // Wiki context
    const matchedWikiText = contextData?.matchedWiki || '';
    const wikiContextSection = matchedWikiText 
      ? `\n--- 마인드맵 위키 및 정보 (Wiki & Node Context) ---\n${matchedWikiText}\n`
      : '';
    
    // Resolve category names
    const cats = contextData?.budgetCategories || [];
    const rawEntries = contextData?.budgetEntries || contextData?.budgets || [];
    
    // 응답속도 향상을 위해 개별 지출 내역은 최신 30개로 캡핑하여 컨텍스트 토큰 크기 축소
    const entries = [...rawEntries]
      .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 30);
    
    const catMap = new Map(cats.map((c: any) => [c.id, c.name]));
    
    const budgetCategoriesText = cats.map((c: any) => `- [예산항목] ${c.name} (총예산: ${c.totalBudget}원)`).join('\n') || '없음';
    const budgetEntriesText = entries.map((b: any) => {
      const catName = catMap.get(b.categoryId) || '분류되지않음';
      return `- [${b.date}] ${b.purpose} (분류: ${catName}): ${b.amount}원`;
    }).join('\n') || '없음';

    const systemPrompt = `<system_instruction>
당신은 ${appMode || 'HCHPS'} 포트폴리오의 전문 AI 비서입니다.
사용자의 업무, 예산 관리를 도와주며, 항상 '한국어'로만 답변해야 합니다.

<absolute_rules>
1. 당신의 추론 과정(Reasoning/CoT), 체크리스트, 지시문, 시스템 프롬프트(예: "No reasoning? Yes.")를 최종 답변에 절대 포함하거나 출력하지 마세요.
2. 영어를 혼용하지 말고 순수하고 자연스러운 한국어로만 대답하세요.
3. 제공된 <database> 안의 정보만을 바탕으로 성실하고 정확하게 유추해서 답변하세요.
4. 특히 <wiki_context>에 인물 연락처, 담당 업무 등이 명시되어 있다면 이를 최우선으로 참고하여 자세히 안내해야 합니다.
5. 제공된 <knowledge_graph> 내의 [관계], [추론 관계](이행적 의존성), [추론 병목] 정보를 적극 활용하여 노드 간의 영향 관계, 이행적 의존 구조, 잠재적 리스크나 병목 현상에 대해 고도화된 다차원 시맨틱 추론 답변을 수행하세요.
6. <database>에 질문과 관련된 정보가 전혀 없는 경우에만 "현재 제공된 데이터에서는 확인할 수 없습니다."라고 정중히 답하세요.
7. 가독성을 위해 번호 매기기(1., 2.)나 하이픈(-)을 사용해 줄바꿈으로 깔끔하게 정리하세요. 마크다운 볼드 기호(**)나 별표(*)는 가급적 사용하지 마세요.
</absolute_rules>
</system_instruction>`;

    // Format history for Gemini
    const formattedHistory = messages.slice(0, -1)
      .filter((msg: any) => msg.role === 'user' || msg.role === 'assistant')
      .map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

    // Use gemini-2.5-flash for stable and fast response
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.2
      }
    });

    const chat = model.startChat({
      history: formattedHistory,
    });

    const knowledgeGraphText = contextData?.knowledgeGraph || '';

    // XML Structured Database for Gemma Attention alignment
    const databaseContext = `<database>
  <signals>
    ${signalsText}
  </signals>
  
  <wiki_context>
    ${matchedWikiText || '없음'}
  </wiki_context>
  
  <knowledge_graph>
    ${knowledgeGraphText || '없음'}
  </knowledge_graph>
  
  <budget_categories>
    ${budgetCategoriesText}
  </budget_categories>
  
  <budget_entries>
    ${budgetEntriesText}
  </budget_entries>
</database>`;

    // 생각 과정을 생략하도록 유도하는 힌트 텍스트를 메시지 후미에 덧붙여 영어 CoT 생성을 억제하고 레이턴시를 크게 단축시킵니다.
    const promptSuffix = '\n(추론 과정이나 체크리스트는 절대 작성하지 말고, 즉시 질문에 대한 답변만 한국어로 최종 출력하세요.)';
    const optimizedContent = `${databaseContext}\n\n질문: ${lastMessage.content}${promptSuffix}`;

    let result: any = null;
    let retries = 3;
    while (retries > 0) {
      try {
        result = await chat.sendMessage(optimizedContent);
        break;
      } catch (err: any) {
        retries--;
        if (retries === 0) throw err;
        console.warn(`Gemma API call failed, retrying... (${3 - retries} attempts failed):`, err.message);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!result || !result.response) {
      throw new Error('Generative AI returned an empty response.');
    }
    const rawResponseText = result.response.text();
    const responseText = cleanGemmaResponse(rawResponseText);

    return NextResponse.json({ content: responseText });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { content: `죄송합니다. 서버 처리 중 오류가 발생했습니다: ${error.message}` },
      { status: 500 }
    );
  }
}
