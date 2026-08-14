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
        const fileContent = fs.readFileSync(filePath, 'utf-8').slice(0, 2000);

        console.log(`[File Radar API] Generating summary/contacts for untracked file: ${fName}`);

        let generatedData = null;
        if (apiKey) {
          try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            
            const prompt = `Analyze document and output JSON only.
Format:
{
  "displayName": "사업 명칭 (15자 내외)",
  "summary": ["요약 1줄", "요약 2줄", "요약 3줄"],
  "contacts": [{"name": "이름", "role": "직무", "phone": "전화번호"}]
}

Content:
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
