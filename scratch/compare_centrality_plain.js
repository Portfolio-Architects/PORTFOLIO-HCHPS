const fs = require('fs');
const { execSync } = require('child_process');
const { webcrypto } = require('crypto');

const pin = '0509';
const SALT = new TextEncoder().encode('HCHPS-E2EE-SALT');

async function decrypt(encryptedBase64, masterKey) {
  if (!encryptedBase64) return null;
  if (encryptedBase64.startsWith('[') || encryptedBase64.startsWith('{') || encryptedBase64.startsWith('"')) {
    try {
      return JSON.parse(encryptedBase64);
    } catch {
      // fallback
    }
  }

  try {
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
  } catch (err) {
    console.error('Decryption failed:', err);
    return null;
  }
}

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

async function getDecryptedMap(content, masterKey) {
  const rawMap = JSON.parse(content);
  const singleton = rawMap.find(item => item.id === 'singleton');
  if (!singleton) return null;
  if (!singleton._enc) return singleton;
  return await decrypt(singleton._enc, masterKey);
}

// Exact implementation of computeCentrality from src/lib/ontology.service.ts
function computeCentrality(nodes, edges) {
  const nodeCount = nodes.length;
  if (nodeCount === 0) return [];

  const nodeMap = new Map();
  for (const node of nodes) nodeMap.set(node.id, node);

  // 1. Power Iteration을 통한 고유벡터 중심성 (Eigenvector Centrality) 연산
  const centrality = new Map();
  for (const node of nodes) {
    centrality.set(node.id, Math.max(0.1, node.baseValue / 100));
  }

  const adj = new Map();
  for (const node of nodes) adj.set(node.id, []);
  for (const edge of edges) {
    const w = Math.abs(edge.weight);
    adj.get(edge.source)?.push({ neighbor: edge.target, weight: w });
    adj.get(edge.target)?.push({ neighbor: edge.source, weight: w });
  }

  const MAX_ITER = 15;
  const EPSILON = 1e-4;
  let converged = false;

  for (let iter = 0; iter < MAX_ITER && !converged; iter++) {
    const nextCentrality = new Map();
    let l2Norm = 0;

    for (const node of nodes) {
      let sum = 0.2 * (node.baseValue / 100);
      const neighbors = adj.get(node.id) || [];
      for (const edgeInfo of neighbors) {
        const neighborVal = centrality.get(edgeInfo.neighbor) ?? 0;
        sum += 0.8 * edgeInfo.weight * neighborVal;
      }
      nextCentrality.set(node.id, sum);
      l2Norm += sum * sum;
    }

    l2Norm = Math.sqrt(l2Norm);
    if (l2Norm < 0.001) l2Norm = 0.001;

    let maxDiff = 0;
    for (const node of nodes) {
      const prevVal = centrality.get(node.id) ?? 0;
      const newVal = (nextCentrality.get(node.id) ?? 0) / l2Norm;
      centrality.set(node.id, newVal);
      
      const diff = Math.abs(newVal - prevVal);
      if (diff > maxDiff) maxDiff = diff;
    }

    if (maxDiff < EPSILON) {
      converged = true;
    }
  }

  // 2. signed weight accumulation (병목 감지용 netWeight)
  const netWeightMap = new Map();
  for (const edge of edges) {
    netWeightMap.set(edge.source, (netWeightMap.get(edge.source) || 0) + edge.weight);
    netWeightMap.set(edge.target, (netWeightMap.get(edge.target) || 0) + edge.weight);
  }

  // 3. 리스크 전파 모델 (Risk Propagation Score) 구현
  const riskSource = new Map();
  for (const node of nodes) {
    const netW = netWeightMap.get(node.id) ?? 0;
    if (node.group === 'SYSTEM_RISK' || netW < -0.4) {
      riskSource.set(node.id, node.group === 'SYSTEM_RISK' ? 1.0 : Math.min(1.0, Math.abs(netW)));
    }
  }

  const riskFactors = new Map();
  for (const node of nodes) {
    if (riskSource.has(node.id)) {
      riskFactors.set(node.id, riskSource.get(node.id) ?? 1.0);
      continue;
    }

    let maxRiskFromNeighbor = 0;
    const neighbors = adj.get(node.id) || [];
    for (const edgeInfo of neighbors) {
      if (riskSource.has(edgeInfo.neighbor)) {
        const sourceRisk = riskSource.get(edgeInfo.neighbor) ?? 1.0;
        const propagatedRisk = sourceRisk * edgeInfo.weight;
        if (propagatedRisk > maxRiskFromNeighbor) {
          maxRiskFromNeighbor = propagatedRisk;
        }
      }
    }
    riskFactors.set(node.id, maxRiskFromNeighbor);
  }

  const centValues = Array.from(centrality.values());
  const minCent = Math.min(...centValues, 0);
  const maxCent = Math.max(...centValues, 0.001);
  const centRange = maxCent - minCent;

  const maxBaseValue = Math.max(...nodes.map(n => n.baseValue), 1);

  return nodes.map(node => {
    const rawCent = centrality.get(node.id) || 0;
    const anchorBoost = node.baseValue === maxBaseValue ? centRange * 0.05 : 0;
    const normalizedCentrality = Math.min(1, Math.max(0, (rawCent - minCent + anchorBoost) / centRange));
    
    const netWeight = netWeightMap.get(node.id) ?? 0;
    const riskFactor = riskFactors.get(node.id) ?? 0;

    const layer = node.layerId ?? node.effectiveLayer ?? 2;
    let layerBoost = 0.15;
    if (layer === 0) layerBoost = 0.05;
    else if (layer === 1) layerBoost = 0.10;
    else if (layer === 2) layerBoost = 0.15;
    else if (layer === 3) layerBoost = 0.22;

    let renderSize =
      0.25 * (node.baseValue / 100) +
      0.50 * Math.pow(normalizedCentrality, 1.2) +
      0.25 * layerBoost;

    if (riskFactor > 0.5) {
      renderSize += 0.03;
    }

    renderSize = Math.max(0.4, Math.min(1.0, renderSize));

    return {
      ...node,
      centralityScore: normalizedCentrality,
      renderSize,
      netWeight,
      riskFactor,
      isHedge: netWeight < 0 || riskFactor > 0.3,
    };
  });
}

async function main() {
  const masterKey = await getMasterKey();

  // Load current map
  const currentContent = fs.readFileSync('data/MAP_CUSTOMIZATION.json', 'utf8');
  const currentMap = await getDecryptedMap(currentContent, masterKey);
  const currentScoredNodes = computeCentrality(currentMap.customNodes || [], currentMap.customEdges || []);

  // Load git HEAD map
  let gitMap = null;
  try {
    const gitContent = execSync('git show HEAD:data/MAP_CUSTOMIZATION.json', { encoding: 'utf8' });
    gitMap = await getDecryptedMap(gitContent, masterKey);
  } catch (err) {
    console.warn("Could not load map from git HEAD:", err.message);
  }

  const gitScoredNodes = gitMap ? computeCentrality(gitMap.customNodes || [], gitMap.customEdges || []) : [];

  console.log("=== Top 15 Nodes by Centrality (Current) ===");
  currentScoredNodes
    .sort((a, b) => (b.centralityScore ?? 0) - (a.centralityScore ?? 0))
    .slice(0, 15)
    .forEach((n, idx) => {
      console.log(`${idx + 1}. [${n.label}] (id: ${n.id}) - centrality: ${n.centralityScore?.toFixed(4)}, renderSize: ${n.renderSize?.toFixed(4)}, isHedge: ${n.isHedge}`);
    });

  if (gitScoredNodes.length > 0) {
    console.log("\n=== Top 15 Nodes by Centrality (Git HEAD) ===");
    gitScoredNodes
      .sort((a, b) => (b.centralityScore ?? 0) - (a.centralityScore ?? 0))
      .slice(0, 15)
      .forEach((n, idx) => {
        console.log(`${idx + 1}. [${n.label}] (id: ${n.id}) - centrality: ${n.centralityScore?.toFixed(4)}, renderSize: ${n.renderSize?.toFixed(4)}, isHedge: ${n.isHedge}`);
      });
  }
}

main().catch(console.error);
