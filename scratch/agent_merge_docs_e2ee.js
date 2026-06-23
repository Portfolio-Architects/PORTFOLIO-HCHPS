const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');

const DB_FILE = path.join(__dirname, '..', 'data', 'MAP_CUSTOMIZATION.json');
const pin = '0509';
const SALT = new TextEncoder().encode('HCHPS-E2EE-SALT');

const extractedData = {
  nodes: [
    { id: "hong_jongnam", label: "홍종남 (보건행정과장)", group: "CORE_PROJECT", baseValue: 90, layerId: 0 },
    { id: "kim_jaeeun", label: "김재은 (건강증진팀장)", group: "CORE_PROJECT", baseValue: 85, layerId: 0 },
    { id: "oh_changsun", label: "오창선 (담당자)", group: "CORE_PROJECT", baseValue: 80, layerId: 0 },
    { id: "gangnam_health_center", label: "강남구보건소", group: "INFRASTRUCTURE", baseValue: 70, layerId: 0 },
    { id: "medi_sports_center", label: "AI 메디 스포츠 센터", group: "CORE_PROJECT", baseValue: 95, layerId: 2 },
    { id: "budget_medi_sports", label: "메디 스포츠 추경 예산", group: "INFRASTRUCTURE", baseValue: 80, layerId: 1 },
    { id: "smart_gym_equipment", label: "AI 스마트짐 장비", group: "INFRASTRUCTURE", baseValue: 80, layerId: 1 },
    { id: "ai_solution_system", label: "통합 전산 AI 솔루션 시스템", group: "DATA_PIPELINE", baseValue: 85, layerId: 2 },
    { id: "metabolic_syndrome_center", label: "대사증후군 센터", group: "INFRASTRUCTURE", baseValue: 60, layerId: 0 },
    { id: "seoul_fitness_gangnam", label: "서울체력장 강남센터", group: "INFRASTRUCTURE", baseValue: 60, layerId: 0 },
    { id: "health_checkup_program", label: "보건소 헬스체크업 프로그램", group: "MACRO_RESEARCH", baseValue: 70, layerId: 2 },
    { id: "doc_medi_sports_proposal", label: "AI 메디 스포츠 센터 기획 제안서", group: "DATA_PIPELINE", baseValue: 90, layerId: 3 },
    { id: "severance_health_checkup", label: "세브란스 헬스체크업", group: "INFRASTRUCTURE", baseValue: 75, layerId: 0 },
    { id: "basic_checkup", label: "베이직 기본 검진", group: "MACRO_RESEARCH", baseValue: 65, layerId: 2 },
    { id: "premium_checkup", label: "프리미엄 검진", group: "MACRO_RESEARCH", baseValue: 75, layerId: 2 },
    { id: "platinum_checkup", label: "플래티넘 검진", group: "MACRO_RESEARCH", baseValue: 85, layerId: 2 },
    { id: "noblesse_checkup", label: "노블레스 검진", group: "MACRO_RESEARCH", baseValue: 90, layerId: 2 },
    { id: "budget_basic_checkup", label: "기본 검진비 (75만원)", group: "INFRASTRUCTURE", baseValue: 65, layerId: 1 },
    { id: "budget_premium_checkup", label: "프리미엄 검진비 (128-308만원)", group: "INFRASTRUCTURE", baseValue: 75, layerId: 1 },
    { id: "budget_platinum_checkup", label: "플래티넘 검진비 (231-486만원)", group: "INFRASTRUCTURE", baseValue: 85, layerId: 1 },
    { id: "mri_mra_brain", label: "뇌 MRI+MRA 검사", group: "MACRO_RESEARCH", baseValue: 80, layerId: 2 },
    { id: "musculoskeletal_posture_test", label: "근골격 불균형/부정렬 검사", group: "MACRO_RESEARCH", baseValue: 75, layerId: 2 },
    { id: "heart_ultrasound", label: "심장 초음파", group: "MACRO_RESEARCH", baseValue: 70, layerId: 2 },
    { id: "genetic_panel_test", label: "유전자 패널 검사", group: "MACRO_RESEARCH", baseValue: 80, layerId: 2 },
    { id: "doc_severance_catalog", label: "세브란스 헬스체크업 검진 브로셔", group: "DATA_PIPELINE", baseValue: 80, layerId: 3 }
  ],
  edges: [
    { source: "hong_jongnam", target: "medi_sports_center", type: "ASSIGNEE", weight: 0.9 },
    { source: "kim_jaeeun", target: "medi_sports_center", type: "ASSIGNEE", weight: 0.85 },
    { source: "oh_changsun", target: "medi_sports_center", type: "ASSIGNEE", weight: 0.8 },
    { source: "budget_medi_sports", target: "medi_sports_center", type: "BUDGET_SOURCE", weight: 0.95 },
    { source: "smart_gym_equipment", target: "medi_sports_center", type: "COMPONENTS", weight: 0.8 },
    { source: "ai_solution_system", target: "medi_sports_center", type: "COMPONENTS", weight: 0.9 },
    { source: "metabolic_syndrome_center", target: "medi_sports_center", type: "COMPONENTS", weight: 0.75 },
    { source: "seoul_fitness_gangnam", target: "medi_sports_center", type: "COMPONENTS", weight: 0.75 },
    { source: "health_checkup_program", target: "medi_sports_center", type: "COMPONENTS", weight: 0.75 },
    { source: "medi_sports_center", target: "doc_medi_sports_proposal", type: "DEPENDENCY", weight: 0.9 },
    { source: "gangnam_health_center", target: "medi_sports_center", type: "DEPENDENCY", weight: 0.8 },
    { source: "basic_checkup", target: "severance_health_checkup", type: "COMPONENTS", weight: 0.8 },
    { source: "premium_checkup", target: "severance_health_checkup", type: "COMPONENTS", weight: 0.85 },
    { source: "platinum_checkup", target: "severance_health_checkup", type: "COMPONENTS", weight: 0.9 },
    { source: "noblesse_checkup", target: "severance_health_checkup", type: "COMPONENTS", weight: 0.95 },
    { source: "budget_basic_checkup", target: "basic_checkup", type: "BUDGET_SOURCE", weight: 0.8 },
    { source: "budget_premium_checkup", target: "premium_checkup", type: "BUDGET_SOURCE", weight: 0.85 },
    { source: "budget_platinum_checkup", target: "platinum_checkup", type: "BUDGET_SOURCE", weight: 0.9 },
    { source: "mri_mra_brain", target: "premium_checkup", type: "COMPONENTS", weight: 0.75 },
    { source: "musculoskeletal_posture_test", target: "basic_checkup", type: "COMPONENTS", weight: 0.7 },
    { source: "genetic_panel_test", target: "platinum_checkup", type: "COMPONENTS", weight: 0.8 },
    { source: "severance_health_checkup", target: "doc_severance_catalog", type: "DEPENDENCY", weight: 0.85 },
    { source: "health_checkup_program", target: "severance_health_checkup", type: "DEPENDENCY", weight: 0.85 }
  ]
};

async function getMasterKey() {
  const encoder = new TextEncoder();
  const keyMaterial = await webcrypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return await webcrypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function decrypt(encryptedBase64, masterKey) {
  if (!encryptedBase64) return { overrides: {}, customNodes: [], customEdges: [], deletedEdges: [] };
  
  // Plaintext fallback
  if (encryptedBase64.startsWith('[') || encryptedBase64.startsWith('{') || encryptedBase64.startsWith('"')) {
    return JSON.parse(encryptedBase64);
  }
  
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

async function encrypt(data, masterKey) {
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

async function main() {
  try {
    const masterKey = await getMasterKey();
    
    let dbData = [];
    if (fs.existsSync(DB_FILE)) {
      const fileData = fs.readFileSync(DB_FILE, 'utf-8');
      dbData = JSON.parse(fileData);
    }
    
    let singletonObj = dbData.find(item => item.id === 'singleton');
    if (!singletonObj) {
      singletonObj = { id: 'singleton', _enc: '' };
      dbData.push(singletonObj);
    }
    
    // 복호화 수행
    console.log('[E2EE] Decrypting existing MAP_CUSTOMIZATION database...');
    const decrypted = await decrypt(singletonObj._enc, masterKey);
    console.log('[E2EE] Decryption complete.');
    
    if (!decrypted.overrides) decrypted.overrides = {};
    if (!decrypted.customNodes) decrypted.customNodes = [];
    if (!decrypted.customEdges) decrypted.customEdges = [];
    if (!decrypted.deletedEdges) decrypted.deletedEdges = [];
    
    const customNodesMap = new Map(decrypted.customNodes.map(n => [n.id, n]));
    const customEdgesMap = new Map(decrypted.customEdges.map(e => [`${e.source}|||${e.target}`, e]));
    const deletedEdgesSet = new Set(decrypted.deletedEdges);
    
    let nodesAdded = 0;
    let edgesAdded = 0;
    
    // 1. 신규 스캔 노드 머지
    extractedData.nodes.forEach(node => {
      if (!node.id) return;
      if (!customNodesMap.has(node.id)) {
        customNodesMap.set(node.id, {
          ...node,
          centralityScore: 100
        });
        nodesAdded++;
      }
    });
    
    // 2. 신규 스캔 엣지 머지
    extractedData.edges.forEach(edge => {
      if (!edge.source || !edge.target) return;
      const edgeId = `${edge.source}|||${edge.target}`;
      const reverseId = `${edge.target}|||${edge.source}`;
      
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
    
    const mergedData = {
      overrides: decrypted.overrides,
      customNodes: Array.from(customNodesMap.values()),
      customEdges: Array.from(customEdgesMap.values()),
      deletedEdges: Array.from(deletedEdgesSet)
    };
    
    console.log(`[E2EE] Merged payload: customNodes count = ${mergedData.customNodes.length}, customEdges count = ${mergedData.customEdges.length}`);
    
    // 암호화 수행
    console.log('[E2EE] Encrypting merged data payload...');
    const encryptedBase64 = await encrypt(mergedData, masterKey);
    console.log('[E2EE] Encryption complete.');
    
    singletonObj._enc = encryptedBase64;
    // 평문 흔적 필드가 오염되어 남아있는 경우 방지
    delete singletonObj.customNodes;
    delete singletonObj.customEdges;
    delete singletonObj.deletedEdges;
    delete singletonObj.overrides;
    
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf-8');
    console.log(`[Success] Written database with E2EE. Nodes added: ${nodesAdded}, Edges added: ${edgesAdded}`);
    
    // 백업 생성
    const backupDir = path.join(__dirname, '..', 'data', 'backups', 'MAP_CUSTOMIZATION');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(backupDir, `${timestamp}_MAP_CUSTOMIZATION.json`), JSON.stringify(dbData, null, 2), 'utf-8');
    console.log(`[Success] E2EE Backup saved: ${timestamp}_MAP_CUSTOMIZATION.json`);
    
  } catch (err) {
    console.error('[Error in main]', err);
  }
}

main();
