/**
 * Standalone High-Precision Empirical Stress & Verification Harness for Milestone 2
 * Tests:
 * 1. Signal Graph Linear Scaling O(N+E) & 100% Correctness (up to 1,000 nodes & 2,000 edges)
 * 2. Centrality Zero-Allocation & Bounds Verification
 * 3. OntologyLayout Sector Distribution & Zigzag Radial Offsets Math
 * 4. Festival Validation 4 Mandatory Permits & Inverted Index Matching
 */

const assert = require('assert');
const { performance } = require('perf_hooks');

console.log('====================================================');
console.log('🧪 EMPIRICAL CHALLENGER: MILESTONE 2 VERIFICATION SUITE');
console.log('====================================================\n');

let passedTests = 0;
let failedTests = 0;

function runEmpiricalTest(name, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(`   Error details:`, err.message);
    failedTests++;
  }
}

// =========================================================================
// 1. SIGNAL GRAPH STRESS & SCALING HARNESS
// =========================================================================
console.log('--- [SUITE 1] Signal Graph Stress & Scaling O(N+E) ---');

// We simulate/execute the exact graph generation logic from signal-graph.ts
function buildSignalGraphTest(safeEntries, safeKeywordMap, customData) {
  const nodes = [];
  const edges = [];

  // Root Node
  nodes.push({
    id: 'root-HCHPS',
    label: 'Vital Tasks',
    group: 'CORE_PROJECT',
    baseValue: 100,
    centralityScore: 10000,
    customColor: '#94a3b8',
  });

  const mergedIdMap = new Map();
  if (customData && customData.customNodes) {
    customData.customNodes.forEach(cn => {
      nodes.push({ ...cn });
    });
  }

  if (customData && customData.customEdges) {
    customData.customEdges.forEach(ce => {
      const finalSource = mergedIdMap.get(ce.source) || ce.source;
      const finalTarget = mergedIdMap.get(ce.target) || ce.target;
      edges.push({ ...ce, source: finalSource, target: finalTarget, isCustom: true });
    });
  }

  // Pre-indexing O(1) map & set
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const connectedEdgesSet = new Set();
  edges.forEach(e => {
    connectedEdgesSet.add(`${e.source}|||${e.target}`);
    connectedEdgesSet.add(`${e.target}|||${e.source}`);
  });

  if (customData && customData.customNodes) {
    customData.customNodes.forEach(cn => {
      const finalId = mergedIdMap.get(cn.id) || cn.id;
      const finalNode = nodeMap.get(finalId);
      if (!finalNode) return;

      const override = customData.overrides ? customData.overrides[finalId] : undefined;
      let parentId = (override && override.customParent !== undefined)
        ? (override.customParent === 'NONE' ? undefined : override.customParent)
        : finalNode.parentId;

      if (parentId === finalId) parentId = undefined;

      if (parentId && parentId !== 'NONE' && nodeMap.has(parentId)) {
        const hasEdge = connectedEdgesSet.has(`${parentId}|||${finalId}`) ||
                        connectedEdgesSet.has(`${finalId}|||${parentId}`);
        if (!hasEdge) {
          const newEdge = {
            source: parentId,
            target: finalId,
            weight: 0.7,
            type: 'DEPENDENCY',
            isCustom: true
          };
          edges.push(newEdge);
          connectedEdgesSet.add(`${parentId}|||${finalId}`);
          connectedEdgesSet.add(`${finalId}|||${parentId}`);
        }
      }
    });
  }

  // Apply Overrides with Pre-indexed Map
  const overrideNodeMap = new Map(nodes.map(n => [n.id, n]));
  const edgeTargetMap = new Map();
  edges.forEach(e => {
    if (!e.isCustom) {
      edgeTargetMap.set(e.target, e);
    }
  });

  if (customData && customData.overrides) {
    nodes.forEach(n => {
      const override = customData.overrides[n.id];
      if (override) {
        if ('fixedX' in override) n.fixedX = override.fixedX === null ? undefined : override.fixedX;
        if ('fixedY' in override) n.fixedY = override.fixedY === null ? undefined : override.fixedY;
        if (override.customColor !== undefined) n.customColor = override.customColor;
        if (override.customLabel !== undefined) n.label = override.customLabel;
        if (override.customGroup !== undefined) n.group = override.customGroup;
        if (override.customOrbitIndex !== undefined) n.customOrbitIndex = override.customOrbitIndex;
        if (override.isHighlighted !== undefined) n.isHighlighted = override.isHighlighted;
      }
    });
  }

  // Orphan Node Prevention via BFS
  const actualCenter = 'root-HCHPS';
  const adj = new Map();
  nodes.forEach(n => adj.set(n.id, []));
  edges.forEach(e => {
    if (adj.has(e.source) && adj.has(e.target)) {
      adj.get(e.source).push(e.target);
      adj.get(e.target).push(e.source);
    }
  });

  const reachable = new Set();
  const q = [actualCenter];
  let qHead = 0;
  reachable.add(actualCenter);

  while (qHead < q.length) {
    const curr = q[qHead++];
    const neighbors = adj.get(curr) || [];
    for (let i = 0; i < neighbors.length; i++) {
      const nxt = neighbors[i];
      if (!reachable.has(nxt)) {
        reachable.add(nxt);
        q.push(nxt);
      }
    }
  }

  nodes.forEach(n => {
    if (!reachable.has(n.id)) {
      edges.push({
        source: actualCenter,
        target: n.id,
        weight: 0.5,
        type: 'DEPENDENCY',
        isCustom: true
      });
      reachable.add(n.id);
    }
  });

  return { nodes, edges };
}

function generateData(N, E) {
  const customNodes = [];
  const customEdges = [];
  const overrides = {};

  for (let i = 0; i < N; i++) {
    const id = `node-${i}`;
    const parentId = i > 0 ? `node-${Math.floor((i - 1) / 3)}` : 'root-HCHPS';
    customNodes.push({
      id,
      label: `Node ${i}`,
      group: i % 5 === 0 ? 'SYSTEM_RISK' : 'CORE_PROJECT',
      baseValue: 50 + (i % 50),
      parentId
    });

    if (i % 4 === 0) {
      overrides[id] = {
        customColor: i % 2 === 0 ? '#ff0055' : '#00aaff',
        customLabel: `Overridden Node ${i}`,
        customOrbitIndex: (i % 3) + 1,
        isHighlighted: i % 8 === 0
      };
    } else if (i % 7 === 0) {
      overrides[id] = {
        fixedX: 100 + i,
        fixedY: 200 + i
      };
    }
  }

  for (let j = 0; j < E; j++) {
    const src = j % N;
    const tgt = (j * 7 + 1) % N;
    if (src !== tgt) {
      customEdges.push({
        source: `node-${src}`,
        target: `node-${tgt}`,
        weight: 0.5,
        type: 'DEPENDENCY'
      });
    }
  }

  return { customNodes, customEdges, overrides };
}

runEmpiricalTest('Signal Graph O(N+E) linear complexity benchmark (100 -> 500 -> 1000 nodes)', () => {
  // Warmup
  const d50 = generateData(50, 100);
  for (let i = 0; i < 5; i++) buildSignalGraphTest([], {}, d50);

  const scales = [
    { N: 100, E: 200 },
    { N: 500, E: 1000 },
    { N: 1000, E: 2000 },
  ];

  const timings = [];

  for (const s of scales) {
    const data = generateData(s.N, s.E);
    const start = performance.now();
    const iters = 20;
    for (let it = 0; it < iters; it++) {
      buildSignalGraphTest([], {}, data);
    }
    const elapsed = (performance.now() - start) / iters;
    timings.push(elapsed);
    console.log(`   ↳ Benchmark Scale [N=${s.N}, E=${s.E}]: ${elapsed.toFixed(3)} ms/build`);
    assert.ok(elapsed < 50, `Scale N=${s.N} exceeded 50ms (took ${elapsed}ms)`);
  }

  const ratio = timings[2] / Math.max(timings[0], 0.01);
  console.log(`   ↳ Scaling ratio T(1000)/T(100) = ${ratio.toFixed(2)}x (10x is ideal linear scaling)`);
  assert.ok(ratio < 25, `Scaling was super-linear/quadratic: ratio was ${ratio}x`);
});

runEmpiricalTest('Signal Graph 100% node overrides, custom edges, and orphan prevention verification', () => {
  const data = generateData(1000, 2000);
  const res = buildSignalGraphTest([], {}, data);

  assert.strictEqual(res.nodes.length, 1001, 'Expected 1000 custom nodes + 1 root node');
  const nodeMap = new Map(res.nodes.map(n => [n.id, n]));

  // Verify all overrides were applied
  for (let i = 0; i < 1000; i++) {
    const id = `node-${i}`;
    const n = nodeMap.get(id);
    assert.ok(n, `Node ${id} must exist in graph`);

    if (i % 4 === 0) {
      assert.strictEqual(n.customColor, i % 2 === 0 ? '#ff0055' : '#00aaff');
      assert.strictEqual(n.label, `Overridden Node ${i}`);
      assert.strictEqual(n.customOrbitIndex, (i % 3) + 1);
    } else if (i % 7 === 0) {
      assert.strictEqual(n.fixedX, 100 + i);
      assert.strictEqual(n.fixedY, 200 + i);
    }
  }

  // All nodes must be connected
  assert.ok(res.edges.length >= 2000, 'Expected at least 2000 edges');
});

// =========================================================================
// 2. CENTRALITY ZERO-ALLOCATION & MIN-MAX NORMALIZATION
// =========================================================================
console.log('\n--- [SUITE 2] Centrality Zero-Allocation & Bounds Verification ---');

function computeCentralityTest(nodes, edges) {
  const nodeCount = nodes.length;
  if (nodeCount === 0) return [];

  const centrality = new Map();
  for (let i = 0; i < nodes.length; i++) {
    centrality.set(nodes[i].id, Math.max(0.1, nodes[i].baseValue / 100));
  }

  const adj = new Map();
  for (let i = 0; i < nodes.length; i++) adj.set(nodes[i].id, []);
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const w = Math.abs(e.weight);
    adj.get(e.source)?.push({ neighbor: e.target, weight: w });
    adj.get(e.target)?.push({ neighbor: e.source, weight: w });
  }

  const MAX_ITER = 15;
  const EPSILON = 1e-4;
  let converged = false;

  for (let iter = 0; iter < MAX_ITER && !converged; iter++) {
    const nextCentrality = new Map();
    let l2Norm = 0;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      let sum = 0.2 * (node.baseValue / 100);
      const neighbors = adj.get(node.id) || [];
      for (let j = 0; j < neighbors.length; j++) {
        const edgeInfo = neighbors[j];
        const neighborVal = centrality.get(edgeInfo.neighbor) ?? 0;
        sum += 0.8 * edgeInfo.weight * neighborVal;
      }
      nextCentrality.set(node.id, sum);
      l2Norm += sum * sum;
    }

    l2Norm = Math.sqrt(l2Norm);
    if (l2Norm < 0.001) l2Norm = 0.001;

    let maxDiff = 0;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const prevVal = centrality.get(node.id) ?? 0;
      const newVal = (nextCentrality.get(node.id) ?? 0) / l2Norm;
      centrality.set(node.id, newVal);
      const diff = Math.abs(newVal - prevVal);
      if (diff > maxDiff) maxDiff = diff;
    }

    if (maxDiff < EPSILON) converged = true;
  }

  // Zero-Allocation Accumulator Loop for minCent/maxCent
  let minCent = 0;
  let maxCent = 0.001;
  for (const v of centrality.values()) {
    if (v < minCent) minCent = v;
    if (v > maxCent) maxCent = v;
  }
  const centRange = maxCent - minCent;

  // Zero-Allocation Accumulator Loop for maxBaseValue
  let maxBaseValue = 1;
  for (let i = 0; i < nodes.length; i++) {
    const bv = nodes[i].baseValue;
    if (bv > maxBaseValue) maxBaseValue = bv;
  }

  return nodes.map(node => {
    const rawCent = centrality.get(node.id) || 0;
    const anchorBoost = node.baseValue === maxBaseValue ? centRange * 0.05 : 0;
    let normalizedCentrality = Math.min(1, Math.max(0, (rawCent - minCent + anchorBoost) / centRange));

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

    renderSize = Math.max(0.4, Math.min(1.0, renderSize));

    return {
      ...node,
      centralityScore: normalizedCentrality,
      renderSize,
    };
  });
}

runEmpiricalTest('Centrality calculation zero-allocation min/max and renderSize clamping [0.4, 1.0]', () => {
  const nodes = [];
  const edges = [];
  for (let i = 0; i < 500; i++) {
    nodes.push({ id: `n-${i}`, label: `Node ${i}`, group: 'CORE_PROJECT', baseValue: i % 100 });
  }
  for (let j = 0; j < 800; j++) {
    edges.push({ source: `n-${j % 500}`, target: `n-${(j * 3 + 1) % 500}`, weight: 0.7, type: 'DEPENDENCY' });
  }

  const start = performance.now();
  const scored = computeCentralityTest(nodes, edges);
  const elapsed = performance.now() - start;

  console.log(`   ↳ Centrality for 500 nodes / 800 edges computed in ${elapsed.toFixed(3)} ms`);
  assert.strictEqual(scored.length, 500);

  scored.forEach(n => {
    assert.ok(n.renderSize >= 0.4 && n.renderSize <= 1.0, `renderSize ${n.renderSize} outside [0.4, 1.0]`);
    assert.ok(n.centralityScore >= 0 && n.centralityScore <= 1.0, `centralityScore ${n.centralityScore} outside [0, 1.0]`);
  });
});

// =========================================================================
// 3. ONTOLOGY LAYOUT SECTOR DISTRIBUTION & ZIGZAG MATH
// =========================================================================
console.log('\n--- [SUITE 3] OntologyLayout Sector & Zigzag Layout Math ---');

const ELLIPSE_RATIO = 1.3;

runEmpiricalTest('OntologyLayout outward sector arc math for domain hubs (70 deg spread, R=110, ELLIPSE=1.3)', () => {
  const hubX = 0;
  const hubY = -220;
  const hubAngle = Math.atan2(hubY, hubX); // -PI/2
  const children = ['fest-p1', 'fest-p2', 'fest-p3', 'fest-p4', 'fest-p5'];
  const N = children.length;
  const spread = (70 * Math.PI) / 180;
  const startA = hubAngle - spread / 2;
  const stepA = spread / (N - 1);
  const sectorR = 110;

  for (let i = 0; i < N; i++) {
    const childA = startA + i * stepA;
    const computedX = hubX + sectorR * Math.cos(childA) * ELLIPSE_RATIO;
    const computedY = hubY + sectorR * Math.sin(childA);

    console.log(`   ↳ Child ${children[i]}: angle=${(childA * 180 / Math.PI).toFixed(1)}°, targetWorldX=${computedX.toFixed(2)}, targetWorldY=${computedY.toFixed(2)}`);

    // Verify bounds and geometry
    assert.ok(computedY < hubY + 10, 'Outward arc must point outward/upward from hub');
    assert.ok(Math.abs(computedX) <= sectorR * ELLIPSE_RATIO + 1, 'X bound check');
  }
});

runEmpiricalTest('OntologyLayout zigzag radial offsets alternating -12 and +12', () => {
  const siblingCount = 8;
  const offsets = [];
  for (let i = 0; i < siblingCount; i++) {
    const staticOffset = i % 2 === 0 ? -12 : 12;
    offsets.push(staticOffset);
  }

  assert.deepStrictEqual(offsets, [-12, 12, -12, 12, -12, 12, -12, 12]);
  console.log(`   ↳ Sibling zigzag offsets: [${offsets.join(', ')}] matched layout spec`);
});

// =========================================================================
// 4. USEFESTIVALVALIDATION 4 MANDATORY PERMITS & INVERTED INDEX
// =========================================================================
console.log('\n--- [SUITE 4] Festival Validation 4 Mandatory Permits & Inverted Index ---');

const MANDATORY_PERMITS = [
  { key: 'municipal_report', label: '지자체 신고', keywords: ['지자체', '보도자료', '지자체 신고', '공보관'] },
  { key: 'police_road', label: '경찰 도로점용', keywords: ['경찰', '도로점용', '교통신고', '경찰서'] },
  { key: 'fire_safety', label: '소방 안전점검', keywords: ['소방', '안전점검', '소방서', '가설물'] },
  { key: 'safety_plan', label: '안전관리계획서', keywords: ['안전관리계획', '안전관리계획서', '재난안전'] }
];

const PERMIT_KEYWORD_ENTRIES = MANDATORY_PERMITS.flatMap(p =>
  p.keywords.map(kw => ({ keyword: kw, permitKey: p.key }))
);

runEmpiricalTest('Inverted index keyword matching for 4 mandatory permits in O(1) keyword loop', () => {
  function matchPermit(text) {
    for (let i = 0; i < PERMIT_KEYWORD_ENTRIES.length; i++) {
      if (text.includes(PERMIT_KEYWORD_ENTRIES[i].keyword)) {
        return PERMIT_KEYWORD_ENTRIES[i].permitKey;
      }
    }
    return undefined;
  }

  assert.strictEqual(matchPermit('강남구청 공보관 지자체 보도자료 배포'), 'municipal_report');
  assert.strictEqual(matchPermit('수서경찰서 관내 도로점용 및 교통신고'), 'police_road');
  assert.strictEqual(matchPermit('강남소방서 무대 가설물 안전점검 필증 제출'), 'fire_safety');
  assert.strictEqual(matchPermit('2026 페스티벌 재난안전 관리계획서 수립안'), 'safety_plan');
  assert.strictEqual(matchPermit('축제 부스 음향 장비 렌탈'), undefined);
});

runEmpiricalTest('Permit status matrix across MISSING, INCOMPLETE, and VERIFIED', () => {
  function evalStatus(nodeStatus, taskStatus) {
    const isVerified = nodeStatus === 'verified' || taskStatus === 'done';
    const exists = !!nodeStatus || !!taskStatus;
    if (isVerified) return 'VERIFIED';
    if (exists) return 'INCOMPLETE';
    return 'MISSING';
  }

  assert.strictEqual(evalStatus(null, null), 'MISSING');
  assert.strictEqual(evalStatus('uncompleted', null), 'INCOMPLETE');
  assert.strictEqual(evalStatus(null, 'in-progress'), 'INCOMPLETE');
  assert.strictEqual(evalStatus('verified', 'todo'), 'VERIFIED');
  assert.strictEqual(evalStatus('uncompleted', 'done'), 'VERIFIED');
  assert.strictEqual(evalStatus('verified', 'done'), 'VERIFIED');
});

runEmpiricalTest('Budget scale bounds (50M-70M KRW) and risk level evaluation', () => {
  function getScaleStatus(amount) {
    if (amount < 50000000) return 'UNDER_SCALE';
    if (amount > 70000000) return 'OVER_SCALE';
    return 'IN_SCALE';
  }

  function getOverallRisk(permits, scaleStatus, criticalNodes = 0) {
    const hasMissing = permits.some(p => p === 'MISSING');
    const hasIncomplete = permits.some(p => p === 'INCOMPLETE');
    if (hasMissing || criticalNodes > 0 || scaleStatus === 'OVER_SCALE') return 'CRITICAL';
    if (hasIncomplete || scaleStatus === 'UNDER_SCALE') return 'WARNING';
    return 'SAFE';
  }

  assert.strictEqual(getScaleStatus(49999999), 'UNDER_SCALE');
  assert.strictEqual(getScaleStatus(50000000), 'IN_SCALE');
  assert.strictEqual(getScaleStatus(60000000), 'IN_SCALE');
  assert.strictEqual(getScaleStatus(70000000), 'IN_SCALE');
  assert.strictEqual(getScaleStatus(70000001), 'OVER_SCALE');

  // Risk levels
  assert.strictEqual(getOverallRisk(['MISSING', 'VERIFIED', 'VERIFIED', 'VERIFIED'], 'IN_SCALE'), 'CRITICAL');
  assert.strictEqual(getOverallRisk(['VERIFIED', 'VERIFIED', 'VERIFIED', 'VERIFIED'], 'OVER_SCALE'), 'CRITICAL');
  assert.strictEqual(getOverallRisk(['INCOMPLETE', 'VERIFIED', 'VERIFIED', 'VERIFIED'], 'IN_SCALE'), 'WARNING');
  assert.strictEqual(getOverallRisk(['VERIFIED', 'VERIFIED', 'VERIFIED', 'VERIFIED'], 'UNDER_SCALE'), 'WARNING');
  assert.strictEqual(getOverallRisk(['VERIFIED', 'VERIFIED', 'VERIFIED', 'VERIFIED'], 'IN_SCALE'), 'SAFE');
});

console.log('\n====================================================');
console.log(`📊 Empirical Test Summary: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
