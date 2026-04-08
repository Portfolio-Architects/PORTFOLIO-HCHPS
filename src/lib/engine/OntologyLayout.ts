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

    // 3. Bidirectional Depth-Based Contour Layout (양방향 마인드맵 전개)
    const X_SPACING = 220; // 가로 간격을 조금 더 넓혀 가독성 향상
    const Y_SPACING = 8;
    const NODE_HEIGHT = 32;
    
    // 각 뎁스(Depth / X축 레벨)별로 왼쪽/오른쪽 트리의 최소 Y좌표를 추적
    const leftDepthY: Record<number, number> = {};
    const rightDepthY: Record<number, number> = {};
    const visibleNodes = new Set<string>();

    function shiftSubtree(nodeId: string, shift: number) {
        const node = nodeMap.get(nodeId);
        if (node) node.worldY = (node.worldY || 0) + shift;
        
        if (collapsedNodeIds.has(nodeId)) return;
        const children = treeChildrenMap.get(nodeId) || [];
        for (const childId of children) {
            shiftSubtree(childId, shift);
        }
    }

    function layoutNode(nodeId: string, depth: number, depthX: number, direction: number, depthTracker: Record<number, number>): number {
      const node = nodeMap.get(nodeId);
      if (!node) return 0;
      
      visibleNodes.add(nodeId);
      node.worldX = depthX;

      const children = treeChildrenMap.get(nodeId) || [];
      const hasVisibleChildren = children.length > 0 && !collapsedNodeIds.has(nodeId);

      let myY = 0;
      if (!hasVisibleChildren) {
         myY = depthTracker[depth] || 0;
         node.worldY = myY;
         depthTracker[depth] = myY + NODE_HEIGHT + Y_SPACING;
         return myY;
      } else {
         let sumY = 0;
         for (const childId of children) {
            sumY += layoutNode(childId, depth + 1, depthX + (X_SPACING * direction), direction, depthTracker);
         }
         const avgY = sumY / children.length;
         
         const requiredY = depthTracker[depth] || 0;
         myY = Math.max(requiredY, avgY);
         const shift = myY - avgY; 
         
         if (shift > 0) {
            shiftSubtree(nodeId, shift);
            for (const dStr in depthTracker) {
                const d = parseInt(dStr);
                if (d > depth) {
                    depthTracker[d] += shift;
                }
            }
         }
         
         node.worldY = myY;
         depthTracker[depth] = myY + NODE_HEIGHT + Y_SPACING;
         return myY;
      }
    }

    // 메인 루트 노드들 배치 시작점
    for (const root of roots) {
       const rootNode = nodeMap.get(root.id);
       if (rootNode) {
           rootNode.worldX = 0; // 모든 루트 노드는 X축 중앙(0)에 고정
           visibleNodes.add(root.id);
           
           const rootChildren = treeChildrenMap.get(root.id) || [];
           if (rootChildren.length > 0 && !collapsedNodeIds.has(root.id)) {
               // 루트의 자식들을 좌우로 분배 (짝수는 오른쪽, 홀수는 왼쪽)
               const leftChildren = [];
               const rightChildren = [];
               for (let i = 0; i < rootChildren.length; i++) {
                   if (i % 2 === 0) rightChildren.push(rootChildren[i]);
                   else leftChildren.push(rootChildren[i]);
               }
               
               let leftSumY = 0;
               for (const c of leftChildren) leftSumY += layoutNode(c, 1, -X_SPACING, -1, leftDepthY);
               
               let rightSumY = 0;
               for (const c of rightChildren) rightSumY += layoutNode(c, 1, X_SPACING, 1, rightDepthY);
               
               if (root === roots[0]) {
                   // 메인 루트: 완벽한 수직 대칭(나비 모양)을 위해 0에 고정 후, 양쪽 트리를 0에 맞춰 이동
                   rootNode.worldY = 0;
                   if (leftChildren.length > 0) {
                       const leftAvg = leftSumY / leftChildren.length;
                       const shiftAmount = -leftAvg;
                       if (shiftAmount !== 0) {
                           for (const c of leftChildren) shiftSubtree(c, shiftAmount);
                           for (const dStr in leftDepthY) leftDepthY[dStr] += shiftAmount;
                       }
                   }
                   if (rightChildren.length > 0) {
                       const rightAvg = rightSumY / rightChildren.length;
                       const shiftAmount = -rightAvg;
                       if (shiftAmount !== 0) {
                           for (const c of rightChildren) shiftSubtree(c, shiftAmount);
                           for (const dStr in rightDepthY) rightDepthY[dStr] += shiftAmount;
                       }
                   }
               } else {
                   // 고아/독립 루트: 자식들이 depthTracker에 의해 안전하게 배치된 상태의 평균 Y값으로 이동
                   const leftAvg = leftChildren.length > 0 ? leftSumY / leftChildren.length : null;
                   const rightAvg = rightChildren.length > 0 ? rightSumY / rightChildren.length : null;
                   
                   if (leftAvg !== null && rightAvg !== null) rootNode.worldY = (leftAvg + rightAvg) / 2;
                   else if (leftAvg !== null) rootNode.worldY = leftAvg;
                   else if (rightAvg !== null) rootNode.worldY = rightAvg;
               }

               // 루트 자신을 위한 depthTracker 최소공간 점유 처리
               const finalRootY = rootNode.worldY ?? 0;
               leftDepthY[0] = Math.max(leftDepthY[0] || 0, finalRootY + NODE_HEIGHT + Y_SPACING);
               rightDepthY[0] = Math.max(rightDepthY[0] || 0, finalRootY + NODE_HEIGHT + Y_SPACING);
           } else {
               // 자식이 없는 빈 루트 (또는 접힘)
               if (root === roots[0]) {
                   rootNode.worldY = 0;
               } else {
                   // 기존 트리의 배치가 끝난 최하단에 배치
                   rootNode.worldY = Math.max(leftDepthY[0] || 0, rightDepthY[0] || 0);
               }
               leftDepthY[0] = rootNode.worldY + NODE_HEIGHT + Y_SPACING;
               rightDepthY[0] = rootNode.worldY + NODE_HEIGHT + Y_SPACING;
           }
       }
       
       // 다중 루트(고립된 서브트리들) 렌더링 시, 이전 트리와의 간격을 위해 현재 뎁스의 최하단에서 약간의 여백만 추가합니다.
       // 이를 통해 고립된 트리들이 화면 아래로 멀리 분리되지 않고 메인 트리 바로 아래에 타이트하게 붙어 렌더링됩니다.
       for (const dStr in leftDepthY) leftDepthY[dStr] += Y_SPACING * 3;
       for (const dStr in rightDepthY) rightDepthY[dStr] += Y_SPACING * 3;
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
