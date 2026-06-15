/**
 * Ontology Service — Layer 2
 * 업무 과제 네트워크 파싱 + Eigenvector-Weighted Centrality
 * + 구조적 업무 병목 감지 파이프라인
 *
 * 데이터 프롬프트 싱크:
 *   - ID 체계: N01~N100 순차 부여
 *   - Label: 최대 2단어(어절)
 *   - SYSTEM_RISK base_value: 31~40 강제
 *   - SYSTEM_RISK 연결 weight: 음수(-0.20 ~ -1.00) 강제
 */

import {
  OntologyNode, OntologyEdge, OntologyGraph,
  OntologyGroup, EdgeType,
} from './ontology.types';

// ============ Valid Enums ============

const VALID_GROUPS = new Set<string>([
  'CORE_PROJECT', 'MACRO_RESEARCH', 'DCF_MODELING',
  'DATA_PIPELINE', 'INFRASTRUCTURE', 'SYSTEM_RISK',
]);

const VALID_EDGE_TYPES = new Set<string>([
  'CAUSAL_DRIVE', 'DEPENDENCY', 'FEEDBACK_LOOP', 'BOTTLENECK', 'DECOUPLING',
]);

// ============ Parsing ============

export function parseNodes(rawRows: string[][]): OntologyNode[] {
  if (rawRows.length < 2) return [];

  return rawRows.slice(1) // skip header
    .filter(row => row[0]?.trim())
    .map(row => {
      const id = row[0].trim();
      const label = row[1]?.trim() || id;
      const groupRaw = row[2]?.trim().toUpperCase().replace(/\s+/g, '_') || '';
      const group: OntologyGroup = VALID_GROUPS.has(groupRaw)
        ? groupRaw as OntologyGroup
        : 'OTHER';

      let baseValue = Math.max(0, Math.min(100, parseInt(row[3]) || 50));

      // SYSTEM_RISK 노드는 base_value 31~40 강제 (프롬프트 제약)
      if (group === 'SYSTEM_RISK') {
        baseValue = Math.max(31, Math.min(40, baseValue));
      }

      return { id, label, group, baseValue };
    });
}

export function parseEdges(rawRows: string[][], validNodeIds: Set<string>, nodeGroupMap?: Map<string, string>): OntologyEdge[] {
  if (rawRows.length < 2) return [];

  // Deduplicate: only one edge per pair (first wins → dominant single edge)
  const seen = new Set<string>();

  return rawRows.slice(1)
    .filter(row => {
      const src = row[0]?.trim();
      const tgt = row[1]?.trim();
      if (!src || !tgt || src === tgt) return false;
      if (!validNodeIds.has(src) || !validNodeIds.has(tgt)) return false;
      const key = [src, tgt].sort().join('|||');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(row => {
      const source = row[0].trim();
      const target = row[1].trim();
      const typeRaw = row[2]?.trim().toUpperCase().replace(/\s+/g, '_') || '';
      let weight = Math.max(-1, Math.min(1, parseFloat(row[3]) || 0));

      // SYSTEM_RISK 연결 시 음수 강제 (프롬프트 제약)
      const targetGroup = nodeGroupMap?.get(target);
      const sourceGroup = nodeGroupMap?.get(source);
      if (targetGroup === 'SYSTEM_RISK' || sourceGroup === 'SYSTEM_RISK') {
        if (weight > 0) weight = -weight; // 양수이면 음수로 뒤집기
        weight = Math.min(-0.20, weight); // 최소 -0.20
      }

      return {
        source,
        target,
        type: (VALID_EDGE_TYPES.has(typeRaw) ? typeRaw : 'DEPENDENCY') as EdgeType,
        weight,
      };
    });
}

// ============ Eigenvector-Weighted Centrality ============

export function computeCentrality(
  nodes: OntologyNode[],
  edges: OntologyEdge[],
): OntologyNode[] {
  const nodeCount = nodes.length;
  if (nodeCount === 0) return [];

  const nodeMap = new Map<string, OntologyNode>();
  for (const node of nodes) nodeMap.set(node.id, node);

  // 1. Power Iteration을 통한 고유벡터 중심성 (Eigenvector Centrality) 연산
  // 초기 중요도 설정: baseValue 기반 (최소 0.1)
  const centrality = new Map<string, number>();
  for (const node of nodes) {
    centrality.set(node.id, Math.max(0.1, node.baseValue / 100));
  }

  // 인접 리스트 빌드 (양방향 연결성 가중치 적용)
  const adj = new Map<string, Array<{ neighbor: string; weight: number }>>();
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
    const nextCentrality = new Map<string, number>();
    let l2Norm = 0;

    // Power step
    for (const node of nodes) {
      // 기저 값(기초 중요도) 주입 (0.2 가중치)
      let sum = 0.2 * (node.baseValue / 100);
      
      // 이웃 노드 전파 합산 (0.8 가중치)
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

    // 정규화 및 수렴 체크
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
  const netWeightMap = new Map<string, number>();
  for (const edge of edges) {
    netWeightMap.set(edge.source, (netWeightMap.get(edge.source) || 0) + edge.weight);
    netWeightMap.set(edge.target, (netWeightMap.get(edge.target) || 0) + edge.weight);
  }

  // 3. 리스크 전파 모델 (Risk Propagation Score) 구현
  // SYSTEM_RISK 노드 또는 netWeight가 강한 음수(<-0.4)인 병목 노드를 리스크의 근원지로 규정
  const riskSource = new Map<string, number>();
  for (const node of nodes) {
    const netW = netWeightMap.get(node.id) ?? 0;
    if (node.group === 'SYSTEM_RISK' || netW < -0.4) {
      riskSource.set(node.id, node.group === 'SYSTEM_RISK' ? 1.0 : Math.min(1.0, Math.abs(netW)));
    }
  }

  const riskFactors = new Map<string, number>();
  for (const node of nodes) {
    if (riskSource.has(node.id)) {
      riskFactors.set(node.id, riskSource.get(node.id) ?? 1.0);
      continue;
    }

    // 1-step 인접 엣지들을 통해 유입되는 리스크 가중합 전파 계산
    let maxRiskFromNeighbor = 0;
    const neighbors = adj.get(node.id) || [];
    for (const edgeInfo of neighbors) {
      if (riskSource.has(edgeInfo.neighbor)) {
        const sourceRisk = riskSource.get(edgeInfo.neighbor) ?? 1.0;
        // 리스크 엣지 가중치 곱
        const propagatedRisk = sourceRisk * edgeInfo.weight;
        if (propagatedRisk > maxRiskFromNeighbor) {
          maxRiskFromNeighbor = propagatedRisk;
        }
      }
    }
    riskFactors.set(node.id, maxRiskFromNeighbor);
  }

  // 중심성 [0, 1] 범위로 Min-Max 정규화
  const centValues = Array.from(centrality.values());
  const minCent = Math.min(...centValues, 0);
  const maxCent = Math.max(...centValues, 0.001);
  const centRange = maxCent - minCent;

  // 4. 레이어 보너스 (Layer Boost) 및 최종 renderSize 비선형 스케일 바인딩
  const maxBaseValue = Math.max(...nodes.map(n => n.baseValue), 1);

  return nodes.map(node => {
    const rawCent = centrality.get(node.id) || 0;
    // 앵커 부스트 보장
    const anchorBoost = node.baseValue === maxBaseValue ? centRange * 0.05 : 0;
    let normalizedCentrality = Math.min(1, Math.max(0, (rawCent - minCent + anchorBoost) / centRange));
    
    const isForcedCenter = node.id === 'root-HCHPS' || (node.centralityScore && node.centralityScore > 9000000);
    if (isForcedCenter) {
      normalizedCentrality = 9999999;
    }
    
    const netWeight = netWeightMap.get(node.id) ?? 0;
    const riskFactor = riskFactors.get(node.id) ?? 0;

    // 수직적 레이어 보너스 (Layer Boost)
    // 0: 인물 (0.05), 1: 예산/비품 (0.10), 2: 업무/회의 (0.15), 3: 위키/문서 (0.22)
    const layer = node.layerId ?? node.effectiveLayer ?? 2;
    let layerBoost = 0.15;
    if (layer === 0) layerBoost = 0.05;
    else if (layer === 1) layerBoost = 0.10;
    else if (layer === 2) layerBoost = 0.15;
    else if (layer === 3) layerBoost = 0.22;

    // 비선형 스케일링 공식 (0.25 * baseValue + 0.50 * centrality^1.2 + 0.25 * layerBoost)
    let renderSize =
      0.25 * (node.baseValue / 100) +
      0.50 * Math.pow(normalizedCentrality, 1.2) +
      0.25 * layerBoost;

    // 리스크가 극심한 주의 노드는 시각적 강조를 위해 미세 스케일 보정 (+0.03)
    if (riskFactor > 0.5) {
      renderSize += 0.03;
    }

    // [0.4, 1.0] 범위로 안전 클램핑 적용
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

// ============ Graph Build Pipeline ============

export function buildOntologyGraph(
  nodesRaw: string[][],
  edgesRaw: string[][],
): OntologyGraph {
  const nodes = parseNodes(nodesRaw);
  const validIds = new Set(nodes.map(n => n.id));

  // 노드 그룹 맵 → 엣지 파싱 시 SYSTEM_RISK 음수 강제에 사용
  const groupMap = new Map(nodes.map(n => [n.id, n.group]));

  const edges = parseEdges(edgesRaw, validIds, groupMap);
  const scoredNodes = computeCentrality(nodes, edges);
  return { nodes: scoredNodes, edges };
}
