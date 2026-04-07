import { OrbitalNode, OntologyEdge } from '../ontology.types';

// ============ Constants ============

export const NUM_ORBITS = 8;
export const ELLIPSE_RATIO = 1.3;  
export const MIN_NODE_R = 3;
export const MAX_NODE_R = 24;
export const ORBIT_SPEED_BASE = 0.00025; 
export const LERP_SPEED = 0.12;  
export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 3.0;
export const MIN_TILT = 0.3;
export const MAX_TILT = 1.0;
export const CULL_MARGIN = 80;  

// Layout parameters
const X_SPACING = 240; // horizontal distance between parent and child
const Y_SPACING = 20;  // vertical padding between siblings
const NODE_HEIGHT = 48; // estimated rendering height for math
const NODE_WIDTH_ESTIMATE = 140;

export class OntologyLayout {
  public static lastTreeChildrenMap = new Map<string, string[]>();

  /**
   * 캔버스와 카메라 상태에 따른 각 노드의 렌더링 좌표를 계산합니다.
   * NotebookLM 스타일의 계층형 가로 트리(Horizontal Tidy Tree) 구조로 배치합니다.
   */
  public static computePositions(
    nodes: OrbitalNode[],
    nodeMap: Map<string, OrbitalNode>,
    edges: OntologyEdge[],
    canvasW: number,
    canvasH: number,
    cameraOffsetX: number,
    cameraOffsetY: number,
    zoom: number,
    collapsedNodeIds: Set<string>
  ): void {
    if (nodes.length === 0) return;

    // 1. 무방향 인접 리스트 생성 (Undirected Adjacency List)
    // - 데이터의 edge 방향성(source->target) 오류로 인해 하위 노드가 고아(Orphan)로 분류되어 좌표가 겹치는 현상을 방지
    const adjList = new Map<string, string[]>();
    nodes.forEach(n => adjList.set(n.id, []));
    
    for (const edge of edges) {
      if (adjList.has(edge.source) && adjList.has(edge.target)) {
        adjList.get(edge.source)!.push(edge.target);
        adjList.get(edge.target)!.push(edge.source);
      }
    }

    // 2. BFS를 통해 중앙 노드(Orbit 0)를 루트로 하는 진정한 트리 구조(Directed Tree) 생성
    const treeChildrenMap = new Map<string, string[]>();
    OntologyLayout.lastTreeChildrenMap = treeChildrenMap;
    nodes.forEach(n => treeChildrenMap.set(n.id, []));
    
    const roots: OrbitalNode[] = [];
    const mainRoot = nodes.find(n => n.orbitIndex === 0) || nodes[0];
    roots.push(mainRoot);

    const visitedBfs = new Set<string>();
    visitedBfs.add(mainRoot.id);

    const queue = [mainRoot.id];
    while (queue.length > 0) {
       const curr = queue.shift()!;
       const neighbors = adjList.get(curr) || [];
       // 사용자 지정 정렬 순서(customSortOrder) 최우선, 동일하면 라벨순 정렬
       neighbors.sort((a, b) => {
         const orderA = nodeMap.get(a)?.customSortOrder ?? 0;
         const orderB = nodeMap.get(b)?.customSortOrder ?? 0;
         if (orderA !== orderB) return orderA - orderB;
         return a.localeCompare(b);
       });
       
       for (const nxt of neighbors) {
           if (!visitedBfs.has(nxt)) {
               visitedBfs.add(nxt);
               treeChildrenMap.get(curr)!.push(nxt);
               queue.push(nxt);
           }
       }
    }

    // 메인 그래프와 연결되지 않은(Disconnected) 노드 그룹도 루트로 취급하여 배치
    for (const n of nodes) {
       if (!visitedBfs.has(n.id)) {
           roots.push(n);
           visitedBfs.add(n.id);
           queue.push(n.id);
           while (queue.length > 0) {
              const curr = queue.shift()!;
              const neighbors = adjList.get(curr) || [];
              neighbors.sort((a, b) => {
                 const orderA = nodeMap.get(a)?.customSortOrder ?? 0;
                 const orderB = nodeMap.get(b)?.customSortOrder ?? 0;
                 if (orderA !== orderB) return orderA - orderB;
                 return a.localeCompare(b);
              });
              
              for (const nxt of neighbors) {
                  if (!visitedBfs.has(nxt)) {
                      visitedBfs.add(nxt);
                      treeChildrenMap.get(curr)!.push(nxt);
                      queue.push(nxt);
                  }
              }
           }
       }
    }

    // 3. NotebookLM 스타일 극압축 레이아웃 (Depth-Based Contour Approximation)
    const X_SPACING = 180;
    const Y_SPACING = 8;
    const NODE_HEIGHT = 32;
    
    // 각 뎁스(Depth / X축 레벨)별로 다음에 노드가 배치되어야 할 사용 가능한 최소 Y좌표를 추적
    const depthY: Record<number, number> = {};
    const visibleNodes = new Set<string>();

    // 서브트리를 통째로 아래로 이동시키는 함수
    function shiftSubtree(nodeId: string, shift: number) {
        const node = nodeMap.get(nodeId);
        if (node) node.worldY = (node.worldY || 0) + shift;
        
        if (collapsedNodeIds.has(nodeId)) return;
        const children = treeChildrenMap.get(nodeId) || [];
        for (const childId of children) {
            shiftSubtree(childId, shift);
        }
    }

    function layoutNode(nodeId: string, depth: number, depthX: number): number {
      const node = nodeMap.get(nodeId);
      if (!node) return 0;
      
      visibleNodes.add(nodeId);
      node.worldX = depthX;

      const children = treeChildrenMap.get(nodeId) || [];
      const hasVisibleChildren = children.length > 0 && !collapsedNodeIds.has(nodeId);

      let myY = 0;
      if (!hasVisibleChildren) {
         // 자식이 없는 노드는 자신의 뎁스에서 가능한 최상단(위쪽 노드 바로 밑)에 바짝 붙임
         myY = depthY[depth] || 0;
         node.worldY = myY;
         depthY[depth] = myY + NODE_HEIGHT + Y_SPACING;
         return myY;
      } else {
         // 자식이 있다면 자식들을 먼저 순차적으로 그리고
         let sumY = 0;
         for (const childId of children) {
            sumY += layoutNode(childId, depth + 1, depthX + X_SPACING);
         }
         // 부모는 자식들의 중앙 위치(avgY)를 희망함
         const avgY = sumY / children.length;
         
         // 하지만 자신의 뎁스에서 앞서 그려진 다른 노드와 겹치면 안 되므로 하한선(requiredY) 검사
         const requiredY = depthY[depth] || 0;
         myY = Math.max(requiredY, avgY);
         const shift = myY - avgY; // 만약 위쪽 노드 때문에 강제로 밑으로 밀려났다면
         
         if (shift > 0) {
            // 자식들 전체도 밀려난 만큼 똑같이 내려줌 (선이 찌그러지지 않게)
            shiftSubtree(nodeId, shift);
            // 자식 트리가 통째로 shift 만큼 내려갔으므로, 그 이후에 그려질 다음 형제 노드들의 자식들이 겹치지 않도록 전체 뎁스 한계선 갱신
            for (const dStr in depthY) {
                const d = parseInt(dStr);
                if (d > depth) {
                    depthY[d] += shift;
                }
            }
         }
         
         node.worldY = myY;
         depthY[depth] = myY + NODE_HEIGHT + Y_SPACING;
         return myY;
      }
    }

    // 다중 루트 노드들 배치 시작점
    for (const root of roots) {
       layoutNode(root.id, 0, -600);
       // 루트가 변경될 때마다 모든 뎁스의 여백을 추가하여 독립된 트리 그룹으로 렌더링
       for (const dStr in depthY) {
           depthY[dStr] += Y_SPACING * 3;
       }
    }

    // (BFS로 모든 노드를 순회하여 treeChildrenMap을 만들었으므로 고아 노드는 더 이상 없음)

    // 6. Camera 변환 (World -> Screen)
    // Orbit Layout과 달리 Tidy Tree는 직교 좌표계이므로 카메라 Tilt(3D 기울임)를 무시하거나 약하게 적용
    const cx = canvasW / 2 + cameraOffsetX;
    const cy = canvasH / 2 + cameraOffsetY;

    for (const node of nodes) {
      if (!visibleNodes.has(node.id)) {
        node.layoutHidden = true;
        // 완전히 격리하여 보간(Interpolation) 연산도 방지
        node.worldX = -999999;
        node.worldY = -999999;
        node.renderX = -999999;
        node.renderY = -999999;
        continue;
      }
      node.layoutHidden = false;

      const worldX = node.worldX || 0;
      const worldY = node.worldY || 0;
      
      const targetRenderX = cx + worldX * zoom;
      const targetRenderY = cy + worldY * zoom;

      // 만약 방금 전까지 숨겨진 상태(-999999)였다면 날아오지 않도록 즉시 해당 좌표로 순간이동
      if (node.renderX === -999999) {
        node.renderX = targetRenderX;
        node.renderY = targetRenderY;
      } else {
        // 평면 뷰 목표치 업데이트 (물리 엔진이 이 목표값을 향해 보간함)
        // 여기서는 그냥 값만 업데이트 해도 되지만, layout 로직의 단순화를 위해 renderX 할당 방식 유지
        // Engine의 updatePhysics에서 부드럽게 이동하게 됨.
        // 엔진과의 간섭을 줄이기 위해 Layout에서 renderX 덮어쓰기를 멈추고 Physics에 위임하는게 정석.
        // 하지만 기존 코드가 덮어쓰고 있었다면 유지.
        // 기존: node.renderX = cx + worldX * zoom; -> Physics 엔진 무시하고 즉시 반영됨.
        // Tidy Tree는 움직이지 않는 고정 메뉴 체계이므로 즉시 반영이 더 깔끔함.
        node.renderX = targetRenderX;
        node.renderY = targetRenderY;
      }
      
      node.renderZ = 0; // Flat UI
      
      // 반경 대신 box 너비/높이 렌더링에 사용할 기준값 설정 (호환성 유지 용도)
      node.nodeRadius = 24; 
    }
  }

  // 더 이상 사용하지 않음
  public static computeOrbitRadii(canvasW: number, canvasH: number): number[] {
    return [];
  }
}
