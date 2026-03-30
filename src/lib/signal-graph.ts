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
    overrides: Record<string, { fixedX?: number; fixedY?: number; customColor?: string; customLabel?: string; customGroup?: string; customParent?: string; customOrbitIndex?: number; hidden?: boolean }>;
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
    customColor: '#94a3b8', // 흐릿한 회색 (slate-400)
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
  const tagGroupMap = new Map<string, OntologyGroup>();

  const categoryGroups: OntologyGroup[] = [
    'MACRO_RESEARCH',
    'DCF_MODELING',
    'DATA_PIPELINE',
    'INFRASTRUCTURE',
    'SYSTEM_RISK'
  ];

  // Add Orbit 1 Nodes
  sortedTags.forEach(([tag, count], i) => {
    const id = `tag-${tag}`;
    const groupAssign = categoryGroups[i % categoryGroups.length];
    
    // 1차 카테고리 초기 색상 랜덤 (태그 문자열 해싱 기반으로 안정적인 랜덤 생성)
    let hash = 0;
    for (let j = 0; j < tag.length; j++) {
      hash = tag.charCodeAt(j) + ((hash << 5) - hash);
    }
    
    // Canvas 엔진(colorWithAlpha 등)이 HEX 형식을 요구하므로, 파스텔톤 HEX 팔레트에서 선택
    const hexPalette = [
      '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', 
      '#ef4444', '#14b8a6', '#f97316', '#84cc16', '#6366f1',
      '#0ea5e9', '#d946ef', '#eab308', '#f43f5e', '#8b5cf6'
    ];
    const stableColor = hexPalette[Math.abs(hash) % hexPalette.length];

    tagNodesMap.set(tag, id);
    tagGroupMap.set(tag, groupAssign);

    nodes.push({
      id,
      label: tag === '💭 미분류' ? tag : `#${tag}`,
      group: groupAssign,
      customColor: stableColor,
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
    const branchGroup = tagGroupMap.get(tag) || 'OTHER';
    
    // Top 8 keywords per branch to prevent chaos
    const sortedKw = Array.from(kwMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8); 

    sortedKw.forEach(([kw, freq], i) => {
      const leafId = `leaf-${tagNodeId}-${kw}`;
      nodes.push({
        id: leafId,
        label: kw,
        group: branchGroup, // Inherit category's color
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
    const dataLabels = new Map<string, string>(); // label -> id
    nodes.forEach(n => dataLabels.set(n.label, n.id));

    customData.customNodes.forEach(cn => {
      const override = customData.overrides[cn.id];
      const actualLabel = override?.customLabel || cn.label;

      if (dataLabels.has(actualLabel)) {
        // A data node with this label exists. Transfer overrides and skip rendering the duplicate.
        const dataNodeId = dataLabels.get(actualLabel)!;
        if (override) {
          customData.overrides[dataNodeId] = {
            ...customData.overrides[dataNodeId],
            fixedX: override.fixedX ?? customData.overrides[dataNodeId]?.fixedX,
            fixedY: override.fixedY ?? customData.overrides[dataNodeId]?.fixedY,
            customColor: override.customColor ?? customData.overrides[dataNodeId]?.customColor,
            customGroup: override.customGroup ?? customData.overrides[dataNodeId]?.customGroup,
          };
        }
        return; // Skip adding `cn`
      }
      nodes.push(cn);
    });

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
        if (override.customOrbitIndex !== undefined) n.customOrbitIndex = override.customOrbitIndex;
        if (override.customParent !== undefined) {
          n.parentId = override.customParent;
          
          // Re-route the structural edge (target === n.id)
          const edge = edges.find(e => e.target === n.id);
          if (edge) {
            edge.source = override.customParent;
          } else {
            edges.push({
              source: override.customParent,
              target: n.id,
              weight: 0.7,
              type: 'DEPENDENCY'
            });
          }
          
          // Sync colour with new parent if custom group/color are not explicitly overridden
          const newParent = nodes.find(pn => pn.id === override.customParent);
          if (newParent && override.customGroup === undefined && override.customColor === undefined) {
            n.group = newParent.group;
            if (newParent.customColor) {
              n.customColor = newParent.customColor;
            } else {
              n.customColor = undefined;
            }
          }
        }
        
        // If the custom node has been successfully pulled into the structural Orbit system, 
        // we must clear its hardcoded fallback creation coordinates so it obeys the physics system!
        if ((override.customOrbitIndex !== undefined || override.customParent !== undefined) && override.fixedX === undefined) {
           n.fixedX = undefined;
           n.fixedY = undefined;
        }
      }
    });
  }

  let finalNodes = nodes;
  let finalEdges = edges;

  // 5. Center Node Override Processing (Hijack Root Mode)
  const forcedCenterNode = finalNodes.find(n => customData?.overrides[n.id]?.customOrbitIndex === 0);
  if (forcedCenterNode) {
    forcedCenterNode.centralityScore = 9999999;
    forcedCenterNode.parentId = undefined;
    forcedCenterNode.group = 'CORE_PROJECT'; // Shift to core group identity
    forcedCenterNode.customColor = '#94a3b8'; // 중앙 노드는 흐릿한 회색 고정
    forcedCenterNode.fixedX = undefined;     // <--- Must clear baked custom node coords to center perfectly!
    forcedCenterNode.fixedY = undefined;
    
    // Find who was the center previously (the one with highest normal centrality among ACTIVE nodes)
    const hiddenSet = new Set<string>();
    finalNodes.forEach(n => { if (customData?.overrides[n.id]?.hidden) hiddenSet.add(n.id); });
    
    const rest = finalNodes.filter(n => n.id !== forcedCenterNode.id && !hiddenSet.has(n.id)).sort((a,b) => (b.centralityScore ?? 0) - (a.centralityScore ?? 0));
    const oldCenter = rest[0];
    
    if (oldCenter) {
      finalEdges.forEach(e => {
        // Transfer all driving branches from Old Center to New Center
        if (e.source === oldCenter.id) {
          e.source = forcedCenterNode.id;
        }
        // Remove incoming edges targeting the New Center to prevent structural loops
        if (e.target === forcedCenterNode.id) {
          e.source = forcedCenterNode.id; // Mark as self-loop to be filtered out
        }
      });
      // Formally push the old Center into Orbit 1 as a category of the new forced center
      finalEdges.push({
        source: forcedCenterNode.id,
        target: oldCenter.id,
        weight: 1.0,
        type: 'CAUSAL_DRIVE'
      });
      
      // Clean self-referencing edges
      finalEdges = finalEdges.filter(e => e.source !== e.target);
    }
  }

  if (customData) {
    const hiddens = new Set<string>();
    nodes.forEach(n => {
      if (customData.overrides[n.id]?.hidden) hiddens.add(n.id);
    });

    if (hiddens.size > 0) {
      finalNodes = nodes.filter(n => !hiddens.has(n.id));
      finalEdges = edges.filter(e => !hiddens.has(e.source) && !hiddens.has(e.target));
    }
  }

  // --- 6. Top-Down Color Inheritance ---
  // 1차 카테고리의 색상을 하위 노드 전체로 전파합니다.
  const childMap = new Map<string, string[]>();
  finalEdges.forEach(e => {
    const current = childMap.get(e.source) || [];
    current.push(e.target);
    childMap.set(e.source, current);
  });

  const rootId = forcedCenterNode ? forcedCenterNode.id : 'root-HCHPS';
  const queue = childMap.get(rootId) ? [...childMap.get(rootId)!] : []; 
  const visited = new Set<string>([rootId]);
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    
    const currentNode = finalNodes.find(n => n.id === currentId);
    if (!currentNode) continue;

    const parentEdge = finalEdges.find(e => e.target === currentId);
    if (parentEdge) {
      const parentNode = finalNodes.find(n => n.id === parentEdge.source);
      // 부모 노드가 시각적 색상을 갖고 있고, 중앙 노드(rootId)가 아니라면 색상을 다단계로 전파
      if (parentNode && parentNode.customColor && parentNode.id !== rootId) {
        // 단, 사용자가 명시적으로 색상을 지정한 노드는 덮어쓰지 않음
        const explicitOverride = customData?.overrides[currentId]?.customColor;
        if (!explicitOverride) {
          currentNode.customColor = parentNode.customColor;
        }
      }
    }

    const children = childMap.get(currentId) || [];
    queue.push(...children);
  }

  return { nodes: finalNodes, edges: finalEdges };
}
