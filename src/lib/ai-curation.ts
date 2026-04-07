import { askLlama, ChatMessage } from './llm-client';

export interface CurationResult {
  tags: string[];
  relatedKeywords: string[];
}

/**
 * Cloudflare Workers AI (Llama 3)를 활용하여 수신된 신규 시그널/텍스트에 대한
 * 가장 적합한 카테고리(tags)와 관련 키워드(관결 연결 노드 후보)를 추출합니다.
 */
export async function curateSignal(
  text: string,
  existingTags: string[],
  existingKeywords: string[]
): Promise<CurationResult> {
  const prompt = `
당신은 고도로 훈련된 데이터 큐레이터이자 시그널 온톨로지 분석 엔진입니다.
새로운 텍스트 데이터가 들어오면, 기존 지식 그래프의 태그(카테고리) 및 키워드 목록을 참조하여
가장 적절한 태그 1~2개와 강하게 연결되는 세부 키워드 최대 3개를 추천해야 합니다.

[기존 시스템 태그 (카테고리)]
${existingTags.join(', ') || '(없음)'}

[기존 세부 키워드]
${existingKeywords.join(', ') || '(없음)'}

[새로운 입력 시그널]
"${text}"

응답은 반드시 아래 JSON 스키마를 엄격하게 따르는 순수 JSON 문자열만 반환해야 합니다. 다른 어떤 설명이나 마크다운 틱(\`\`\`)도 포함하지 마세요. 태그나 키워드는 기존 배열에서 선택하는 것을 최우선으로 하되, 입력 내용이 고유하다면 새 단어를 제안할 수도 있습니다.
{
  "tags": ["추천카테고리1"],
  "relatedKeywords": ["의존성키워드1", "의존성키워드2"]
}
`;

  try {
    const messages: ChatMessage[] = [
      { role: 'user', content: prompt }
    ];

    const responseText = await askLlama(messages);
    
    // 로컬 Mock 응답일 경우 JSON 파싱을 피하기 위한 Fallback
    if (responseText.includes('[Mock AI Response]')) {
      return {
        tags: ['로컬 테스트 태그'],
        relatedKeywords: ['테스트키워드1']
      };
    }

    // AI가 반환한 문자열에서 JSON 부분만 추출 (때때로 코멘트를 붙이거나 마크다운을 쓸 때를 대비)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Valid JSON sequence not found in AI response.');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      relatedKeywords: Array.isArray(parsed.relatedKeywords) ? parsed.relatedKeywords : []
    };
  } catch (error) {
    console.error('AI Curation Failed:', error);
    // 실패 시 빈 배열을 반환하여 파이프라인(Ontology) 오류를 방지합니다
    return { tags: [], relatedKeywords: [] };
  }
}
