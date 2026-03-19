/**
 * Budget Document Parser
 * 기안문 텍스트에서 지출 품의/결의 정보를 자동 추출합니다.
 * 
 * 추출 항목:
 * - 건명 (title)
 * - 지급액 (amount)
 * - 업체명 (vendorName)
 * - 사업자등록번호 (vendorRegNo)
 * - 관련문서 (relatedDoc)
 * - 예산과목 (budgetAccount)
 * - 지급방법 (paymentMethod)
 */

export interface ParsedBudgetDoc {
  title: string;          // 건명
  amount: number;         // 지급액 (원)
  amountText: string;     // 금액 원문 (금492,000원)
  vendorName: string;     // 업체명/지급처
  vendorRegNo: string;    // 사업자등록번호
  relatedDoc: string;     // 관련문서 번호
  budgetAccount: string;  // 예산과목
  paymentMethod: string;  // 지급방법
  memo: string;           // 기타 메모 (지급내역 등)
  confidence: number;     // 파싱 신뢰도 0~1
}

/**
 * 기안문 텍스트를 파싱하여 구조화된 지출 정보를 추출합니다.
 */
export function parseBudgetDocument(text: string): ParsedBudgetDoc | null {
  if (!text || text.trim().length < 10) return null;

  const lines = text.trim();
  let confidence = 0;

  // 1. 건명 추출  — "가. 건    명 : ..." 또는 "건명:" 패턴
  const titleMatch = lines.match(/(?:가\.\s*)?건\s*명\s*[:：]\s*(.+?)(?:\n|$)/);
  const title = titleMatch ? titleMatch[1].trim() : '';
  if (title) confidence += 0.2;

  // 2. 금액 추출  — "나. 지 급 액 : 금492,000원" 또는 "금액:" 등
  let amount = 0;
  let amountText = '';
  
  const amountPatterns = [
    /(?:나\.\s*)?지\s*급\s*액\s*[:：]\s*(.+?)(?:\n|$)/,
    /(?:금\s*액|지급금액|총\s*액)\s*[:：]\s*(.+?)(?:\n|$)/,
  ];
  
  for (const pat of amountPatterns) {
    const m = lines.match(pat);
    if (m) {
      amountText = m[1].trim();
      // Extract numeric amount: "금492,000원" → 492000
      const numMatch = amountText.match(/금?\s*([\d,]+)\s*원/);
      if (numMatch) {
        amount = parseInt(numMatch[1].replace(/,/g, ''));
        confidence += 0.2;
      }
      break;
    }
  }

  // Fallback: look for any 금N,NNN원 pattern
  if (!amount) {
    const fallbackAmount = lines.match(/금?\s*([\d,]{3,})\s*원/);
    if (fallbackAmount) {
      amount = parseInt(fallbackAmount[1].replace(/,/g, ''));
      amountText = fallbackAmount[0];
      confidence += 0.1;
    }
  }

  // 3. 업체명/지급처 추출  — "라. 지 급 처 : ㈜거성디지털"
  let vendorName = '';
  const vendorPatterns = [
    /(?:라\.\s*)?지\s*급\s*처\s*[:：]\s*(.+?)(?:\s*\(|\n|$)/,
    /(?:업\s*체\s*명|거래처|납품업체)\s*[:：]\s*(.+?)(?:\s*\(|\n|$)/,
  ];
  for (const pat of vendorPatterns) {
    const m = lines.match(pat);
    if (m) {
      vendorName = m[1].trim();
      confidence += 0.15;
      break;
    }
  }

  // 4. 사업자등록번호 추출  — "등록번호 : 206-86-59520" 또는 "(NNN-NN-NNNNN)"
  let vendorRegNo = '';
  const regNoMatch = lines.match(/(?:등록번호|사업자[등록]*\s*번호)\s*[:：]?\s*(\d{3}-\d{2}-\d{5})/);
  if (regNoMatch) {
    vendorRegNo = regNoMatch[1];
    confidence += 0.1;
  } else {
    // Fallback: standalone pattern
    const regNoFallback = lines.match(/(\d{3}-\d{2}-\d{5})/);
    if (regNoFallback) vendorRegNo = regNoFallback[1];
  }

  // 5. 관련문서 추출  — "보건행정과-1141(2026.01.29.)호"
  let relatedDoc = '';
  const docMatch = lines.match(/([가-힣]+과-\d+\(\d{4}\.\d{2}\.\d{2}\.\)호)/);
  if (docMatch) {
    relatedDoc = docMatch[1];
    confidence += 0.1;
  } else {
    // Fallback: "XX과-NNNN" pattern
    const docFallback = lines.match(/([가-힣]+과-\d+)/);
    if (docFallback) relatedDoc = docFallback[1];
  }

  // 6. 예산과목 추출  — "바. 예산과목 : ..." 
  let budgetAccount = '';
  const budgetPatterns = [
    /(?:바\.\s*)?예\s*산\s*과\s*목\s*[:：]\s*(.+?)(?:\n|$)/,
    /예산(?:편성)?과목\s*[:：]\s*(.+?)(?:\n|$)/,
  ];
  for (const pat of budgetPatterns) {
    const m = lines.match(pat);
    if (m) {
      budgetAccount = m[1].trim();
      confidence += 0.15;
      break;
    }
  }

  // 7. 지급방법 추출  — "마. 지급방법 : ..."
  let paymentMethod = '';
  const payMethodPatterns = [
    /(?:마\.\s*)?지\s*급\s*방\s*법\s*[:：]\s*(.+?)(?:\n|$)/,
    /지급\s*방법\s*[:：]\s*(.+?)(?:\n|$)/,
  ];
  for (const pat of payMethodPatterns) {
    const m = lines.match(pat);
    if (m) {
      paymentMethod = m[1].trim();
      confidence += 0.1;
      break;
    }
  }

  // 8. 메모: 지급내역 추출
  let memo = '';
  const memoMatch = lines.match(/(?:다\.\s*)?지\s*급\s*내\s*역\s*[:：]\s*(.+?)(?:\n|$)/);
  if (memoMatch) {
    memo = memoMatch[1].trim();
  }

  // If barely anything was extracted, return null
  if (confidence < 0.2) return null;

  // Fallback title: first meaningful sentence if no 건명 found
  let finalTitle = title;
  if (!finalTitle) {
    // Try to extract from purpose context
    const purposeMatch = lines.match(/위한\s+(.+?)을|를?\s*(구매|지급|구입|납품|집행)/);
    if (purposeMatch) {
      finalTitle = purposeMatch[0].replace(/을$|를$/, '').trim();
    } else {
      // Use first non-number line as title
      const firstLine = lines.split('\n').find(l => l.trim().length > 5 && !/^\d+\./.test(l.trim()));
      if (firstLine) finalTitle = firstLine.trim().slice(0, 50);
    }
  }

  return {
    title: finalTitle,
    amount,
    amountText,
    vendorName,
    vendorRegNo,
    relatedDoc,
    budgetAccount,
    paymentMethod,
    memo,
    confidence: Math.min(1, confidence),
  };
}
