const originalResponse = `*   User query: "시드테크 연락처" (Contact information for SeedTech).
    *   Role: Professional AI assistant for VITAL portfolio.
    *   Constraint 1: No reasoning, instructions, or system prompts in output.
    *   Constraint 2: Korean only.
    *   Constraint 3: Use provided [DATABASE].
    *   Constraint 4: Use numbering (1., 2.) or hyphens (-), avoid markdown bold/italic (**, *).

    *   Node: 시드테크 (SeedTech)
    *   Contact: 010-9876-5432
    *   Person in charge: 이상혁 이사 (Director Sang-hyuk Lee)
    *   Email: shlee@seedtech.com

    *   Draft:
        시드테크의 연락처 정보입니다.
        1. 담당자: 이상혁 이사
        2. 연락처: 010-9876-5432
        3. 이메일: shlee@seedtech.com

    *   No reasoning/system prompts? Yes.
    *   Korean only? Yes.
    *   Based on database? Yes.
    *   Numbering/hyphens used? Yes.
    *   No markdown bold/italic? Yes.시드테크의 연락처 정보입니다.

1. 담당자: 이상혁 이사
2. 연락처: 010-9876-5432
3. 이메일: shlee@seedtech.com`;

function cleanGemmaResponseV1(text) {
  if (!text) return '';
  const regex = /[.a-zA-Z\)]\s*([가-힣][가-힣\s\!\?\.\,\~\d]*)$/;
  const match = text.match(regex);
  if (match && match[1]) {
    return match[1].trim();
  }

  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line && !line.startsWith('*') && /[가-힣]/.test(line)) {
      return line.trim();
    }
  }
  return text.trim();
}

function cleanGemmaResponseV2(text) {
  if (!text) return '';
  
  // 1. [Yy]es. 뒤에 오는 첫 한글 문자부터 텍스트 끝까지 매칭
  const regex = /[Yy]es\.\s*([가-힣][\s\S]*)$/;
  const match = text.match(regex);
  if (match && match[1]) {
    return match[1].trim();
  }

  // 2. 만약 Yes. 패턴이 없는 경우, 영어 생각 단계가 끝나는 패턴을 찾음.
  const lines = text.split('\n');
  let startIdx = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/[가-힣]/.test(line) && !line.trim().startsWith('*')) {
      if (!line.includes('User query') && !line.includes('Draft') && !line.includes('Constraint')) {
        startIdx = i;
        break;
      }
    }
  }
  
  if (startIdx > 0) {
    return lines.slice(startIdx).join('\n').trim();
  }

  return text.trim();
}

function cleanGemmaResponseV3(text) {
  if (!text) return '';

  // 1. [Yy]es. 뒤에 오는 첫 한글 문자부터 텍스트 끝까지 매칭
  const regex = /[Yy]es\.\s*([가-힣][\s\S]*)$/;
  const match = text.match(regex);
  if (match) {
    return match[1].trim();
  }

  // 2. 만약 Yes. 가 없다면, 텍스트에서 뒤쪽의 순수 답변 부분을 추출.
  const lines = text.split('\n');
  let bodyStartIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (
      /[가-힣]/.test(trimmed) && 
      !trimmed.startsWith('*') && 
      !trimmed.includes('User query:') &&
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
    return lines.slice(bodyStartIdx).join('\n').trim();
  }

  return text.trim();
}

console.log('=== V1 RESULT ===');
console.log(cleanGemmaResponseV1(originalResponse));
console.log('\n=== V2 RESULT ===');
console.log(cleanGemmaResponseV2(originalResponse));
console.log('\n=== V3 RESULT ===');
console.log(cleanGemmaResponseV3(originalResponse));
