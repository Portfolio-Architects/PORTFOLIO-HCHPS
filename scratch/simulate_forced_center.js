const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');

const cryptoSubtle = webcrypto.subtle;
const SALT = new TextEncoder().encode('HCHPS-E2EE-SALT');

function base64ToArrayBuffer(base64) {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

async function decryptPayload(encryptedBase64, pin) {
  const encoder = new TextEncoder();
  const keyMaterial = await cryptoSubtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const masterKey = await cryptoSubtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const payloadBuffer = base64ToArrayBuffer(encryptedBase64);
  const payload = new Uint8Array(payloadBuffer);
  
  if (payload.length < 12) throw new Error('Invalid encrypted payload');

  const iv = payload.slice(0, 12);
  const ciphertext = payload.slice(12);
  
  const decryptedBuffer = await cryptoSubtle.decrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    ciphertext
  );
  
  const decoder = new TextDecoder();
  const jsonStr = decoder.decode(decryptedBuffer);
  return JSON.parse(jsonStr);
}

// Minimal implementation of computeCentrality from ontology.service.ts
function computeCentrality(nodes, edges) {
  const centrality = new Map();
  for (const node of nodes) {
    centrality.set(node.id, Math.max(0.1, node.baseValue / 100));
  }

  const adj = new Map();
  for (const node of nodes) adj.set(node.id, []);
  for (const edge of edges) {
    const w = Math.abs(edge.weight);
    if (adj.has(edge.source)) adj.get(edge.source).push({ neighbor: edge.target, weight: w });
    if (adj.has(edge.target)) adj.get(edge.target).push({ neighbor: edge.source, weight: w });
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

  for (const node of nodes) {
    const isForced = node.id === 'root-HCHPS' || (node.centralityScore && node.centralityScore > 9000000);
    if (isForced) {
      node.centralityScore = 9999999;
    } else {
      node.centralityScore = centrality.get(node.id) ?? 0;
    }
  }
  return nodes;
}

// Minimal implementation of buildSignalGraph nodes/edges builder logic to see final centrality
function simulateGraphBuild(entries, customData) {
  const nodes = [];
  const edges = [];

  // Add root
  const rootNode = {
    id: 'root-HCHPS',
    label: 'Vital Tasks',
    group: 'CORE_PROJECT',
    baseValue: 100,
    centralityScore: 10000,
  };
  nodes.push(rootNode);

  // Add category tags
  const tagCounts = new Map();
  let hasRawSignals = false;
  entries.forEach(e => {
    if (!e.tags || e.tags.length === 0) hasRawSignals = true;
    e.tags?.forEach(t => {
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    });
  });
  if (hasRawSignals) tagCounts.set('💭 미분류', 9999);

  const categoryGroups = ['MACRO_RESEARCH', 'DCF_MODELING', 'DATA_PIPELINE', 'INFRASTRUCTURE', 'SYSTEM_RISK'];
  let i = 0;
  tagCounts.forEach((count, tag) => {
    const id = `tag-${tag}`;
    const groupAssign = categoryGroups[i % categoryGroups.length];
    nodes.push({
      id,
      label: tag,
      group: groupAssign,
      baseValue: 80,
      centralityScore: 1000 - i,
    });
    edges.push({
      source: 'root-HCHPS',
      target: id,
      weight: 1.0,
    });
    i++;
  });

  // Add custom nodes
  if (customData && customData.customNodes) {
    customData.customNodes.forEach(cn => {
      // Simple push for simulation
      const override = customData.overrides[cn.id];
      nodes.push({
        id: cn.id,
        label: override?.customLabel || cn.label,
        group: cn.group,
        baseValue: cn.baseValue || 50,
        parentId: override?.customParent || cn.parentId,
      });
    });

    // customEdges
    customData.customEdges?.forEach(ce => {
      edges.push({ source: ce.source, target: ce.target, weight: ce.weight || 0.5 });
    });

    // Parent edges
    nodes.forEach(n => {
      if (n.parentId && n.parentId !== 'NONE' && n.id !== 'root-HCHPS') {
        edges.push({ source: n.parentId, target: n.id, weight: 0.7 });
      }
    });
  }

  // Determine forcedCenterNode
  let forcedCenterNode = nodes.find(n => n.id === 'root-HCHPS');
  if (customData && customData.overrides) {
    const customCenter = nodes.find(n => customData.overrides[n.id]?.customOrbitIndex === 0);
    if (customCenter) forcedCenterNode = customCenter;
  }

  console.log('Simulation - forcedCenterNode detected:', forcedCenterNode.id, forcedCenterNode.label);

  if (forcedCenterNode) {
    forcedCenterNode.centralityScore = 9999999;
    forcedCenterNode.parentId = undefined;

    // category edges transfer
    edges.forEach(e => {
      if (e.source === 'root-HCHPS') {
        e.source = forcedCenterNode.id;
      }
    });

    edges.push({
      source: forcedCenterNode.id,
      target: 'root-HCHPS',
      weight: 1.0,
    });
  }

  // compute centrality
  const scoredNodes = computeCentrality(nodes, edges);
  
  // Sort
  const sorted = [...scoredNodes].sort((a, b) => b.centralityScore - a.centralityScore);
  
  console.log('\nTop 15 Nodes by computed Centrality Score:');
  sorted.slice(0, 15).forEach((n, idx) => {
    console.log(`${idx + 1}. ID: ${n.id}, Label: ${n.label}, Score: ${n.centralityScore}`);
  });
}

async function main() {
  const mapPath = path.join(__dirname, '../data/MAP_CUSTOMIZATION.json');
  const mapContent = fs.readFileSync(mapPath, 'utf-8');
  const mapJson = JSON.parse(mapContent);
  const singleton = mapJson.find(item => item.id === 'singleton');
  
  const customData = await decryptPayload(singleton._enc, '0509');
  
  const logPath = path.join(__dirname, '../data/SIGNAL_LOG.json');
  const entries = JSON.parse(fs.readFileSync(logPath, 'utf-8'));

  simulateGraphBuild(entries, customData);
}

main();
