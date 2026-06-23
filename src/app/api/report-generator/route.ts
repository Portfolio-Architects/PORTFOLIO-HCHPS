import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_GEMINI_API_KEY || '';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { nodeLabel, wikiText, budgetData, tasks, files } = payload;

    if (!nodeLabel) {
      return NextResponse.json({ error: 'Node label is required' }, { status: 400 });
    }

    const scratchDir = path.join(process.cwd(), 'scratch');
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }

    let reportContent = '';

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `당신은 보건행정 및 지자체 공문서 작성 전문 AI 비서입니다. 제공된 사업 데이터를 활용하여 지자체/보건소의 공식 기안 행정 보고서 양식에 맞춘 고품질 보고서 초안을 작성하십시오.
        격식 있고 전문적인 공공기관 어조를 사용하고, 개조식 구조('-', '*', '※')를 적극 활용하십시오.
        
        [제공된 사업 데이터]
        - 사업명: ${nodeLabel}
        - 위키 정보: ${wikiText || '등록된 위키 정보 없음'}
        - 연동 예산 현황:
          * 총 예산: ${budgetData?.total?.toLocaleString() || 0}원
          * 집행 완료액: ${budgetData?.executed?.toLocaleString() || 0}원
          * 남은 차액: ${budgetData?.remaining?.toLocaleString() || 0}원
          * 집행률: ${budgetData?.rate || 0}%
        - 관련 태스크 및 추진 일정:
          ${JSON.stringify(tasks || [])}
        - 연관 수집 문서 요약 (시맨틱 레이더):
          ${JSON.stringify(files || [])}
        
        [보고서 요구 스키마]
        다음 목차 구조를 완벽한 마크다운 문서로 작성하십시오:
        
        # [보고] ${nodeLabel} 사업 추진 현황 및 종합 행정 보고서
        
        ## 1. 추진 배경 및 필요성
        (위키 정보와 수집된 문서들을 바탕으로 왜 이 사업이 추진되어야 하는지 명확하고 설득력 있게 서술)
        
        ## 2. 사업 개요 및 범위
        - 사업 기간: 연중 추진
        - 주요 내용: (위키 내용 및 태스크를 종합 요약)
        
        ## 3. 예산 집행 현황 (종합 대조)
        | 구분 | 예산 규모 (원) | 실 집행액 (원) | 집행 잔액 (원) | 집행률 (%) |
        | --- | --- | --- | --- | --- |
        | 본 사업비 | (총 예산) | (실 집행액) | (남은 차액) | (집행률) |
        
        ※ 지출 관련 특이 사항 및 집행 효율화 전략 기입.
        
        ## 4. 세부 업무 추진 실적 및 관련 문서
        ### 가. 주요 추진 실적 (태스크 목록을 토대로 작성)
        - (완료된 업무 및 진행 중인 업무 상태 분류 기재)
        ### 나. 연계 현안 보고서 및 회의록 분석 (수집된 파일들의 요약 반영)
        - (어떤 파일들이 바인딩되었고 핵심 요약이 무엇인지 간략 서술)
        
        ## 5. 향후 추진 계획 및 기대 효과
        - (향후 계획 및 기대효과 3줄 내외 정리)
        `;

        const res = await model.generateContent(prompt);
        reportContent = res.response.text().trim();
      } catch (aiErr) {
        console.error('[Report Generator API] Gemini call failed:', aiErr);
      }
    }

    // Fallback template if Gemini fails or API key is not present
    if (!reportContent) {
      const totalStr = budgetData?.total?.toLocaleString() || '0';
      const execStr = budgetData?.executed?.toLocaleString() || '0';
      const remStr = budgetData?.remaining?.toLocaleString() || '0';
      const rateStr = budgetData?.rate || '0';

      reportContent = `# [보고] ${nodeLabel} 사업 추진 현황 및 종합 행정 보고서

## 1. 추진 배경 및 필요성
- 본 보고서는 ${nodeLabel} 사업의 효율적인 기획 및 집행 관리를 위해 작성된 행정 초안입니다.
- 로컬 파일 시스템 내의 시맨틱 분석 결과 및 업무 데이터베이스(SSOT)의 예산/태스크 연계를 토대로 종합 검토를 수행하였습니다.

## 2. 사업 개요 및 범위
- **사업명:** ${nodeLabel}
- **주요 내용:**
  - ${wikiText || '지정된 상세 위키 설명이 아직 등록되지 않았습니다.'}

## 3. 예산 집행 현황 (종합 대조)
| 구분 | 예산 규모 (원) | 실 집행액 (원) | 집행 잔액 (원) | 집행률 (%) |
| --- | --- | --- | --- | --- |
| 본 사업비 | ${totalStr}원 | ${execStr}원 | ${remStr}원 | ${rateStr}% |

※ 집행 계획에 따른 예비 재원 전용 및 이용 검토가 필요할 수 있습니다.

## 4. 세부 업무 추진 실적 및 관련 문서
### 가. 주요 추진 실적 (태스크)
${(tasks && tasks.length > 0)
  ? tasks.map((t: any) => `- [${t.isCompleted ? '완료' : '진행'}] ${t.title || t.text}`).join('\n')
  : '- 연동된 추진 실적(태스크) 데이터가 없습니다.'}

### 나. 연계 현안 보고서 및 회의록 분석 (시맨틱 레이더)
${(files && files.length > 0)
  ? files.map((f: any) => `- **문서명:** ${f.displayName}\n  - *핵심 요약:* ${f.summary?.join(' / ') || '내용 없음'}`).join('\n')
  : '- 연동된 로컬 보고서 파일 정보가 없습니다.'}

## 5. 향후 추진 계획 및 기대 효과
- **추진 관리:** 정기적인 예산 대조 및 마감 현황 관리를 통한 불용액 최소화.
- **기대 효과:** 사업 성과 다각화 및 실무 추진 담당자 정합성 강화를 통한 업무 신뢰도 제고.
`;
    }

    // Save report draft to scratch/
    const safeNodeLabel = nodeLabel.replace(/[\\/:*?"<>|]/g, '_');
    const fileName = `${safeNodeLabel}_행정보고서_초안.md`;
    const filePath = path.join(scratchDir, fileName);

    fs.writeFileSync(filePath, reportContent, 'utf-8');
    console.log(`[Report Generator API] Successfully saved report draft to: ${filePath}`);

    return NextResponse.json({
      success: true,
      fileName,
      content: reportContent
    });

  } catch (err: any) {
    console.error('[Report Generator API] POST error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
