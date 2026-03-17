/**
 * Signal Graph Builder — 시그널 키워드에서 온톨로지 그래프 생성
 * 사용자의 시그널 입력에서 추출된 키워드를 노드로,
 * 같은 문장에 함께 등장한 키워드 간에 엣지를 생성
 */

import { OntologyGraph, OntologyNode, OntologyEdge, OntologyGroup } from './ontology.types';
import { SignalEntry } from '@/hooks/useSignal';

// Assign color groups based on keyword frequency
function assignGroup(frequency: number, maxFreq: number): OntologyGroup {
  const ratio = frequency / Math.max(maxFreq, 1);
  if (ratio >= 0.7) return 'CORE_PROJECT';        // 매우 자주 (파란색)
  if (ratio >= 0.5) return 'MACRO_RESEARCH';       // 자주 (에메랄드)
  if (ratio >= 0.3) return 'DCF_MODELING';          // 보통 (보라색)
  if (ratio >= 0.15) return 'DATA_PIPELINE';        // 가끔 (앰버)
  return 'INFRASTRUCTURE';                          // 드물게 (시안)
}

export function buildSignalGraph(
  keywordMap: Record<string, number>,
  entries: SignalEntry[]
): OntologyGraph {
  const keywords = Object.entries(keywordMap);

  if (keywords.length === 0) {
    // Return a minimal sample graph when no data
    return {
      nodes: [
        { id: 'empty', label: '시그널을 입력해주세요', group: 'OTHER', baseValue: 50 },
      ],
      edges: [],
    };
  }

  // Sort by frequency, take top N
  const sorted = keywords.sort((a, b) => b[1] - a[1]);
  const topN = sorted.slice(0, 30); // Limit to 30 nodes
  const maxFreq = topN[0]?.[1] || 1;

  // Build nodes
  const nodeMap = new Map<string, string>(); // keyword -> nodeId
  const nodes: OntologyNode[] = topN.map(([keyword, freq], i) => {
    const id = `S${String(i + 1).padStart(2, '0')}`;
    nodeMap.set(keyword, id);
    return {
      id,
      label: keyword,
      group: assignGroup(freq, maxFreq),
      baseValue: Math.max(30, Math.min(100, Math.round((freq / maxFreq) * 100))),
    };
  });

  // Build edges: keywords that co-occur in the same entry are connected
  const edgeWeights = new Map<string, number>();

  for (const entry of entries) {
    const relevantKeywords = entry.keywords.filter(kw => nodeMap.has(kw));
    for (let i = 0; i < relevantKeywords.length; i++) {
      for (let j = i + 1; j < relevantKeywords.length; j++) {
        const a = nodeMap.get(relevantKeywords[i])!;
        const b = nodeMap.get(relevantKeywords[j])!;
        const key = [a, b].sort().join('-');
        edgeWeights.set(key, (edgeWeights.get(key) || 0) + 1);
      }
    }
  }

  const maxEdgeWeight = Math.max(...Array.from(edgeWeights.values()), 1);
  const edges: OntologyEdge[] = Array.from(edgeWeights.entries()).map(([key, weight]) => {
    const [source, target] = key.split('-');
    return {
      source,
      target,
      weight: Math.max(0.2, (weight / maxEdgeWeight) * 0.9),
      type: 'DEPENDENCY' as const,
    };
  });

  return { nodes, edges };
}
