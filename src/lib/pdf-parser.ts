/**
 * ArrayBuffer 형식의 PDF 파일 데이터에서 텍스트를 추출합니다.
 * 
 * @param buffer - 파싱할 PDF 파일의 ArrayBuffer 데이터.
 * @returns 추출된 PDF 텍스트 문자열 (최대 2,000자 제한).
 * 
 * @remarks
 * - 브라우저 환경에서만 `pdfjs-dist` 모듈을 게으르게 로드하여 Next.js 빌드 시 발생하는 `DOMMatrix is not defined` 에러를 방지합니다.
 * - 긴 문서의 경우 LLM 토큰 압박(Cloudflare 9002 Error)을 방지하기 위해 앞부분 2,000자만 추출합니다.
 * 
 * @throws {Error} PDF 문서 파싱 중 텍스트 추출에 실패하거나 버퍼가 손상된 경우 오류를 던집니다.
 */
export async function extractTextFromPdfBuffer(buffer: ArrayBuffer): Promise<string> {
  // 클라이언트(브라우저) 환경에서만 모듈을 게으르게 로드합니다.
  // Next.js SSR/SSG 빌드 시 'DOMMatrix is not defined' 에러 방지
  const pdfjsLib = await import('pdfjs-dist');
  
  // CDN 기반 Worker 로드 (Next.js 빌드 오류 회피 및 브라우저 호환성)
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdfOutput = await loadingTask.promise;
  
  const numPages = pdfOutput.numPages;
  const pageTexts: string[] = [];
  let totalLength = 0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfOutput.getPage(pageNum);
    const content = await page.getTextContent();
    
    const pageChunks: string[] = [];
    for (let i = 0; i < content.items.length; i++) {
      const item = content.items[i];
      if (item && 'str' in item && typeof (item as { str: unknown }).str === 'string') {
        pageChunks.push((item as { str: string }).str);
      }
    }
    
    const pageText = pageChunks.join(' ');
    pageTexts.push(pageText);
    totalLength += pageText.length;

    // 조기 중단: 이미 2,500자를 초과 수집했으면 추가 페이지 렌더링/디코딩 스킵
    if (totalLength >= 2500) {
      break;
    }
  }

  // 너무 긴 문서일 경우 LLM 토큰 압박(Cloudflare 9002 Error 방지)을 위해 앞쪽 2,000자 까지만 자릅니다
  return pageTexts.join('\n\n').slice(0, 2000);
}
