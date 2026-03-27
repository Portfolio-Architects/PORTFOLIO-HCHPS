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
  entries: SignalEntry[],
  customData?: {
    overrides: Record<string, { fixedX?: number; fixedY?: number; customColor?: string; customLabel?: string; customGroup?: string }>;
    customNodes: OntologyNode[];
    customEdges: OntologyEdge[];
  }
): OntologyGraph {
  const nodes: OntologyNode[] = [];
  const edges: OntologyEdge[] = [];

  if (entries.length === 0) {
    return {
      nodes: [{ id: 'empty', label: '엔트리가 없습니다', group: 'OTHER', baseValue: 50 }],
      edges: [],
    };
  }

  // 1. Root Node (HCHPS) - Center of the tree
  nodes.push({
    id: 'root-HCHPS',
    label: 'HCHPS',
    group: 'CORE_PROJECT', // Vivid Blue
    baseValue: 100,
    centralityScore: 10000,
  });

  // 2. Extract Orbit 1 Tags (Category constraints from Tasks/Modules)
  const tagCounts = new Map<string, number>();
  let hasRawSignals = false;

  entries.forEach(e => {
    if (!e.tags || e.tags.length === 0) hasRawSignals = true;
    e.tags?.forEach(t => {
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    });
  });

  // Force '미분류' / '내 생각' branch if there are raw signals
  if (hasRawSignals) {
    tagCounts.set('💭 미분류', 9999); 
  }

  // Take top N tags to avoid clutter
  const sortedTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  const tagNodesMap = new Map<string, string>();

  // Add Orbit 1 Nodes
  sortedTags.forEach(([tag, count], i) => {
    const id = `tag-${tag}`;
    tagNodesMap.set(tag, id);
    nodes.push({
      id,
      label: tag === '💭 미분류' ? tag : `#${tag}`,
      group: 'MACRO_RESEARCH', // Emerald color for categories
      baseValue: 80,
      centralityScore: 1000 - i, // Orbit 1
    });
    // Create structural branch from Sun to Category
    edges.push({
      source: 'root-HCHPS',
      target: id,
      weight: 1.0,
      type: 'CAUSAL_DRIVE',
    });
  });

  // 3. Process Leaves (Keywords) & Map to Categories
  const keywordFreqByTag = new Map<string, Map<string, number>>();

  entries.forEach(e => {
    let applicableTags = e.tags?.filter(t => tagNodesMap.has(t)) || [];
    
    // Pure signal routing: Does it match a category keyword?
    if (applicableTags.length === 0) {
      const matched = e.keywords.filter(kw => tagNodesMap.has(kw));
      if (matched.length > 0) applicableTags = matched;
      else if (tagNodesMap.has('💭 미분류')) applicableTags = ['💭 미분류'];
    }

    applicableTags.forEach(tag => {
      const tagMap = keywordFreqByTag.get(tag) || new Map<string, number>();
      e.keywords.forEach(kw => {
        // Exclude the category name itself from the leaves
        if (kw !== tag) { 
          tagMap.set(kw, (tagMap.get(kw) || 0) + 1);
        }
      });
      keywordFreqByTag.set(tag, tagMap);
    });
  });

  // Create Leaf Nodes & Branched Edges
  keywordFreqByTag.forEach((kwMap, tag) => {
    const tagNodeId = tagNodesMap.get(tag)!;
    // Top 8 keywords per branch to prevent chaos
    const sortedKw = Array.from(kwMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8); 

    sortedKw.forEach(([kw, freq], i) => {
      const leafId = `leaf-${tagNodeId}-${kw}`;
      nodes.push({
        id: leafId,
        label: kw,
        group: 'DATA_PIPELINE', // Amber/Cyan leaves
        baseValue: Math.min(60, 30 + freq * 10),
        centralityScore: 100 + freq, // Orbit 2+
        parentId: tagNodeId,
      });
      // Branch off the Orbit 1 node
      edges.push({
        source: tagNodeId,
        target: leafId,
        weight: 0.7, 
        type: 'DEPENDENCY',
      });
    });
  });

  // 4. Merge Custom Nodes and Edges from Whiteboard
  if (customData) {
    customData.customNodes.forEach(cn => nodes.push(cn));
    customData.customEdges.forEach(ce => edges.push(ce));

    // Apply Overrides (Pins, Colors, Labels, Groups)
    nodes.forEach(n => {
      const override = customData.overrides[n.id];
      if (override) {
        if (override.fixedX !== undefined) n.fixedX = override.fixedX;
        if (override.fixedY !== undefined) n.fixedY = override.fixedY;
        if (override.customColor !== undefined) n.customColor = override.customColor;
        if (override.customLabel !== undefined) n.label = override.customLabel;
        if (override.customGroup !== undefined) n.group = override.customGroup as OntologyGroup;
      }
    });
  }

  return { nodes, edges };
}
