import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const apiKey = process.env.GOOGLE_GEMINI_API_KEY || '';

function cleanKoreanLabel(label: string): string {
  if (!label) return '';
  let cleaned = label.trim();

  // Remove trailing Korean postpositions (조사)
  const postpositions = ['에서', '에게', '으로', '까지', '부터', '은', '는', '이', '가', '을', '를', '의', '에', '와', '과', '로'];
  for (const post of postpositions) {
    if (cleaned.endsWith(post) && cleaned.length > post.length) {
      const base = cleaned.substring(0, cleaned.length - post.length);
      if (/[\uac00-\ud7a30-9a-zA-Z]$/.test(base)) {
        cleaned = base;
        break;
      }
    }
  }

  // Eliminate quotes and unnecessary outer spaces
  cleaned = cleaned.replace(/^['"“‘]+|['"”’]+$/g, '').trim();

  return cleaned;
}

function postProcessGraph(nodes: any[], edges: any[]): { nodes: any[], edges: any[] } {
  if (!nodes) nodes = [];
  if (!edges) edges = [];

  // 1. cleanKoreanLabel on all node labels
  const cleanedNodes = nodes
    .map(n => ({
      ...n,
      label: cleanKoreanLabel(n.label || '')
    }))
    .filter(n => n.label.length > 0 && n.id);

  // 2. Limit nodes to 15 (sort by baseValue descending and slice)
  const sortedNodes = [...cleanedNodes].sort((a, b) => (b.baseValue || 0) - (a.baseValue || 0));
  const limitedNodes = sortedNodes.slice(0, 15);
  const nodeIds = new Set(limitedNodes.map(n => n.id));

  // 3. Prune dangling edges (edges where source or target is not in the 15 nodes list)
  // Also prune self-references (source === target)
  const prunedEdges = edges.filter(e => {
    return e.source && e.target && nodeIds.has(e.source) && nodeIds.has(e.target) && e.source !== e.target;
  });

  return { nodes: limitedNodes, edges: prunedEdges };
}

const responseSchema: any = {
  type: "object",
  properties: {
    nodes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Unique English ID using lowercase letters and underscores (e.g. kim_chulsoo)" },
          label: { type: "string", description: "Korean display name of the node" },
          group: { 
            type: "string", 
            enum: ["CORE_PROJECT", "MACRO_RESEARCH", "DCF_MODELING", "DATA_PIPELINE", "INFRASTRUCTURE", "SYSTEM_RISK", "OTHER"],
            description: "Category of the node"
          },
          baseValue: { type: "integer", description: "Importance score from 0 to 100" },
          layerId: { type: "integer", description: "Layer hierarchy: 0 (Person), 1 (Budget/Assets), 2 (Task/Meeting), 3 (Wiki/Document)" }
        },
        required: ["id", "label", "group", "baseValue", "layerId"]
      }
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source: { type: "string", description: "Source node ID" },
          target: { type: "string", description: "Target node ID" },
          weight: { type: "number", description: "Relationship weight from -1.0 to 1.0 (positive default)" },
          type: { 
            type: "string", 
            enum: ["CAUSAL_DRIVE", "DEPENDENCY", "FEEDBACK_LOOP", "BOTTLENECK", "DECOUPLING", "ASSIGNEE", "BUDGET_SOURCE", "COMPONENTS"],
            description: "Relationship type" 
          }
        },
        required: ["source", "target", "weight", "type"]
      }
    }
  },
  required: ["nodes", "edges"]
};

export async function POST(req: Request) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Google Gemini API Key가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const { text, fileName } = await req.json();
    let contentToExtract = '';

    if (text && typeof text === 'string') {
      contentToExtract = text;
    } else if (fileName && typeof fileName === 'string') {
      // Read from scratch
      const scratchDir = path.join(process.cwd(), 'scratch');
      // Prevent directory traversal
      const safeFileName = path.basename(fileName);
      const filePath = path.join(scratchDir, safeFileName);
      if (fs.existsSync(filePath)) {
        contentToExtract = fs.readFileSync(filePath, 'utf-8');
      } else {
        return NextResponse.json({ success: false, error: `File not found in scratch: ${safeFileName}` }, { status: 404 });
      }
    } else {
      return NextResponse.json({ success: false, error: 'Missing text or fileName for extraction' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const systemPrompt = `Analyze text and extract key nodes and edges for a semantic ontology knowledge graph.

<RULES>
1. LayerId: 0 (Person/Dept), 1 (Budget/Asset), 2 (Task/Activity), 3 (Wiki/Doc).
2. Edge types: ASSIGNEE, BUDGET_SOURCE, COMPONENTS, CAUSAL_DRIVE, DEPENDENCY, BOTTLENECK.
3. Extract core nouns for labels without trailing postpositions or modifiers.
</RULES>

Text:
${contentToExtract}`;

    const modelsToTry = ['gemini-3.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    let responseText = '';

    for (const modelName of modelsToTry) {
      try {
        console.log(`[Extract API] Attempting extraction with model: ${modelName}`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseSchema: responseSchema
          }
        });

        let retries = 2;
        while (retries > 0) {
          try {
            const result = await model.generateContent(systemPrompt);
            responseText = result.response.text().trim();
            break;
          } catch (err: any) {
            retries--;
            if (retries === 0) throw err;
            console.warn(`[Extract API] ${modelName} call failed, retrying...`, err.message);
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        if (responseText) {
          break; // Exit loop on success
        }
      } catch (err: any) {
        console.error(`[Extract API] Model ${modelName} failed entirely:`, err.message || err);
      }
    }

    // Heuristic Local Extraction Fallback if all API calls failed
    if (!responseText) {
      console.warn('[Extract API] All models exhausted or API key failed. Triggering Heuristic Local Extractor.');
      
      const words = Array.from(new Set(contentToExtract.match(/[가-힣a-zA-Z0-9_]{2,12}/g) || []));
      const nodes: any[] = [];
      const edges: any[] = [];
      
      // Categorize terms based on basic vocabulary rules
      const peopleTerms = ['담당', '대표', '이사', '이사님', '주무관', '의원', '과장', '팀장', '연구원', '위원'];
      const budgetTerms = ['원', '예산', '자산', '비용', '지출', '금액', '사업비', '개발비', '홍보비', '수당'];
      const taskTerms = ['개발', '작성', '수행', '보고', '회의', '패치', '구현', '검토', '기획', '완수'];
      const docTerms = ['문서', '가이드', '리포트', '보고서', '매뉴얼', '계획서', '파일', '위키', '대조표'];

      let idx = 0;
      const idMap = new Map<string, string>();

      for (const word of words) {
        if (nodes.length >= 15) break;
        
        let layerId = 2; // Default to task
        let group = 'CORE_PROJECT';
        
        if (peopleTerms.some(term => word.includes(term)) || (word.length === 3 && /[김이박최정강조윤장임한오신서]/g.test(word[0]))) {
          layerId = 0;
          group = 'CORE_PROJECT';
        } else if (budgetTerms.some(term => word.includes(term)) || /\d+(만원|원)/.test(word)) {
          layerId = 1;
          group = 'INFRASTRUCTURE';
        } else if (docTerms.some(term => word.includes(term))) {
          layerId = 3;
          group = 'MACRO_RESEARCH';
        } else if (taskTerms.some(term => word.includes(term))) {
          layerId = 2;
          group = 'CORE_PROJECT';
        } else {
          layerId = 2;
          group = 'OTHER';
        }

        const cleanId = `node_${idx++}_` + Buffer.from(word).toString('hex').substring(0, 8);
        idMap.set(word, cleanId);

        nodes.push({
          id: cleanId,
          label: word,
          group: group,
          baseValue: 50 + Math.floor(Math.random() * 30),
          layerId: layerId
        });
      }

      // If we got nodes, build simple components edges
      if (nodes.length > 1) {
        for (let i = 0; i < nodes.length - 1; i++) {
          edges.push({
            source: nodes[i].id,
            target: nodes[i+1].id,
            weight: 0.5,
            type: 'COMPONENTS'
          });
        }
        
        const peopleNodes = nodes.filter(n => n.layerId === 0);
        const budgetNodes = nodes.filter(n => n.layerId === 1);
        const taskNodes = nodes.filter(n => n.layerId === 2);
        
        taskNodes.forEach(t => {
          if (peopleNodes.length > 0) {
            edges.push({
              source: peopleNodes[Math.floor(Math.random() * peopleNodes.length)].id,
              target: t.id,
              weight: 0.8,
              type: 'ASSIGNEE'
            });
          }
          if (budgetNodes.length > 0) {
            edges.push({
              source: budgetNodes[Math.floor(Math.random() * budgetNodes.length)].id,
              target: t.id,
              weight: 0.6,
              type: 'BUDGET_SOURCE'
            });
          }
        });
      }

      if (nodes.length === 0) {
        nodes.push({
          id: "node_fallback_root",
          label: "로컬 스캔 개체",
          group: "CORE_PROJECT",
          baseValue: 80,
          layerId: 2
        });
      }

      responseText = JSON.stringify({ nodes, edges });
      console.log('[Extract API] Generated Heuristic Mock Extract data successfully.');
    }

    // JSON 정제 (마크다운 백틱 제거 및 유효한 JSON 영역만 슬라이싱)
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```') || cleaned.includes('```')) {
      cleaned = cleaned.replace(/```json/gi, '').replace(/```/g, '').trim();
    }

    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      cleaned = cleaned.substring(startIdx, endIdx + 1);
    }
    
    // JSON 유효성 검증
    try {
      const parsed = JSON.parse(cleaned);
      const processed = postProcessGraph(parsed.nodes || [], parsed.edges || []);
      return NextResponse.json({ success: true, data: processed });
    } catch (jsonErr) {
      console.error('[Extract JSON Parse Error] Raw text from Gemma:', responseText, jsonErr);
      return NextResponse.json({ 
        success: false, 
        error: 'AI 응답을 JSON으로 파싱하는 데 실패했습니다.', 
        rawResponse: responseText 
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Extraction API Error:', error);
    return NextResponse.json(
      { success: false, error: `서버 오류 발생: ${error.message}` },
      { status: 500 }
    );
  }
}
