import { OntologyEdge, OrbitalNode } from '../ontology.types';
import { OntologyLayout } from './OntologyLayout';

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
    
    // Layout이 결정한 최종 트리 계층 구조를 진실의 원천(Source of Truth)으로 사용
    const treeChildrenMap = OntologyLayout.lastTreeChildrenMap;
    
    // 1. 하위 자식 방향 전파 (Network Flow BFS - Strict Tree Mode)
    // 부모를 클릭했을 때, '진짜 자식' 노드들에게만 활성화가 전파되게 합니다.
    const queue = [rootId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      
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
    
    // 역방향 조상 추적을 위해 treeChildrenMap을 뒤집은 parentMap을 임시 구성
    const parentMap = new Map<string, string>();
    for (const [pId, cIds] of treeChildrenMap.entries()) {
        for (const cId of cIds) {
            parentMap.set(cId, pId); 
        }
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
    
    return set;
  }
}
