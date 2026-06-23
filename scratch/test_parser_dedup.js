const originalDuplicateResponse = `*   User query: "시드테크 연락처" (Contact information for SeedTech).
    *   Role: Professional AI assistant for VITAL portfolio.
    *   Constraints:
        1.  No reasoning, instructions, or system prompts in output.
        2.  Korean only (no English).
        3.  Based on [DATABASE].
        4.  Use numbering (1., 2.) or hyphens (-) for readability.
        5.  Avoid markdown symbols like \`**\` or \`*\`.
        6.  Direct answer only.

    *   Node: 시드테크
    *   Contact: 01079249151
    *   Person in charge: 이상혁 이사님

    *   Format: Numbering or hyphens.
    *   No bolding.
    *   Korean only.

    Draft:
    1. 담당자: 이상혁 이사님
    2. 연락처: 010792491511. 담당자: 이상혁 이사님
2. 연락처: 01079249151`;

function cleanGemmaResponseDeduplicated(text) {
  if (!text) return '';

  // 1. [Yy]es. 뒤에 즉시 또는 공백 후 시작되는 첫 한글 문자부터 끝까지 추출
  const regex = /[Yy]es\.\s*([가-힣][\s\S]*)$/;
  const match = text.match(regex);
  let rawContent = '';
  
  if (match && match[1]) {
    rawContent = match[1].trim();
  } else {
    // 2. Yes. 가 없는 경우, 한글 시작 라인 찾기
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

  // 3. 중복 제거 필터 적용:
  // 들여쓰기(공백)로 시작하는 라인은 CoT 또는 Draft 내부 라인으로 간주하여 제거하고, 
  // 들여쓰기가 없는 라인(진짜 본문)만 모읍니다.
  const finalLines = rawContent.split('\n').map(line => {
    // 만약 라인의 첫 부분이 공백 문자 2개 이상으로 시작한다면, CoT 내부로 간주하여 필터링
    if (/^\s{2,}/.test(line)) {
      return null;
    }
    // 본문의 앞쪽 공백이 한 칸 정도 있는 것은 허용
    return line;
  }).filter(line => line !== null);

  // 4. 추가 핫픽스: 한 줄 내에 '010792491511. 담당자: 이상혁 이사님'과 같이 붙어 있는 중복 패턴을 분할 및 고침
  // 만약 숫자 바로 뒤에 '1.' 또는 '2.' 과 같이 새로운 마크다운 인덱스가 달라붙어 있다면 줄바꿈 처리
  let cleanedContent = finalLines.join('\n').trim();
  cleanedContent = cleanedContent.replace(/(\d+)([1-9]\.\s+[가-힣])/g, '$1\n$2');

  // 중복 라인 자체를 최종 소거 (중복 paragraph 방지)
  const paragraphLines = cleanedContent.split('\n');
  const uniqueLines = [];
  const seen = new Set();
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

console.log('=== Raw Duplicated Response ===');
console.log(originalDuplicateResponse);
console.log('\n=== Cleaned & Deduplicated Response ===');
console.log(cleanGemmaResponseDeduplicated(originalDuplicateResponse));
