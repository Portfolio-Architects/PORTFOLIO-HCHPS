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
  const baseValueMap = new Map<string, number>();
  for (const node of nodes) baseValueMap.set(node.id, node.baseValue);

  // Step 1: Eigenvector-weighted centrality
  // centrality[A] += |weight| × (baseValue_of_B / 100)
  const centrality = new Map<string, number>();
  const netWeightMap = new Map<string, number>();

  for (const edge of edges) {
    const w = Math.abs(edge.weight);
    const sourceBase = (baseValueMap.get(edge.source) ?? 50) / 100;
    const targetBase = (baseValueMap.get(edge.target) ?? 50) / 100;

    centrality.set(edge.source, (centrality.get(edge.source) || 0) + w * targetBase);
    centrality.set(edge.target, (centrality.get(edge.target) || 0) + w * sourceBase);

    // Step 3: signed weight accumulation — 구조적 업무 병목 감지
    netWeightMap.set(edge.source, (netWeightMap.get(edge.source) || 0) + edge.weight);
    netWeightMap.set(edge.target, (netWeightMap.get(edge.target) || 0) + edge.weight);
  }

  // Normalize centrality to [0, 1]
  const maxCentrality = Math.max(...Array.from(centrality.values()), 0.001);

  // 앵커 노드 보장: base_value 최대 노드에 기본 centrality 부스트
  // (엣지가 없어도 중심에 배치되도록)
  const maxBaseValue = Math.max(...nodes.map(n => n.baseValue));

  return nodes.map(node => {
    const raw = centrality.get(node.id) || 0;
    // base_value가 최대인 노드에 centrality 보너스 (앵커 보장)
    const anchorBoost = node.baseValue === maxBaseValue ? maxCentrality * 0.1 : 0;
    const normalizedCentrality = Math.min(1, (raw + anchorBoost) / maxCentrality);
    const netWeight = netWeightMap.get(node.id) ?? 0;

    // Step 2: Non-Linear Scaling (Convexity Injection)
    // 0.4 × pow(baseValue/100, 1.2) + 0.6 × pow(centrality, 1.5)
    const renderSize =
      0.4 * Math.pow(node.baseValue / 100, 1.2) +
      0.6 * Math.pow(normalizedCentrality, 1.5);

    return {
      ...node,
      centralityScore: normalizedCentrality,
      renderSize,
      netWeight,
      isHedge: netWeight < 0,
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
