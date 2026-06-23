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

async function getDecryptedRows(filePath, masterKey) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = JSON.parse(content);
  const decRows = [];
  for (const r of rows) {
    if (r._enc) {
      const dec = await decrypt(r._enc, masterKey);
      if (dec) decRows.push({ id: r.id, ...dec });
      else decRows.push(r);
    } else {
      decRows.push(r);
    }
  }
  return decRows;
}

// Extract keywords helper mimicking useSignal.ts
function extractKeywords(text) {
  if (!text) return [];
  // Simple extraction: filter alphanumeric and Korean words of length >= 2
  const words = text.match(/[가-힣a-zA-Z0-9]{2,}/g) || [];
  return words.map(w => w.toLowerCase());
}

// Replicate useMergedSignals logic
function mergeSignals(signalEntries, keywordMap, tasks, projects, meetings, budgetEntries, inventoryItems) {
  const map = { ...keywordMap };
  const extractAndAdd = (text, tags = []) => {
    const words = extractKeywords(text);
    tags.forEach(t => { if (t.length >= 2) words.push(t); });
    words.forEach(kw => { map[kw] = (map[kw] || 0) + 1; });
  };

  tasks.forEach(t => extractAndAdd(t.title + ' ' + (t.description || ''), t.tags));
  projects.forEach(p => extractAndAdd(p.name + ' ' + (p.description || '') + ' ' + p.checklistItems.map(c => c.text).join(' ')));
  meetings.forEach(m => extractAndAdd(m.title + ' ' + (m.agenda || '') + ' ' + (m.notes || ''), m.attendees));
  budgetEntries.forEach(b => extractAndAdd(b.purpose + ' ' + (b.memo || '')));
  inventoryItems.forEach(i => extractAndAdd(i.name + ' ' + i.category));

  const buildEntry = (idPrefix, id, text, keywordsSource, tags, createdAt, category) => ({
    id: `${idPrefix}-${id}`,
    text,
    keywords: [...extractKeywords(keywordsSource), ...tags.filter(tag => tag.length >= 2)],
    createdAt,
    category,
    tags: tags.filter(tag => tag.length >= 2),
  });

  const taskMap = tasks.map(t => buildEntry('task', t.id, `[업무] ${t.title}`, t.title + ' ' + (t.description || ''), t.tags || [], t.createdAt, '업무'));
  const projectMap = projects.map(p => buildEntry('proj', p.id, `[프로젝트] ${p.name}`, p.name + ' ' + (p.description || ''), ['프로젝트'], p.createdAt, '프로젝트'));
  const meetingMap = meetings.map(m => buildEntry('meet', m.id, `[회의] ${m.title}`, m.title + ' ' + (m.agenda || '') + ' ' + (m.notes || ''), ['회의록', ...(m.attendees || [])], m.createdAt, '회의록'));
  const budgetMap = budgetEntries.map(b => buildEntry('budg', b.id, `[지출] ${b.purpose}`, b.purpose + ' ' + (b.memo || ''), ['예산'], b.date, '지출예산'));
  const inventoryMap = inventoryItems.map(i => buildEntry('inv', i.id, `[비품] ${i.name}`, i.name + ' ' + i.category, ['재고'], i.createdAt, '홍보물'));

  const sigMap = signalEntries.map(s => ({ ...s, category: '내 생각', tags: [] }));
  const all = [...sigMap, ...taskMap, ...projectMap, ...meetingMap, ...budgetMap, ...inventoryMap];
  all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return { mergedKeywordMap: map, mergedEntries: all };
}

// Replicate computeCentrality from TS
function computeCentrality(nodes, edges) {
  const nodeCount = nodes.length;
  if (nodeCount === 0) return [];

  const nodeMap = new Map();
  for (const node of nodes) nodeMap.set(node.id, node);

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

    if (maxDiff < EPSILON) converged = true;
  }

  const netWeightMap = new Map();
  for (const edge of edges) {
    netWeightMap.set(edge.source, (netWeightMap.get(edge.source) || 0) + edge.weight);
    netWeightMap.set(edge.target, (netWeightMap.get(edge.target) || 0) + edge.weight);
  }

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

    if (riskFactor > 0.5) renderSize += 0.03;
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

// Simplified buildSignalGraph from src/lib/signal-graph.ts
function buildSignalGraph(entries, customMap) {
  const nodes = [];
  const edges = [];
  
  // 1. Root Node (HCHPS)
  nodes.push({
    id: 'root-HCHPS',
    label: 'Tasks',
    group: 'CORE_PROJECT',
    baseValue: 100,
    centralityScore: 10000,
  });

  const customData = customMap;
  const customParentSet = new Set();
  
  // Collect parents
  if (customData) {
    (customData.customNodes || []).forEach(cn => {
      if (cn.parentId) customParentSet.add(cn.parentId);
    });
    Object.keys(customData.overrides || {}).forEach(k => {
      const parent = customData.overrides[k]?.customParent;
      if (parent) customParentSet.add(parent);
    });
  }

  // 2. Orbit 1 Tags
  const tagCounts = new Map();
  let hasRawSignals = false;
  entries.forEach(e => {
    const tags = e.tags || [];
    if (tags.length === 0) hasRawSignals = true;
    tags.forEach(t => {
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    });
  });

  if (hasRawSignals) {
    tagCounts.set('💭 미분류', 9999);
  }

  const allSortedTags = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]);
  const sortedTags = [];
  const overrideKeys = customData ? new Set(Object.keys(customData.overrides || {})) : new Set();
  
  allSortedTags.forEach(([tag, count], i) => {
    const id = `tag-${tag}`;
    const hasOverride = overrideKeys.has(id);
    const isParentOfAny = customParentSet.has(id);
    if (i < 15 || hasOverride || isParentOfAny) {
      sortedTags.push([tag, count]);
    }
  });

  const tagNodesMap = new Map();
  const tagGroupMap = new Map();
  const categoryGroups = ['MACRO_RESEARCH', 'DCF_MODELING', 'DATA_PIPELINE', 'INFRASTRUCTURE', 'SYSTEM_RISK'];

  sortedTags.forEach(([tag, count], i) => {
    const id = `tag-${tag}`;
    const groupAssign = categoryGroups[i % categoryGroups.length];
    tagNodesMap.set(tag, id);
    tagGroupMap.set(tag, groupAssign);

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
      type: 'CAUSAL_DRIVE',
    });
  });

  // 3. Process Leaves (Keywords) & Map to Categories
  const keywordFreqByTag = new Map();
  entries.forEach(e => {
    const tags = e.tags || [];
    let keywords = e.keywords || [];
    if (!Array.isArray(keywords)) {
      if (typeof keywords === 'string') {
        try { keywords = JSON.parse(keywords); } catch(err) { keywords = []; }
      } else {
        keywords = [];
      }
    }
    let applicableTags = tags.filter(t => tagNodesMap.has(t));
    if (applicableTags.length === 0) {
      const matched = keywords.filter(kw => tagNodesMap.has(kw));
      if (matched.length > 0) applicableTags = matched;
      else if (tagNodesMap.has('💭 미분류')) applicableTags = ['💭 미분류'];
    }


    applicableTags.forEach(tag => {
      const tagMap = keywordFreqByTag.get(tag) || new Map();
      keywords.forEach(kw => {
        if (kw !== tag) {
          tagMap.set(kw, (tagMap.get(kw) || 0) + 1);
        }
      });
      keywordFreqByTag.set(tag, tagMap);
    });
  });

  keywordFreqByTag.forEach((kwMap, tag) => {
    const tagNodeId = tagNodesMap.get(tag);
    const branchGroup = tagGroupMap.get(tag) || 'OTHER';
    const allSortedKw = Array.from(kwMap.entries()).sort((a, b) => b[1] - a[1]);
    const sortedKw = [];

    allSortedKw.forEach(([kw, freq], i) => {
      const leafId = `leaf-${kw}`;
      const hasOverride = overrideKeys.has(leafId);
      const isParentOfAny = customParentSet.has(leafId);
      if (i < 8 || hasOverride || isParentOfAny) {
        sortedKw.push([kw, freq]);
      }
    });

    sortedKw.forEach(([kw, freq]) => {
      const leafId = `leaf-${kw}`;
      let existingNode = nodes.find(n => n.id === leafId);
      if (!existingNode) {
        nodes.push({
          id: leafId,
          label: kw,
          group: branchGroup,
          baseValue: Math.min(60, 30 + freq * 10),
          centralityScore: 100 + freq,
          parentId: tagNodeId,
        });
      } else {
        existingNode.baseValue = Math.max(existingNode.baseValue || 0, Math.min(60, 30 + freq * 10));
        existingNode.centralityScore = Math.max(existingNode.centralityScore || 0, 100 + freq);
      }

      edges.push({
        source: tagNodeId,
        target: leafId,
        weight: 0.7,
        type: 'DEPENDENCY',
      });
    });
  });

  // 4. Inject Custom Mapping (custom nodes and edges)
  if (customData) {
    (customData.customNodes || []).forEach(cn => {
      const existing = nodes.find(n => n.id === cn.id);
      if (!existing) {
        nodes.push({ ...cn });
      } else {
        Object.assign(existing, cn);
      }
    });

    (customData.customEdges || []).forEach(ce => {
      edges.push({ ...ce });
    });

    // Apply overrides
    Object.keys(customData.overrides || {}).forEach(id => {
      const override = customData.overrides[id];
      const node = nodes.find(n => n.id === id);
      if (node) {
        if (override.customLabel) node.label = override.customLabel;
        if (override.customParent) node.parentId = override.customParent === 'NONE' ? undefined : override.customParent;
        if (override.customOrbitIndex !== undefined) node.customOrbitIndex = override.customOrbitIndex;
      }
    });
  }

  // Filter deleted edges
  let finalEdges = edges;
  if (customData && customData.deletedEdges) {
    const deletedSet = new Set(customData.deletedEdges);
    finalEdges = edges.filter(e => !deletedSet.has(`${e.source}|||${e.target}`) && !deletedSet.has(`${e.target}|||${e.source}`));
  }

  // 5. Center Override logic
  let forcedCenterNode = customData ? nodes.find(n => customData.overrides[n.id]?.customOrbitIndex === 0) : undefined;
  if (forcedCenterNode) {
    forcedCenterNode.centralityScore = 9999999;
    forcedCenterNode.parentId = undefined;
    forcedCenterNode.group = 'CORE_PROJECT';
    
    finalEdges.forEach(e => {
      if (e.source === 'root-HCHPS') {
        const isCustomParent = customData?.overrides[e.target]?.customParent === 'root-HCHPS';
        const isCustomEdge = e.isCustom;
        if (!isCustomParent && !isCustomEdge) {
          e.source = forcedCenterNode.id;
        }
      }
      if (e.target === forcedCenterNode.id) {
        if (!e.isCustom) {
          e.source = forcedCenterNode.id; // Self-loop to filter out
        }
      }
    });

    finalEdges.push({
      source: forcedCenterNode.id,
      target: 'root-HCHPS',
      weight: 1.0,
      type: 'CAUSAL_DRIVE'
    });
    
    finalEdges = finalEdges.filter(e => e.source !== e.target);
  }

  return { nodes, edges: finalEdges };
}

async function main() {
  const masterKey = await getMasterKey();

  // Load custom map data
  const currentContent = fs.readFileSync('data/MAP_CUSTOMIZATION.json', 'utf8');
  const currentMap = await getDecryptedMap(currentContent, masterKey);

  // Load other databases for useMergedSignals
  const signalEntries = await getDecryptedRows('data/SIGNAL_LOG.json', masterKey);
  const tasks = await getDecryptedRows('data/TASKS.json', masterKey);
  const projects = await getDecryptedRows('data/PROJECTS.json', masterKey);
  const meetings = await getDecryptedRows('data/MEETINGS.json', masterKey);
  const budgetEntries = await getDecryptedRows('data/BUDGET_ENTRIES.json', masterKey);
  const inventoryItems = await getDecryptedRows('data/INVENTORY.json', masterKey);

  // Replicate useMergedSignals
  const { mergedKeywordMap, mergedEntries } = mergeSignals(
    signalEntries, {}, tasks, projects, meetings, budgetEntries, inventoryItems
  );

  // Build current graph
  const currentGraph = buildSignalGraph(mergedEntries, currentMap);
  const currentScoredNodes = computeCentrality(currentGraph.nodes, currentGraph.edges);

  console.log("=== Top 15 Scored Nodes (Merged Signals) ===");
  currentScoredNodes
    .sort((a, b) => (b.centralityScore ?? 0) - (a.centralityScore ?? 0))
    .slice(0, 15)
    .forEach((n, idx) => {
      console.log(`${idx + 1}. [${n.label}] (id: ${n.id}) - centrality: ${n.centralityScore?.toFixed(4)}, renderSize: ${n.renderSize?.toFixed(4)}, isHedge: ${n.isHedge}`);
    });
}

main().catch(console.error);
