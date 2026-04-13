import { useState } from 'react';
import { BudgetCategory } from '@/types';
import { extractTextFromPdfBuffer } from '@/lib/pdf-parser';
import { askLlama } from '@/lib/llm-client';

export interface UseBudgetAIProps {
  categories: BudgetCategory[];
  onSuccess: (data: {
    categoryId?: string;
    amount?: string;
    purpose?: string;
    docNum?: string;
    date?: string;
  }) => void;
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
당신은 보건진흥과 예산 문서를 분석하여 아래 JSON 스키마로 정확하게 반환하는 스마트 스캐너입니다.
[사용 가능한 예산 카테고리 목록]
${categoryOptions}

다음 규칙을 엄격히 준수하세요:
1. 문서 내용에서 '지출 금액(원)', '사용 목적(적요)', 그리고 문맥상 완벽히 일치하는 예산 '항목(통계목)'을 찾아보세요.
2. 예산 과목 매칭: 위 목록 중 가장 관련성 높은 통계목(예: 사무관리비, 공공운영비 등 여비)을 찾아 그 항목에 해당하는 정확한 "ID"를 추출해야 합니다. 
3. 응답할 JSON은 반드시 'reasoning' 필드를 맨 처음 작성하여 지출 목적과 통계목 매칭의 논리적 이유를 스스로 설명한 뒤에 'categoryId' 등 나머지 필드를 작성하세요.
4. 금액은 숫자만 추출. 목적은 20자 이내로 요약.
5. 문서 하단 "시행 [문서번호] (날짜)" 패턴을 찾아 "시행 문서 번호"(예: 보건행정과-1234)와 해당 문서를 시행한 "날짜"(예: 2026-04-10)를 우선적으로 추출.
6. 응답은 오직 순수한 JSON 객체 문자열이어야 하며, 마크다운이나 백틱이 없어야 합니다.
형식: {"reasoning": "지출 목적이 XX이므로 YY항목이 적합함", "categoryId": "정확한ID", "amount": 1234, "purpose": "요약", "docNum": "보건행정과-123", "date": "2026-04-10"}
      `.trim();

      const responseText = await askLlama([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `[문서 원문]\n${text}\n\n위 문서를 분석하여 반드시 지정된 JSON 형식으로만 응답해.` }
      ]);

      let jsonStr = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      let result: any = null;

      try {
        result = JSON.parse(jsonStr);
      } catch (e1) {
        // 단일 객체 매칭 (첫번째 { } 블록)
        const objMatch = jsonStr.match(/\{[\s\S]*?\}/);
        // 배열 매칭 (첫번째 [ ] 블록)
        const arrMatch = jsonStr.match(/\[[\s\S]*?\]/);
        
        let parsed = false;
        if (arrMatch) {
          try {
            result = JSON.parse(arrMatch[0]);
            parsed = true;
          } catch(e) {}
        }
        
        if (!parsed && objMatch) {
          try {
            result = JSON.parse(objMatch[0]);
            parsed = true;
          } catch(e) {}
        }
        
        if (!parsed) {
          // 마지막 시도: 전체를 둘러보는 광범위 매칭
          const startIdx = jsonStr.indexOf('{');
          const endIdx = jsonStr.lastIndexOf('}');
          if (startIdx !== -1 && endIdx !== -1) {
            result = JSON.parse(jsonStr.substring(startIdx, endIdx + 1));
          } else {
            throw new Error('유효한 JSON 묶음을 찾을 수 없습니다.');
          }
        }
      }

      if (Array.isArray(result)) {
        if (result.length > 1) {
          alert(`여러 건(${result.length}건)의 내역이 분석되었습니다! 현재 폼에는 첫 번째 내역만 자동으로 입력됩니다.`);
        }
        result = result[0] || {};
      }

      const extractedData: Parameters<typeof onSuccess>[0] = {};

      if (result.categoryId) {
        let matchedCat = categories.find(c => c.id === String(result.categoryId).trim());
        
        if (!matchedCat) {
          const catStr = String(result.categoryId).trim().toLowerCase();
          
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
      
      if (result.amount) {
        const amtStr = result.amount.toString().replace(/[^0-9]/g, '');
        if (amtStr) extractedData.amount = Number(amtStr).toLocaleString('ko-KR');
      }
      if (result.purpose) {
        extractedData.purpose = result.purpose.substring(0, 30);
      }
      
      let finalDocNum = result.docNum || '';
      let finalDate = (result.date && /^\d{4}-\d{2}-\d{2}$/.test(result.date)) ? result.date : '';

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

      onSuccess(extractedData);
      alert('✅ AI가 지출 품의서를 성공적으로 분석하여 폼을 채웠습니다.');
    } catch (err: any) {
      console.error('PDF 파싱 오류:', err);
      alert('문서 분석에 실패했습니다. 형식 오류 또는 네트워크 문제일 수 있습니다.\n상세오류: ' + (err.message || '알 수 없는 오류'));
    } finally {
      setIsParsingPdf(false);
      e.target.value = '';
    }
  };

  return { isParsingPdf, handlePdfUpload };
}
