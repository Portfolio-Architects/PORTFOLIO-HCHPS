import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_GEMINI_API_KEY || '';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const nodeLabel = searchParams.get('nodeLabel') || '';
    const nodeId = searchParams.get('nodeId') || '';

    if (!nodeLabel) {
      return NextResponse.json({ files: [] });
    }

    const scratchDir = path.join(process.cwd(), 'scratch');
    const cachePath = path.join(process.cwd(), 'data', 'FILE_RADAR_CACHE.json');

    // 1. Read existing cache
    let cache: Record<string, any> = {};
    if (fs.existsSync(cachePath)) {
      try {
        cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      } catch (err) {
        console.error('[File Radar API] Error reading cache file:', err);
      }
    }

    // 2. Scan scratch/ directory for text files
    if (!fs.existsSync(scratchDir)) {
      return NextResponse.json({ files: [] });
    }

    const files = fs.readdirSync(scratchDir);
    const textFiles = files.filter(f => 
      (f.endsWith('.txt') || f.endsWith('.md')) && 
      !f.endsWith('decrypted.json') &&
      !f.endsWith('matches.txt') &&
      !f.endsWith('results.txt') &&
      !f.endsWith('xml_text.txt')
    );

    // 3. Keyword-based matching
    const queryWords = nodeLabel.split(/[\s,()]+/).filter(w => w.length >= 2);
    const matchedFiles: Array<{ fileName: string; score: number }> = [];

    for (const fileName of textFiles) {
      const filePath = path.join(scratchDir, fileName);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        let score = 0;

        // Exact match score
        if (content.includes(nodeLabel)) {
          score += 60;
        }

        // Overlapping keywords score
        queryWords.forEach(word => {
          const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          const matches = content.match(regex);
          if (matches) {
            score += matches.length * 3;
          }
        });

        if (score > 4) {
          matchedFiles.push({ fileName, score });
        }
      } catch (err) {
        console.error(`[File Radar API] Error reading file ${fileName}:`, err);
      }
    }

    // Sort by score descending and take top 3
    const topFiles = matchedFiles
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    // 4. Retrieve or generate summary and contacts for each matched file
    const resultFiles = [];
    let cacheUpdated = false;

    for (const matched of topFiles) {
      const fName = matched.fileName;
      let fileData = cache[fName];

      if (!fileData) {
        // Fallback to local AI generation if cache does not exist
        const filePath = path.join(scratchDir, fName);
        const fileContent = fs.readFileSync(filePath, 'utf-8').slice(0, 4000); // 4k characters max

        console.log(`[File Radar API] Generating summary/contacts for untracked file: ${fName}`);

        let generatedData = null;
        if (apiKey) {
          try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            
            const prompt = `당신은 보건행정 및 보건사업 문서 요약 전문가입니다. 다음 문서 내용을 분석하여 반드시 지정된 JSON 형식으로만 출력하십시오. 다른 설명문이나 코드블록 마크다운(\`\`\`json) 기호 등은 일절 제외하고 순수 JSON 문자열만 출력하십시오.
            
            지정된 JSON 형식:
            {
              "displayName": "사업 명칭을 간략히 정리한 한글 표시명 (15자 내외)",
              "summary": [
                "사업의 핵심 목적이나 주 내용 3줄 요약 중 첫 번째 줄",
                "예산 규모, 장소 또는 추진 일정 등 3줄 요약 중 두 번째 줄",
                "기대 효과 및 주요 실행 상세 내용 등 3줄 요약 중 세 번째 줄"
              ],
              "contacts": [
                {
                  "name": "담당 주무관 또는 팀장 이름 (식별 가능할 경우 기입, 없으면 생략)",
                  "role": "담당 직무 및 역할 (예: 주무관 (장비 조달))",
                  "phone": "전화번호 (예: 02-3423-XXXX)"
                }
              ]
            }
            
            문서 내용:
            ${fileContent}`;

            const res = await model.generateContent(prompt);
            const rawText = res.response.text().trim();
            // strip markdown markers if any
            const jsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            generatedData = JSON.parse(jsonText);
          } catch (aiErr) {
            console.error(`[File Radar API] Gemini generation failed for ${fName}:`, aiErr);
          }
        }

        if (generatedData && generatedData.displayName && Array.isArray(generatedData.summary)) {
          fileData = generatedData;
          cache[fName] = fileData;
          cacheUpdated = true;
        } else {
          // Hardcoded fallback summary if AI fails
          const cleanDisplayName = fName.replace('_extracted.txt', '').replace('.txt', '').replace('.md', '');
          fileData = {
            displayName: cleanDisplayName,
            summary: [
              `${cleanDisplayName} 관련 업무 추진 및 관리 문서입니다.`,
              "로컬 텍스트 데이터를 분석하여 키워드 매칭을 완료했습니다.",
              "세부 내용은 문서를 직접 조회하거나 위키 및 주간보고 모듈에서 참고하세요."
            ],
            contacts: [
              { "name": "보건행정과", "role": "담당 주무관", "phone": "02-3423-3000" }
            ]
          };
        }
      }

      resultFiles.push({
        fileName: fName,
        displayName: fileData.displayName || fName.replace('_extracted.txt', '').replace('.txt', '').replace('.md', ''),
        summary: fileData.summary,
        contacts: fileData.contacts || []
      });
    }

    // Save cache back to file if updated
    if (cacheUpdated) {
      try {
        fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
      } catch (writeErr) {
        console.error('[File Radar API] Error writing updated cache:', writeErr);
      }
    }

    return NextResponse.json({
      nodeId,
      nodeLabel,
      files: resultFiles
    });

  } catch (err: any) {
    console.error('[File Radar API] GET error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
