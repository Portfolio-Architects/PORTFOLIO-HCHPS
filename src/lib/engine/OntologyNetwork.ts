import { OntologyEdge, OrbitalNode } from '../ontology.types';

export class OntologyNetwork {
  /**
   * BFS 알고리즘을 사용해 주어진 노드를 기준으로 연관된 하위/상위 노드 집합을 구합니다.
   * 엄격한 트리 모드(Strict Tree)를 적용하여 옆집 카테고리로 횡적 전염되는 것을 방지합니다.
   */
  public static getActiveTreeSet(
    rootId: string, 
    nodeMap: Map<string, OrbitalNode>, 
    edges: OntologyEdge[]
  ): Set<string> {
    const set = new Set<string>();
    if (!rootId) return set;
    
    set.add(rootId);
    const rootNode = nodeMap.get(rootId);
    
    // 1. Network Flow BFS (Strict Tree Mode)
    const queue = [rootId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const isImmediateHop = (currentId === rootId);
      
      for (const edge of edges) {
        // 중심 노드 관통 차단
        if (rootId !== 'root-HCHPS' && edge.target === 'root-HCHPS') continue;
        if (rootId !== 'root-HCHPS' && isImmediateHop && edge.source === 'root-HCHPS') continue;
        
        // Strict Tree Mode: Only follow pure child-parent relationships (orbit flow)
        let nextId: string | null = null;
        
        // Is this a structural edge (downward flow)?
        const srcNode = nodeMap.get(edge.source);
        const tgtNode = nodeMap.get(edge.target);
        
        if (srcNode && tgtNode) {
          // downward flow (source is parent, target is child)
          if (tgtNode.parentId === srcNode.id) {
             if (edge.source === currentId) nextId = edge.target; // spread down
          } else if (srcNode.parentId === tgtNode.id) {
             if (edge.target === currentId) nextId = edge.source; // spread down (edge drawn backwards rarely)
          } else {
             // Lateral / Custom Edge - Block propagation!
             // BUT visually light up the immediate neighbour so we know they are connected
             if (edge.source === currentId && isImmediateHop) {
                nextId = edge.target;
                if (!set.has(nextId)) set.add(nextId);
                nextId = null; // stop queue
             } else if (edge.target === currentId && isImmediateHop) {
                nextId = edge.source;
                if (!set.has(nextId)) set.add(nextId);
                nextId = null; // stop queue
             }
             continue; // Do not spread further
          }
        }
        
        if (nextId && !set.has(nextId)) {
          set.add(nextId);
          queue.push(nextId);
        }
      }
    }
    
    // 2. Upward Ancestors (Structural Lineage)
    let currNode = nodeMap.get(rootId);
    const seenAncestors = new Set<string>();
    while (currNode && currNode.parentId) {
      if (seenAncestors.has(currNode.parentId)) break; // Prevent cycle freezes
      seenAncestors.add(currNode.parentId);
      
      set.add(currNode.parentId);
      currNode = nodeMap.get(currNode.parentId);
    }
    
    return set;
  }
}
