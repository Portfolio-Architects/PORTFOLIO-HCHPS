import { useState } from 'react';
import { BudgetCategory } from '@/types';
import { extractTextFromPdfBuffer } from '@/lib/pdf-parser';
import { askLlama } from '@/lib/llm-client';

export interface UseBudgetAIProps {
  categories: BudgetCategory[];
  onSuccess: (dataArray: Array<{
    categoryId?: string;
    amount?: string;
    purpose?: string;
    docNum?: string;
    date?: string;
    isPlanned?: boolean;
  }>) => void;
}

export function useBudgetAI({ categories, onSuccess }: UseBudgetAIProps) {
  const [isParsingPdf, setIsParsingPdf] = useState(false);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingPdf(true);
    try {
      const buffer = await file.arrayBuffer();
      const text = await extractTextFromPdfBuffer(buffer);

      const categoryOptions = categories.map(c => `ID: ${c.id} | 분류: ${c.policyProject} > ${c.unitProject} > ${c.detailedProject} | 항목: ${c.statItem} | 별칭: ${c.name}`).join('\n');
      
      const systemPrompt = `
당신은 보건진흥과 기안서(지출품의/계획서)를 분석하여 아래 JSON 배열(Array) 스키마로 정확하게 반환하는 스마트 스캐너입니다. 문서는 여러 건의 지출 계획을 포함할 수 있습니다.
[사용 가능한 예산 카테고리 목록]
${categoryOptions}

다음 규칙을 엄격히 준수하세요:
1. 문서 내용에서 지출할 '예정/지출 금액(원)', '사용 목적(적요, 산출내역)', 그리고 '항목(통계목)'을 모두 찾아 배열객체로 만듭니다.
2. 각 항목별로 위 카테고리 목록 중 가장 관련성 높은 통계목을 찾아 정확한 "categoryId"를 입력합니다.
3. 응답할 JSON은 반드시 최상위가 배열 '[' 로 시작하여야 합니다.
4. 금액은 숫자만 추출. 목적은 20자 이내로 요약.
5. 문서 하단 "시행 [문서번호] (날짜)" 패턴을 찾아 "docNum"(예: 보건행정과-1234)과 "date"(예: 2026-04-10)를 공통으로 묶어 각 객체에 동일하게 넣어줍니다.
6. 응답은 오직 순수한 JSON 배열 문자열이어야 하며, 마크다운이나 백틱, 기타 설명이 절대 없어야 합니다.
형식: 
[
  {"reasoning": "이유설명", "categoryId": "정확한ID", "amount": 1234, "purpose": "A업체 결제", "docNum": "보행-12", "date": "2026-04-10", "isPlanned": true},
  {"reasoning": "이유설명", "categoryId": "정확한ID", "amount": 5678, "purpose": "B물품 구입", "docNum": "보행-12", "date": "2026-04-10", "isPlanned": true}
]
      `.trim();

      const responseText = await askLlama([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `[문서 원문]\n${text}\n\n위 문서를 분석하여 반드시 지정된 배열(Array) 형식의 JSON으로만 응답해.` }
      ]);

      let jsonStr = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      let parsedData: unknown = null;

      try {
        parsedData = JSON.parse(jsonStr);
      } catch (e) {
        console.warn('1차 파싱 실패. 복구 시도:', e);
        
        let parsed = false;
        const arrayStart = jsonStr.indexOf('[');
        const arrayEnd = jsonStr.lastIndexOf(']');
        if (arrayStart !== -1 && arrayEnd !== -1) {
          try {
            parsedData = JSON.parse(jsonStr.substring(arrayStart, arrayEnd + 1));
            parsed = true;
          } catch (e2) {}
        }
        
        if (!parsed) {
          // 마지막 시도: 전체를 둘러보는 광범위 매칭
          const startIdx = jsonStr.indexOf('{');
          const endIdx = jsonStr.lastIndexOf('}');
          if (startIdx !== -1 && endIdx !== -1) {
            parsedData = JSON.parse(jsonStr.substring(startIdx, endIdx + 1));
          } else {
            throw new Error('유효한 JSON 묶음을 찾을 수 없습니다.');
          }
        }
      }

      let result: Record<string, unknown>[] = [];
      if (!Array.isArray(parsedData)) {
        if (parsedData) result = [parsedData as Record<string, unknown>];
      } else {
        result = parsedData as Record<string, unknown>[];
      }

      const extractedArray: Parameters<typeof onSuccess>[0] = [];

      for (let rawItem of result) {
        const item = rawItem as Record<string, string | undefined>;
        const extractedData: {
          categoryId?: string;
          amount?: string;
          purpose?: string;
          docNum?: string;
          date?: string;
          isPlanned?: boolean;
        } = { isPlanned: true };

        if (item.categoryId) {
          let matchedCat = categories.find(c => c.id === String(item.categoryId).trim());
          
          if (!matchedCat) {
            const catStr = String(item.categoryId).trim().toLowerCase();
            
            matchedCat = categories.find(c => {
              const hasStat = c.statItem && (catStr.includes(c.statItem.split('(')[0].trim().toLowerCase()) || catStr.includes(c.statItem.replace(/[^0-9-]/g, '')));
              const prefix = c.name ? c.name.split('-')[0].trim().substring(0, 6).toLowerCase() : '';
              const hasProj = (c.unitProject && catStr.includes(c.unitProject.toLowerCase())) ||
                              (prefix && catStr.includes(prefix));
              return hasStat && hasProj;
            });

            if (!matchedCat) {
              matchedCat = categories.find(c => 
                c.name.toLowerCase() === catStr ||
                c.name.toLowerCase().includes(catStr) ||
                catStr.includes(c.name.toLowerCase())
              );
            }
          }

          if (!matchedCat) {
            const rawText = text.replace(/\s+/g, '').toLowerCase();
            const scoredCats = categories.map(c => {
              let score = 0;
              const statWord = c.statItem ? c.statItem.split('(')[0].trim().toLowerCase() : '';
              const statNum = c.statItem ? c.statItem.replace(/[^0-9-]/g, '') : '';
              if (statWord && rawText.includes(statWord)) score += 10;
              if (statNum && rawText.includes(statNum)) score += 10;

              const prefix = c.name ? c.name.split('-')[0].trim().substring(0, 6).toLowerCase().replace(/\s+/g, '') : '';
              const unit = c.unitProject ? c.unitProject.toLowerCase().replace(/\s+/g, '') : '';
              if (unit && rawText.includes(unit)) score += 5;
              if (prefix && rawText.includes(prefix)) score += 5;

              return { cat: c, score };
            });

            const bestMatches = scoredCats.filter(sc => sc.score >= 15).sort((a, b) => b.score - a.score);
            if (bestMatches.length > 0) {
              matchedCat = bestMatches[0].cat;
            }
          }

          if (matchedCat) {
            extractedData.categoryId = matchedCat.id;
          }
        }
        
        if (item.amount) {
          const amtStr = item.amount.toString().replace(/[^0-9]/g, '');
          if (amtStr) extractedData.amount = Number(amtStr).toLocaleString('ko-KR');
        }
        if (item.purpose) {
          extractedData.purpose = item.purpose.substring(0, 30);
        }
        
        let finalDocNum = item.docNum || '';
        let finalDate = (item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) ? item.date : '';

        const docRegex = /시행[\s\n]*([가-힣a-zA-Z0-9]+-\d+)[\s\n]*\([\s\n]*(\d{4})\.[\s\n]*(\d{1,2})\.[\s\n]*(\d{1,2})\.[\s\n]*\)/;
        const docMatch = text.match(docRegex);
        if (docMatch) {
          finalDocNum = docMatch[1];
          const year = docMatch[2];
          const month = docMatch[3].padStart(2, '0');
          const day = docMatch[4].padStart(2, '0');
          finalDate = `${year}-${month}-${day}`;
        }

        if (finalDocNum) extractedData.docNum = finalDocNum;
        if (finalDate) extractedData.date = finalDate;

        extractedArray.push(extractedData);
      }

      onSuccess(extractedArray);
      alert(`✅ AI가 지출 품의서를 성공적으로 분석하여 ${extractedArray.length}건의 예정 내역을 스캔했습니다.`);
    } catch (err: unknown) {
      console.error('PDF 파싱 오류:', err);
      alert('문서 분석에 실패했습니다. 형식 오류 또는 네트워크 문제일 수 있습니다.\n상세오류: ' + (err instanceof Error ? err.message : '알 수 없는 오류'));
    } finally {
      setIsParsingPdf(false);
      e.target.value = '';
    }
  };

  return { isParsingPdf, handlePdfUpload };
}
