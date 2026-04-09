import * as pdfjsLib from 'pdfjs-dist';

// CND 기반 Worker 로드 (Next.js 빌드 오류 회피 및 브라우저 호환성)
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * ArrayBuffer 형식의 PDF 파일 데이터에서 텍스트를 추출합니다.
 */
export async function extractTextFromPdfBuffer(buffer: ArrayBuffer): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdfOutput = await loadingTask.promise;
  
  const numPages = pdfOutput.numPages;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfOutput.getPage(pageNum);
    const content = await page.getTextContent();
    // 텍스트 아이템들을 공백으로 병합
    const textItems = content.items
      .filter((item): item is import('pdfjs-dist/types/src/display/api').TextItem => 'str' in item)
      .map(item => item.str);
    
    pageTexts.push(textItems.join(' '));
  }

  // 너무 긴 문서일 경우 LLM 토큰 압박을 방지하기 위해 앞쪽 3,000자 까지만 자릅니다
  // 비용 지출 품의서는 대개 1페이지 이내에 중요 내용이 들어있음
  return pageTexts.join('\n\n').slice(0, 3000);
}
