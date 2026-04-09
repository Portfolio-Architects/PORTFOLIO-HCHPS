/**
 * Signal Graph Builder — 시그널 키워드에서 온톨로지 그래프 생성
 * 사용자의 시그널 입력에서 추출된 키워드를 노드로,
 * 같은 문장에 함께 등장한 키워드 간에 엣지를 생성
 */

import { OntologyGraph, OntologyNode, OntologyEdge, OntologyGroup } from './ontology.types';
import { SignalEntry } from '@/hooks/useSignal';
import { NodeOverride } from '@/hooks/useGraphCustomization';

export type PartialOntologyEdge = OntologyEdge & { isCustom?: boolean };
export type PartialOntologyNode = OntologyNode & { isExplicitColor?: boolean };

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
    overrides: Record<string, NodeOverride>;
    customNodes: OntologyNode[];
    customEdges: OntologyEdge[];
    deletedEdges?: string[];
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
      label: tag,
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

  // 3.5. Inject AI Curation Graph Connectivity (Phase 3)
  // entries 배열을 순환하며 LLM이 추천한 relatedKeywords가 그래프 상에 존재할 경우 횡적 엣지를 추가합니다.
  entries.forEach(e => {
    if (e.aiCurated && e.curationData?.relatedKeywords) {
      // 이 Signal이 만들어낸 주된 리프 노드 ID를 역추적 (복잡하므로 카테고리에 할당)
      // 또는 Signal 전체를 대표하는 태그 노드를 찾습니다.
      const sourceTags = e.tags?.filter(t => tagNodesMap.has(t)) || [];
      if (sourceTags.length > 0) {
        const sourceTagId = tagNodesMap.get(sourceTags[0]);
        if (sourceTagId) {
          e.curationData.relatedKeywords.forEach(rk => {
            // relatedKeyword가 기존 리프 노드 레이블이거나 태그 레이블인지 찾습니다.
            const targetTagId = tagNodesMap.get(rk);
            if (targetTagId && targetTagId !== sourceTagId) {
               // AI Recommendation: Category to Category structural cross-link
               edges.push({
                 source: sourceTagId,
                 target: targetTagId,
                 weight: 0.4,
                 type: 'FEEDBACK_LOOP',
               });
            } else {
               // 키워드 간의 횡적 연결을 시도 (매우 느슨한 네트워크)
               const existingNode = nodes.find(n => n.label === rk);
               if (existingNode && existingNode.id !== sourceTagId) {
                 edges.push({
                   source: sourceTagId,
                   target: existingNode.id,
                   weight: 0.3,
                   type: 'DEPENDENCY', // AI 추천 엣지
                 });
               }
            }
          });
        }
      }
    }
  });

  // 4. Merge Custom Nodes and Edges from Whiteboard
  if (customData) {
    const dataLabels = new Map<string, string>(); // label -> id
    nodes.forEach(n => dataLabels.set(n.label, n.id));
    
    // 유령 노드(Ghost Node) 방지: 삭제된 커스텀 노드의 ID와, 이를 대체한 실제 데이터 노드의 ID 매핑
    const mergedIdMap = new Map<string, string>();

    customData.customNodes.forEach(cn => {
      const override = customData.overrides[cn.id];
      const actualLabel = override?.customLabel || cn.label;

      if (dataLabels.has(actualLabel)) {
        // A data node with this label exists. Transfer overrides and skip rendering the duplicate.
        const dataNodeId = dataLabels.get(actualLabel)!;
        mergedIdMap.set(cn.id, dataNodeId);
        
        if (override) {
          const targetOverride = customData.overrides[dataNodeId] || {};
          
          const resolveProp = <K extends keyof NodeOverride>(key: K) => {
            if (targetOverride[key] !== undefined) {
              return targetOverride[key] === null ? undefined : targetOverride[key];
            }
            return override[key] === null ? undefined : override[key];
          };

          customData.overrides[dataNodeId] = {
            ...targetOverride,
            fixedX: resolveProp('fixedX'),
            fixedY: resolveProp('fixedY'),
            customColor: resolveProp('customColor'),
            customGroup: resolveProp('customGroup'),
            customParent: resolveProp('customParent'),
            customOrbitIndex: resolveProp('customOrbitIndex'),
            customLabel: resolveProp('customLabel'),
            customSortOrder: resolveProp('customSortOrder'),
            hidden: resolveProp('hidden'),
            isPerson: resolveProp('isPerson'),
            dueDate: resolveProp('dueDate'),
            isHighlighted: resolveProp('isHighlighted'),
            isCompleted: resolveProp('isCompleted'),
          };
        }
        return; // Skip adding `cn`
      }
      nodes.push(cn);
    });

    // Remap any ghost customParent references to their merged ALIVE IDs
    Object.keys(customData.overrides).forEach(key => {
      let override = customData.overrides[key];
      if (override && override.customParent && mergedIdMap.has(override.customParent)) {
        // 재귀적 고스트가 발생하지 않도록 대체된 ID를 주입
        override.customParent = mergedIdMap.get(override.customParent)!;
      }
    });

    customData.customEdges.forEach(ce => {
      const finalSource = mergedIdMap.get(ce.source) || ce.source;
      const finalTarget = mergedIdMap.get(ce.target) || ce.target;
      edges.push({ ...ce, source: finalSource, target: finalTarget, isCustom: true } as PartialOntologyEdge);
    });

    // (DeletedEdges processing moved to the end of custom mapping to catch customParent generated edges)

    // Apply Overrides (Pins, Colors, Labels, Groups)
    nodes.forEach(n => {
      const override = customData.overrides[n.id];
      if (override) {
        // --- 지정 좌표(fixed X,Y) 강제 반영 ---
        if ('fixedX' in override) n.fixedX = override.fixedX === null ? undefined : override.fixedX;
        if ('fixedY' in override) n.fixedY = override.fixedY === null ? undefined : override.fixedY;

        if (override.customColor !== undefined) {
          n.customColor = override.customColor === null ? undefined : override.customColor;
          if (n.customColor) (n as PartialOntologyNode).isExplicitColor = true;
        }
        if (override.customLabel !== undefined) n.label = override.customLabel === null ? n.label : (override.customLabel as string);
        if (override.customGroup !== undefined) n.group = override.customGroup === null ? n.group : (override.customGroup as OntologyGroup);
        if (override.customOrbitIndex !== undefined) n.customOrbitIndex = override.customOrbitIndex === null ? undefined : override.customOrbitIndex;
        if (override.customSortOrder !== undefined) n.customSortOrder = override.customSortOrder === null ? undefined : override.customSortOrder;
        if (override.isPerson !== undefined) n.isPerson = override.isPerson === null ? undefined : override.isPerson;
        if (override.dueDate !== undefined) n.dueDate = override.dueDate === null ? undefined : override.dueDate;
        if (override.isHighlighted !== undefined) n.isHighlighted = override.isHighlighted === null ? undefined : override.isHighlighted;
        if (override.isCompleted !== undefined) n.isCompleted = override.isCompleted === null ? undefined : override.isCompleted;
        
        const safeParent = override.customParent === null ? undefined : override.customParent;
        if (override.customParent !== undefined) {
          if (safeParent === 'NONE') {
            n.parentId = undefined;
            const edgeIndex = edges.findIndex(e => e.target === n.id && !(e as PartialOntologyEdge).isCustom);
            if (edgeIndex !== -1) edges.splice(edgeIndex, 1);
          } else if (safeParent) {
            n.parentId = safeParent;
            
            // Re-route the structural edge (target === n.id)
            const edge = edges.find(e => e.target === n.id && !(e as PartialOntologyEdge).isCustom);
            if (edge) {
              edge.source = safeParent;
            } else {
              edges.push({
                source: safeParent,
                target: n.id,
                weight: 0.7,
                type: 'DEPENDENCY'
              });
            }
            
            // Sync colour with new parent if custom group/color are not explicitly overridden
            const newParent = nodes.find(pn => pn.id === safeParent);
            if (newParent && (override.customGroup === undefined || override.customGroup === null) && (override.customColor === undefined || override.customColor === null)) {
              n.group = newParent.group;
              n.customColor = newParent.customColor || undefined;
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
    
    // Remove deleted edges (tombstones for structural, custom, and customParent rerouted edges)
    // Placed *after* all edge creation phases so tombstones unilaterally override anything.
    if (customData.deletedEdges && customData.deletedEdges.length > 0) {
      const deletedSet = new Set(customData.deletedEdges);
      for (let i = edges.length - 1; i >= 0; i--) {
        const e = edges[i];
        if (deletedSet.has(`${e.source}|||${e.target}`) || deletedSet.has(`${e.target}|||${e.source}`)) {
          edges.splice(i, 1);
        }
      }
    }
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
    
    // Find root-HCHPS which is ALWAYS the original source of Category edges in the stateless generator
    finalEdges.forEach(e => {
      // Transfer all foundational driving branches from the default root to the new forced center
      if (e.source === 'root-HCHPS') {
        e.source = forcedCenterNode.id;
      }
      // Remove incoming edges targeting the New Center to prevent structural loops
      if (e.target === forcedCenterNode.id) {
        e.source = forcedCenterNode.id; // Mark as self-loop to be filtered out
      }
    });
    
    // Formally push the old default root (아이뛰움) into Orbit 1 as a category of the new forced center
    finalEdges.push({
      source: forcedCenterNode.id,
      target: 'root-HCHPS',
      weight: 1.0,
      type: 'CAUSAL_DRIVE'
    });
    
    // Clean self-referencing edges
    finalEdges = finalEdges.filter(e => e.source !== e.target);
  }

  if (customData) {
    const hiddens = new Set<string>();
    nodes.forEach(n => {
      if (customData.overrides[n.id]?.hidden) hiddens.add(n.id);
    });

    if (hiddens.size > 0) {
      // 숨긴 노드 본인은 물론이고, 그 노드를 부모로 둔 자식 노드들까지 통째로 삭제(히든 처리)하여 가지치기(Pruning)합니다.
      finalNodes = nodes.filter(n => {
        if (hiddens.has(n.id)) return false;
        if (n.parentId && hiddens.has(n.parentId)) {
          hiddens.add(n.id); // 연쇄적인 하위 가지치기를 위해 자식도 hidden 셋에 추가
          return false;
        }
        return true;
      });
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

  // 7. Cleanup invalid topology: Nodes with a specific parent should not connect directly to the center
  finalEdges = finalEdges.filter(e => {
    // 사용자가 수동으로 연결한 선분(Custom Edge)은 허용
    const isCustomEdge = customData?.customEdges.some(ce => 
      (ce.source === e.source && ce.target === e.target) || 
      (ce.source === e.target && ce.target === e.source)
    );
    if (isCustomEdge) return true;

    const centerId = forcedCenterNode ? forcedCenterNode.id : 'root-HCHPS';
    if (e.source === centerId || e.target === centerId) {
      const otherId = e.source === centerId ? e.target : e.source;
      const otherNode = finalNodes.find(n => n.id === otherId);
      if (otherNode && otherNode.parentId && otherNode.parentId !== centerId) {
        return false;
      }
    }
    return true;
  });

  // 8. Orphan Node Prevention: 모든 노드는 중앙 노드(root-HCHPS)에 물리적으로 연결되어야 함
  // 사용자가 임의 추가한 커스텀 노드나, 간선 삭제로 인해 떨어져 나간 노드들을 중앙으로 강제 결속
  const actualCenter = forcedCenterNode ? forcedCenterNode.id : 'root-HCHPS';
  const adj = new Map<string, string[]>();
  
  finalNodes.forEach(n => adj.set(n.id, []));
  finalEdges.forEach(e => {
    if (adj.has(e.source) && adj.has(e.target)) {
      adj.get(e.source)!.push(e.target);
      adj.get(e.target)!.push(e.source);
    }
  });

  const reachable = new Set<string>();
  const q = [actualCenter];
  reachable.add(actualCenter);

  while(q.length > 0) {
    const curr = q.shift()!;
    const neighbors = adj.get(curr) || [];
    for (const nxt of neighbors) {
      if (!reachable.has(nxt)) {
        reachable.add(nxt);
        q.push(nxt);
      }
    }
  }

  // Reachable하지 않은 고립 컴포넌트의 노드들을 모아 중앙 루트에 엣지를 생성
  finalNodes.forEach(n => {
    if (!reachable.has(n.id)) {
      finalEdges.push({
        source: actualCenter,
        target: n.id,
        weight: 0.5,
        type: 'DEPENDENCY',
        isCustom: true // Treat as custom so it isn't easily pruned
      } as PartialOntologyEdge);
      
      // BFS 상에서 직접 루트에 붙였으므로 이제 reachable
      reachable.add(n.id);
    }
  });

  return { nodes: finalNodes, edges: finalEdges };
}
