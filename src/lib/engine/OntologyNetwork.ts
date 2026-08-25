import { OntologyEdge, OrbitalNode } from '../ontology.types';
import { OntologyLayout } from './OntologyLayout';

export class OntologyNetwork {
  private static cachedActiveTreeRootId: string | null = null;
  private static cachedActiveTreeChildrenMap: Map<string, string[]> | null = null;
  private static cachedActiveTreeSet: Set<string> = new Set();

  /**
   * BFS 알고리즘을 사용해 주어진 노드를 기준으로 연관된 하위/상위 노드 집합을 구합니다.
   * 엄격한 트리 모드(Strict Tree)를 적용하여 옆집 카테고리로 횡적 전염되는 것을 방지합니다.
   */
  public static getActiveTreeSet(
    rootId: string, 
    nodeMap: Map<string, OrbitalNode>
  ): Set<string> {
    if (!rootId) return new Set<string>();
    
    // Layout이 결정한 최종 트리 계층 구조를 진실의 원천(Source of Truth)으로 사용
    const treeChildrenMap = OntologyLayout.lastTreeChildrenMap;

    // O(1) Fast-Path: 동일 루트 노드 및 트리 위상 캐시 반환
    if (
      OntologyNetwork.cachedActiveTreeRootId === rootId &&
      OntologyNetwork.cachedActiveTreeChildrenMap === treeChildrenMap
    ) {
      return OntologyNetwork.cachedActiveTreeSet;
    }

    const set = new Set<string>();
    set.add(rootId);
    
    // 1. 하위 자식 방향 전파 (Network Flow BFS - Strict Tree Mode)
    // 부모를 클릭했을 때, '진짜 자식' 노드들에게만 활성화가 전파되게 합니다.
    const queue = [rootId];
    let head = 0;
    while (head < queue.length) {
      const currentId = queue[head++];
      
      // 현재 노드의 레이아웃상 자식들을 모두 가져옵니다 (Custom Edge로 연결된 것도 레이아웃이 자식으로 취급했다면 인정)
      const children = treeChildrenMap.get(currentId) || [];
      for (const childId of children) {
          if (!set.has(childId)) {
              set.add(childId);
              queue.push(childId);
          }
      }
    }
    
    // 2. 상위 부모 방향 전파 (Upward Ancestors)
    // 자식 노드를 클릭했을 때, 본인의 뿌리가 되는 조상 노드들까지 활성화합니다.
    let currNode = nodeMap.get(rootId);
    const seenAncestors = new Set<string>();
    let parentMap = OntologyLayout.lastParentMap;
    if (parentMap.size === 0 && treeChildrenMap.size > 0) {
      parentMap = new Map<string, string>();
      for (const [parentId, children] of treeChildrenMap) {
        for (let i = 0; i < children.length; i++) {
          parentMap.set(children[i], parentId);
        }
      }
      OntologyLayout.lastParentMap = parentMap;
    }
    
    let currId = rootId;
    while (currId) {
      if (seenAncestors.has(currId)) break; // Prevent cycle freezes
      seenAncestors.add(currId);
      
      const parentId = parentMap.get(currId) || currNode?.parentId;
      if (!parentId) break;
      
      set.add(parentId);
      currId = parentId;
      currNode = nodeMap.get(parentId);
    }
    
    OntologyNetwork.cachedActiveTreeRootId = rootId;
    OntologyNetwork.cachedActiveTreeChildrenMap = treeChildrenMap;
    OntologyNetwork.cachedActiveTreeSet = set;

    return set;
  }
  /**
   * 규칙 기반 시맨틱 추론기 (Semantic Reasoner)
   * 1. 이행적 의존성(Transitive Dependency): A -> B 이고 B -> C 이면 A -> C (이행적 의존)
   * 2. 병목 노드(Bottleneck Driver): 여러 주요 노드들이 동시에 한 노드에 집중 의존하는 경우 검출
   */
  public static inferSemanticRelations(
    nodes: any[],
    edges: OntologyEdge[]
  ): string[] {
    const inferences: string[] = [];
    if (!nodes || !edges) return inferences;

    const nodeLabelMap = new Map<string, string>();
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      nodeLabelMap.set(n.id, n.customLabel || n.label || n.id);
    }

    // 1. 인접 리스트 생성 (의존성 방향: A가 B에 의존하면 A -> B)
    const adj = new Map<string, Set<string>>();
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      if (edge.type === 'DEPENDENCY' || edge.type === 'CAUSAL_DRIVE') {
        let set = adj.get(edge.source);
        if (!set) {
          set = new Set();
          adj.set(edge.source, set);
        }
        set.add(edge.target);
      }
    }

    // 2. 이행적 의존성 (Transitive Dependency) BFS 탐색 - O(1) index pointer queue
    for (let s = 0; s < nodes.length; s++) {
      const startNode = nodes[s];
      const visited = new Set<string>();
      const queue: string[] = [startNode.id];
      let head = 0;
      visited.add(startNode.id);
      const directNeighbors = adj.get(startNode.id);

      while (head < queue.length) {
        const curr = queue[head++];
        const neighbors = adj.get(curr);
        if (neighbors) {
          for (const next of neighbors) {
            if (!visited.has(next)) {
              visited.add(next);
              queue.push(next);
              
              if (next !== startNode.id && (!directNeighbors || !directNeighbors.has(next))) {
                const startLabel = nodeLabelMap.get(startNode.id);
                const nextLabel = nodeLabelMap.get(next);
                if (startLabel && nextLabel) {
                  inferences.push(`- [추론 관계] ${startLabel}은(는) 간접적으로 ${nextLabel}에 의존(이행적 의존)하고 있습니다.`);
                }
              }
            }
          }
        }
      }
    }

    // 3. 병목 노드 (Bottleneck Driver) 분석
    const inDegrees = new Map<string, string[]>();
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      if (edge.type === 'DEPENDENCY' || edge.type === 'CAUSAL_DRIVE') {
        let list = inDegrees.get(edge.target);
        if (!list) {
          list = [];
          inDegrees.set(edge.target, list);
        }
        list.push(edge.source);
      }
    }

    for (const [targetId, sources] of inDegrees) {
      if (sources.length >= 3) {
        const targetLabel = nodeLabelMap.get(targetId);
        const sourceLabels: string[] = [];
        for (let j = 0; j < sources.length; j++) {
          const l = nodeLabelMap.get(sources[j]);
          if (l) sourceLabels.push(l);
        }
        if (targetLabel && sourceLabels.length >= 3) {
          inferences.push(`- [추론 병목] ${targetLabel}은(는) ${sources.length}개 노드(${sourceLabels.slice(0, 3).join(', ')} 등)가 집중 의존하고 있는 핵심 병목(Bottleneck) 요인입니다.`);
        }
      }
    }

    return inferences;
  }
}
