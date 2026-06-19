import { promises as fs } from 'fs';
import fsNonPromise from 'fs';
import path from 'path';
import { execFile, execSync } from 'child_process';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { webcrypto } from 'crypto';
import os from 'os';

const PIN = '0509';
const CRYPTO_SALT = new TextEncoder().encode('HCHPS-E2EE-SALT');

async function getMasterKey() {
  const encoder = new TextEncoder();
  const keyMaterial = await webcrypto.subtle.importKey(
    'raw',
    encoder.encode(PIN),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  return await webcrypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: CRYPTO_SALT, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptData(data: any): Promise<string> {
  const masterKey = await getMasterKey();
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  
  const ciphertext = await webcrypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    plaintext
  );
  
  const payload = new Uint8Array(iv.length + ciphertext.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(ciphertext), iv.length);
  
  return Buffer.from(payload.buffer).toString('base64');
}

async function decryptData(encryptedBase64: string): Promise<any> {
  const masterKey = await getMasterKey();
  const payloadBuffer = Buffer.from(encryptedBase64, 'base64');
  const iv = payloadBuffer.subarray(0, 12);
  const ciphertext = payloadBuffer.subarray(12);
  
  const decryptedBuffer = await webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    ciphertext
  );
  
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decryptedBuffer));
}

async function ensureClassificationWords() {
  const wordsFilePath = path.join(process.cwd(), 'data', 'CLASSIFICATION_WORDS.json');
  try {
    await fs.access(wordsFilePath);
  } catch {
    // 파일이 없으면 초기화 생성
    const defaultData = {
      agents: [
        "오창선", "김형종", "신진성", "김은주", "김태환",
        "담당자", "본부장", "과장", "팀장", "주무관", "소장", "선생님",
        "인수자", "인계자", "입회자", "팀장대직"
      ],
      resources: [
        "예산", "비용", "구매", "임대", "비품", "지출", "단가", "집행액",
        "지출잔액", "예산현액", "불용", "용역비", "계약", "수익", "차액"
      ],
      executions: [
        "회의", "개발", "도입", "시스템", "프로그램", "검사", "체크업", "센터", "검진",
        "업무", "캠페인", "챌린지", "조례", "행사", "교육", "계획", "성과관리", "보고",
        "인계", "인수"
      ]
    };
    
    try {
      const encrypted = await encryptData(defaultData);
      const dbPayload = [
        {
          id: "classification_rules",
          _enc: encrypted
        }
      ];
      await fs.mkdir(path.dirname(wordsFilePath), { recursive: true });
      await fs.writeFile(wordsFilePath, JSON.stringify(dbPayload, null, 2), 'utf-8');
      console.info('[Watcher Daemon] CLASSIFICATION_WORDS 초기 템플릿 생성 완료 (E2EE 암호화 적용).');
    } catch (e) {
      console.error('[Watcher Daemon] CLASSIFICATION_WORDS 초기화 실패:', e);
    }
  }
}


// 시스템의 정확한 Desktop 경로 획득 (특히 윈도우 환경)
function getDesktopPath(): string {
  try {
    if (process.platform === 'win32') {
      const stdout = execSync('powershell -Command "[Environment]::GetFolderPath(\'Desktop\')"', { encoding: 'utf-8' });
      const pathStr = stdout.trim();
      if (pathStr) return pathStr;
    }
  } catch (e) {
    console.warn('[Watcher Daemon] PowerShell을 통한 Desktop 경로 획득 실패, 기본값 사용:', e);
  }
  return path.join(os.homedir(), 'Desktop');
}

const WATCH_DIR = path.join(getDesktopPath(), 'VITAL_Scan');
const DB_FILE = path.join(process.cwd(), 'data', 'MAP_CUSTOMIZATION.json');
const apiKey = process.env.GOOGLE_GEMINI_API_KEY || '';

// Next.js 핫 리로딩으로 인한 중복 감시자 생성 및 유실 방지 (싱글톤)
const globalForWatcher = global as unknown as {
  activeJobs?: Map<string, NodeJS.Timeout>;
  fileSizes?: Map<string, number>;
  watcher?: any;
};

if (!globalForWatcher.activeJobs) {
  globalForWatcher.activeJobs = new Map<string, NodeJS.Timeout>();
}
if (!globalForWatcher.fileSizes) {
  globalForWatcher.fileSizes = new Map<string, number>();
}

const activeJobs = globalForWatcher.activeJobs;
const fileSizes = globalForWatcher.fileSizes;



/**
 * 전용 폴더가 존재하지 않을 경우 자동 생성
 */
async function ensureWatchDirectory() {
  try {
    await fs.mkdir(WATCH_DIR, { recursive: true });
    console.info(`[Watcher Daemon] 감시 폴더 준비 완료: ${WATCH_DIR}`);
  } catch (err) {
    console.error(`[Watcher Daemon] 감시 폴더 생성 실패: ${WATCH_DIR}`, err);
  }
}

/**
 * 3D 수직 적층 레이어 효과를 극대화하기 위해
 * 추출된 노드에 알맞은 group과 layerId를 지능형 추론하여 보완합니다.
 */
function patchNodeLayers(nodes: any[]) {
  const layerLabels: Record<number, string> = {
    0: 'CORE_PROJECT',    // 인물 -> 핵심 키워드로 분류
    1: 'INFRASTRUCTURE',  // 예산/비품 -> 기초 키워드 분류
    2: 'MACRO_RESEARCH',  // 업무/회의 -> 주요 키워드 분류
    3: 'DATA_PIPELINE'    // 위키/문서 -> 일반 키워드 분류
  };

  return nodes.map(node => {
    let layerId = 3;
    if (node.layerId !== undefined && node.layerId !== null) {
      layerId = Number(node.layerId);
    } else {
      // 텍스트 매칭을 통한 추론
      const label = node.label || '';
      const id = node.id || '';
      if (/[가-힣]+ (이사|대리|부장|과장|사원|담당|대표|팀장|주임)/.test(label) || label.endsWith('님') || id.startsWith('user_') || id.includes('person')) {
        layerId = 0;
      } else if (label.includes('예산') || label.includes('비용') || label.includes('구매') || label.includes('임대') || label.includes('비품') || label.includes('원') || id.includes('budget') || id.includes('inventory')) {
        layerId = 1;
      } else if (label.includes('회의') || label.includes('개발') || label.includes('추진') || label.includes('기획') || label.includes('구축') || label.includes('작업') || id.startsWith('task-') || id.startsWith('project-') || id.startsWith('meeting-')) {
        layerId = 2;
      }
    }

    return {
      ...node,
      layerId,
      group: node.group || layerLabels[layerId] || 'OTHER',
      baseValue: node.baseValue || 80,
      centralityScore: 100
    };
  });
}

/**
 * 추출 완료된 시맨틱 그래프 데이터를 로컬 SSOT DB(MAP_CUSTOMIZATION.json)에 병합 저장합니다.
 */
async function mergeToLocalDatabase(extracted: { nodes: any[]; edges: any[] }) {
  try {
    let dbData: any[] = [];
    try {
      const fileData = await fs.readFile(DB_FILE, 'utf-8');
      dbData = JSON.parse(fileData);
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }

    // Find existing singleton (either encrypted or plaintext)
    let singleton = dbData.find(item => item.id === 'singleton');

    // Decrypt existing state if _enc exists, otherwise initialize empty
    let decryptedPayload: any = {
      overrides: {},
      customNodes: [],
      customEdges: [],
      deletedEdges: []
    };

    if (singleton) {
      if (singleton._enc) {
        try {
          decryptedPayload = await decryptData(singleton._enc);
        } catch (decErr) {
          console.error('[Watcher Daemon] MAP_CUSTOMIZATION 복호화 실패, 초기화 진행:', decErr);
        }
      } else {
        // Plaintext fallback for legacy/migration
        if (singleton.overrides) decryptedPayload.overrides = singleton.overrides;
        if (singleton.customNodes) decryptedPayload.customNodes = singleton.customNodes;
        if (singleton.customEdges) decryptedPayload.customEdges = singleton.customEdges;
        if (singleton.deletedEdges) decryptedPayload.deletedEdges = singleton.deletedEdges;
      }
    }

    if (!decryptedPayload.overrides) decryptedPayload.overrides = {};
    if (!decryptedPayload.customNodes) decryptedPayload.customNodes = [];
    if (!decryptedPayload.customEdges) decryptedPayload.customEdges = [];
    if (!decryptedPayload.deletedEdges) decryptedPayload.deletedEdges = [];

    const customNodesMap = new Map<string, any>(decryptedPayload.customNodes.map((n: any) => [n.id, n]));
    const customEdgesMap = new Map<string, any>(decryptedPayload.customEdges.map((e: any) => [`${e.source}|||${e.target}`, e]));
    const deletedEdgesSet = new Set<string>(decryptedPayload.deletedEdges);

    let nodesAdded = 0;
    let edgesAdded = 0;

    // 1. 노드 병합
    const patchedNodes = patchNodeLayers(extracted.nodes || []);
    patchedNodes.forEach(node => {
      if (!node.id) return;
      if (!customNodesMap.has(node.id)) {
        customNodesMap.set(node.id, node);
        nodesAdded++;
      }
    });

    // 2. 엣지(관계) 병합
    const edges = extracted.edges || [];
    edges.forEach(edge => {
      if (!edge.source || !edge.target) return;
      const edgeId = `${edge.source}|||${edge.target}`;
      const reverseId = `${edge.target}|||${edge.source}`;

      // 무덤(Tombstone)이 있다면 자동 해제
      if (deletedEdgesSet.has(edgeId)) deletedEdgesSet.delete(edgeId);
      if (deletedEdgesSet.has(reverseId)) deletedEdgesSet.delete(reverseId);

      if (!customEdgesMap.has(edgeId) && !customEdgesMap.has(reverseId)) {
        customEdgesMap.set(edgeId, {
          source: edge.source,
          target: edge.target,
          weight: edge.weight ?? 1.0,
          type: edge.type ?? 'DEPENDENCY'
        });
        edgesAdded++;
      }
    });

    decryptedPayload.customNodes = Array.from(customNodesMap.values());
    decryptedPayload.customEdges = Array.from(customEdgesMap.values());
    decryptedPayload.deletedEdges = Array.from(deletedEdgesSet);

    // Re-encrypt the merged payload
    const encrypted = await encryptData(decryptedPayload);
    
    // Clear top-level plaintext fields and remove any old duplicates by reconstructing dbData
    const newSingleton = {
      id: 'singleton',
      _enc: encrypted
    };

    dbData = dbData.filter(item => item.id !== 'singleton');
    dbData.push(newSingleton);

    // 원자적 파일 저장 및 자동 3중 백업망 가동
    const tempPath = `${DB_FILE}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(dbData, null, 2), 'utf-8');
    await fs.rename(tempPath, DB_FILE);

    console.info(`[Watcher Daemon] 시맨틱 자동 융합 성공 (E2EE 암호화 적용)! 추가된 노드: ${nodesAdded}개, 관계: ${edgesAdded}개`);

    // 백업 폴더 기동 (Next.js route.ts 복제)
    const backupDir = path.join(process.cwd(), 'data', 'backups', 'MAP_CUSTOMIZATION');
    await fs.mkdir(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.writeFile(path.join(backupDir, `${timestamp}_MAP_CUSTOMIZATION.json`), JSON.stringify(dbData, null, 2), 'utf-8');

  } catch (err) {
    console.error('[Watcher Daemon] 로컬 데이터베이스 병합 저장 오류:', err);
  }
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

/**
 * Gemini API를 다이렉트로 호출하여 텍스트로부터 노드 및 SPO 관계를 자동 추출
 */
async function processAISemanticExtraction(text: string) {
  if (!apiKey) {
    console.warn('[Watcher Daemon] GOOGLE_GEMINI_API_KEY가 없습니다. AI 추출이 불가능합니다.');
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const systemPrompt = `당신은 비정형 문서 텍스트로부터 핵심 개체(Node)와 이들의 관계(Edge)를 추출하여 시맨틱 온톨로지 지식 그래프를 구성하는 데이터 추출기입니다.
제공된 텍스트를 정밀 분석하고, 반드시 다음 JSON 형식에 정확히 매칭되는 구조화된 데이터를 생성해 주세요.

<RULES>
1. 답변은 다른 생각이나 서론, 결론 없이 오직 유효한 단일 JSON 문자열만 출력해야 합니다. 마크다운의 \`\`\`json 이나 \`\`\` 마크업도 절대 포함하지 말고, 순수한 JSON 괄호로 시작해 괄호로 끝나도록 하세요.
2. 노드의 layerId 판정 기준:
   - 0: 인물 (직원명, 담당관, 부서, 외부 기관명 등)
   - 1: 예산/비품 (금액, 예산 계정, 구매 비품, 장비 임대비 등)
   - 2: 업무/회의 (수행 태스크, 과제, 회의록 제목, 추진 일련 활동 등)
   - 3: 위키/문서 (참조할 지식 문서명, 보고서 파일명 등)
3. 텍스트에 나타나지 않은 가상의 사실을 과도하게 생성하지 마세요. 본문에 직접적으로 등장하는 개체와 관계 위주로 정확하게 요약하세요.
</RULES>

사용자 텍스트:
${text}
`;
  let result: any = null;
  try {
    const maxRetries = 6;
    let attempt = 0;
    let delay = 8000;

    while (attempt < maxRetries) {
      try {
        attempt++;
        const model = genAI.getGenerativeModel({
          model: 'gemini-3.5-flash',
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseSchema: responseSchema
          }
        });
        result = await model.generateContent(systemPrompt);
        break;
      } catch (apiErr: any) {
        console.warn(`[Watcher Daemon] Gemini API 호출 실패 (시도 ${attempt}/${maxRetries}):`, apiErr.message || apiErr);
        if (attempt >= maxRetries) {
          throw apiErr;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }

    if (!result) return;
    let cleaned = result.response.text().trim();
    
    if (cleaned.startsWith('```') || cleaned.includes('```')) {
      cleaned = cleaned.replace(/```json/gi, '').replace(/```/g, '').trim();
    }

    // { 로 시작해서 } 로 끝나는 JSON 본체만 정교하게 슬라이싱
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      cleaned = cleaned.substring(startIdx, endIdx + 1);
    }

    const parsed = JSON.parse(cleaned);
    if (parsed && Array.isArray(parsed.nodes)) {
      await mergeToLocalDatabase(parsed);

      // ── CLASSIFICATION_WORDS 동적 실시간 학습 병합 ──
      try {
        let wordsData = { agents: [] as string[], resources: [] as string[], executions: [] as string[] };
        const wordsFilePath = path.join(process.cwd(), 'data', 'CLASSIFICATION_WORDS.json');
        try {
          const raw = await fs.readFile(wordsFilePath, 'utf-8');
          const parsedJson = JSON.parse(raw);
          if (parsedJson && parsedJson[0] && parsedJson[0]._enc) {
            wordsData = await decryptData(parsedJson[0]._enc);
          }
        } catch (e: any) {
          if (e.code !== 'ENOENT') console.error('[Watcher Daemon] CLASSIFICATION_WORDS 복호화 실패:', e);
        }
        
        let wordsChanged = false;
        const agentsSet = new Set(wordsData.agents || []);
        const resourcesSet = new Set(wordsData.resources || []);
        const executionsSet = new Set(wordsData.executions || []);
        
        (parsed.nodes || []).forEach((n: any) => {
          const label = n.label || '';
          const layerId = Number(n.layerId ?? 3);
          
          if (label.length >= 2 && /[가-힣]/.test(label)) {
            if (layerId === 0 && !agentsSet.has(label)) {
              agentsSet.add(label);
              wordsChanged = true;
            } else if (layerId === 1 && !resourcesSet.has(label)) {
              resourcesSet.add(label);
              wordsChanged = true;
            } else if (layerId === 2 && !executionsSet.has(label)) {
              executionsSet.add(label);
              wordsChanged = true;
            }
          }
        });
        
        if (wordsChanged) {
          wordsData.agents = Array.from(agentsSet);
          wordsData.resources = Array.from(resourcesSet);
          wordsData.executions = Array.from(executionsSet);
          
          const encrypted = await encryptData(wordsData);
          const dbPayload = [
            {
              id: "classification_rules",
              _enc: encrypted
            }
          ];
          
          const tempPath = `${wordsFilePath}.tmp`;
          await fs.writeFile(tempPath, JSON.stringify(dbPayload, null, 2), 'utf-8');
          await fs.rename(tempPath, wordsFilePath);
          console.info(`[Watcher Daemon] CLASSIFICATION_WORDS 동적 학습 완료! Agents: ${wordsData.agents.length}개, Resources: ${wordsData.resources.length}개, Executions: ${wordsData.executions.length}개`);
          
          // 백업 폴더 기동
          const backupDir = path.join(process.cwd(), 'data', 'backups', 'CLASSIFICATION_WORDS');
          await fs.mkdir(backupDir, { recursive: true });
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          await fs.writeFile(path.join(backupDir, `${timestamp}_CLASSIFICATION_WORDS.json`), JSON.stringify(dbPayload, null, 2), 'utf-8');
        }
      } catch (wordErr) {
        console.error('[Watcher Daemon] CLASSIFICATION_WORDS 병합 중 오류:', wordErr);
      }
    }
  } catch (err) {
    console.error('[Watcher Daemon] Gemini AI 세그먼트 관계 추출 오류:', err);
    try {
      if (result) {
        console.error('[Watcher Daemon] 실패한 원본 AI 응답:', result.response.text());
      }
    } catch {}
  }
}

/**
 * 파일 복사가 완전히 끝난 시점을 판정해 파이프라인 가동
 */
const pendingFiles: string[] = [];
let isProcessingQueue = false;

async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (pendingFiles.length > 0) {
    const filePath = pendingFiles.shift();
    if (filePath) {
      try {
        console.info(`[Watcher Daemon] 순차 큐 처리 시작: ${path.basename(filePath)}`);
        await processFile(filePath);
        // API 요청 간에 최소 20초의 여유 간격을 두어 RPM/QPS 제한 방지 및 동기화 무결성 확보
        await new Promise(resolve => setTimeout(resolve, 20000));
      } catch (err) {
        console.error(`[Watcher Daemon] 순차 큐 파일 처리 에러: ${filePath}`, err);
      }
    }
  }

  isProcessingQueue = false;
}

function processFile(filePath: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const ext = path.extname(filePath).toLowerCase();
      if (!['.pdf', '.hwpx', '.txt', '.xlsx', '.xls', '.md', '.csv', '.json'].includes(ext)) {
        return resolve();
      }

      console.info(`[Watcher Daemon] 실시간 새 문서 탐지 완료: ${path.basename(filePath)}`);

      // 1. 파이썬 fast_parser.py 호출
      const pythonScript = path.join(process.cwd(), 'scripts', 'fast_parser.py');
      
      execFile('python', [pythonScript, filePath], { maxBuffer: 1024 * 1024 * 10 }, async (error, stdout, stderr) => {
        if (error) {
          console.error(`[Watcher Daemon] 파이프라인 파일 파싱 실패: ${filePath}`, error, stderr);
          return resolve();
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          if (parsed.success && parsed.content) {
            console.info(`[Watcher Daemon] 파일 파싱 성공 (크기: ${parsed.content.length}자).`);
            console.info(`[Watcher Daemon] [Self-Learning Pipeline] AI 자동 키워드 학습 루프 가동 중...`);
            // 최대 30000자까지 확장하여 대규모 텍스트 파일에서도 누락 없이 풍부한 온톨로지 지식 추출 및 분류 자가 학습 수행
            await processAISemanticExtraction(parsed.content.substring(0, 30000));
          } else {
            console.error(`[Watcher Daemon] 파서 실패 응답: ${parsed.error}`);
          }
        } catch (e) {
          console.error('[Watcher Daemon] 파서 출력 JSON 변환 오류:', e);
        }
        resolve();
      });

    } catch (e) {
      console.error('[Watcher Daemon] 파이프라인 수행 실패:', e);
      resolve();
    }
  });
}

/**
 * 파일 복사 완료 대기용 안정성 루프
 */
function queueFileEvent(filePath: string) {
  if (activeJobs.has(filePath)) {
    clearTimeout(activeJobs.get(filePath));
  }

  const checkSize = async () => {
    try {
      const stat = await fs.stat(filePath);
      const prevSize = fileSizes.get(filePath) || 0;
      
      if (stat.size === prevSize && stat.size > 0) {
        // 크기가 변하지 않음 -> 복사 완료로 간주
        activeJobs.delete(filePath);
        fileSizes.delete(filePath);
        pendingFiles.push(filePath);
        processQueue().catch(err => console.error('[Watcher Daemon] 순차 큐 실행 에러:', err));
      } else {
        // 크기가 여전히 커지는 중 -> 1초 뒤 재시도
        fileSizes.set(filePath, stat.size);
        const timer = setTimeout(checkSize, 1000);
        activeJobs.set(filePath, timer);
      }
    } catch {
      // 파일 삭제 등의 이벤트인 경우 정리
      activeJobs.delete(filePath);
      fileSizes.delete(filePath);
    }
  };

  const timer = setTimeout(checkSize, 1000);
  activeJobs.set(filePath, timer);
}

/**
 * 데몬 시작 함수
 */
export async function startWatcherDaemon() {
  // 기존에 구동 중이던 watcher가 있다면 리로드 대응을 위해 안전하게 닫기
  if (globalForWatcher.watcher) {
    try {
      globalForWatcher.watcher.close();
      console.info('[Watcher Daemon] 기존 파일 감시자 인스턴스를 안전하게 종료하고 재기동합니다.');
    } catch {}
  }

  await ensureWatchDirectory();
  await ensureClassificationWords();

  // 기존에 이미 폴더에 있던 파일들을 읽어서 처리 (사용자가 미리 넣어둔 파일 대응)
  try {
    const existingFiles = await fs.readdir(WATCH_DIR);
    for (const file of existingFiles) {
      const fullPath = path.join(WATCH_DIR, file);
      const stat = await fs.stat(fullPath);
      if (stat.isFile()) {
        const ext = path.extname(file).toLowerCase();
        if (['.pdf', '.hwpx', '.txt', '.xlsx', '.xls', '.md', '.csv', '.json'].includes(ext)) {
          console.info(`[Watcher Daemon] 기존 파일 감지: ${file}, 복사 상태 확인 시작`);
          queueFileEvent(fullPath);
        }
      }
    }
  } catch (err) {
    console.error('[Watcher Daemon] 기존 파일 목록 로드 실패:', err);
  }

  console.info('[Watcher Daemon] 윈도우 바탕화면 파일 감시 서비스 기동 완료.');
  console.info(`[Watcher Daemon] 실시간 감시 대상 폴더: ${WATCH_DIR}`);

  // fs.watch로 폴더 실시간 감시
  // Windows에서는 recursive 옵션이 안정적으로 작동
  const watcher = fsNonPromise.watch(WATCH_DIR, { recursive: false }, (eventType, filename) => {
    if (!filename) return;
    const fullPath = path.join(WATCH_DIR, filename as string);

    if (eventType === 'rename') {
      // 파일이 새로 생성되었거나 이름이 바뀐 경우
      fs.access(fullPath)
        .then(() => {
          queueFileEvent(fullPath);
        })
        .catch(() => {
          // 파일이 삭제된 경우는 무시
        });
    }
  });

  // 전역 싱글톤 보관
  globalForWatcher.watcher = watcher;

  // 프로세스 종료 시 watcher 닫기
  process.on('SIGINT', () => {
    watcher.close();
    globalForWatcher.watcher = null;
  });
  process.on('SIGTERM', () => {
    watcher.close();
    globalForWatcher.watcher = null;
  });
}
