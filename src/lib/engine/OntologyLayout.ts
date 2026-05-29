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

// Layout parameters - defined inside computePositions

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

    // 1. 방향성이 있는 인접 리스트 (Directed Adjacency List) 생성 및 무방향(Fallback) 준비
    // - 크로스 엣지(횡적 연결)로 인해 하위 노드가 잘못된 부모 밑으로(Spanning Tree 구조 붕괴) 종속되는 것을 방지하기 위함
    const directedDir = new Map<string, string[]>();
    const undirectedDir = new Map<string, string[]>();
    nodes.forEach(n => {
      directedDir.set(n.id, []);
      undirectedDir.set(n.id, []);
    });
    
    for (const edge of edges) {
      if (undirectedDir.has(edge.source) && undirectedDir.has(edge.target)) {
        undirectedDir.get(edge.source)!.push(edge.target);
        undirectedDir.get(edge.target)!.push(edge.source);
        
        // 구조적 엣지(하위 종속)인 경우에만 방향성을 부여하여 트리 구조를 명확히 잡습니다
        const targetNode = nodeMap.get(edge.target);
        
        // 중요: 타겟 노드가 명시적인 parentId를 갖고 있다면, 오직 이 부모로부터 온 간선만 트리 구조로 허용 (AI 교차 추천 등 차단)
        if (targetNode && targetNode.parentId) {
           if (targetNode.parentId === edge.source) {
             directedDir.get(edge.source)!.push(edge.target);
           }
        } 
        // 예외: 카테고리 노드는 parentId가 없으나 CAUSAL_DRIVE 간선으로 루트와 연결됨
        else if (edge.type === 'CAUSAL_DRIVE' || edge.type === 'DEPENDENCY') {
           directedDir.get(edge.source)!.push(edge.target);
        }
      }
    }

    // 2. 방향성 그래프 기반 중앙 노드(Orbit 0) 트리 추출
    const treeChildrenMap = new Map<string, string[]>();
    OntologyLayout.lastTreeChildrenMap = treeChildrenMap;
    nodes.forEach(n => treeChildrenMap.set(n.id, []));
    
    const roots: OrbitalNode[] = [];
    const mainRoot = nodes.find(n => n.orbitIndex === 0) || nodes[0];
    roots.push(mainRoot);

    const visitedBfs = new Set<string>();
    visitedBfs.add(mainRoot.id);

    // Phase A: 엄격한 방향성 트리를 먼저 순회 (올바른 부모-자식 정렬 우선 배정)
    const queue = [mainRoot.id];
    while (queue.length > 0) {
       const curr = queue.shift()!;
       const neighbors = directedDir.get(curr) || [];
       
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

    // Phase B: 메인 방향성 트리에 결속되지 못한 남은 노드들을 무방향 엣지로 구제 (Spanning Tree 보완)
    for (let retry = 0; retry < 2; retry++) {
      // 첫 번째 retry에서는 기존에 방문된 노드들과 무방향 선분이 있는 미방문 노드들을 흡수
      const existingVisited = Array.from(visitedBfs);
      for (const curr of existingVisited) {
          const neighbors = undirectedDir.get(curr) || [];
          for (const nxt of neighbors) {
             if (!visitedBfs.has(nxt)) {
                 visitedBfs.add(nxt);
                 treeChildrenMap.get(curr)!.push(nxt);
                 queue.push(nxt);
                 
                 // 서브트리 전개
                 while (queue.length > 0) {
                    const subCurr = queue.shift()!;
                    const subNeighbors = directedDir.get(subCurr)?.length ? directedDir.get(subCurr)! : undirectedDir.get(subCurr)!;
                    subNeighbors.sort((a,b) => a.localeCompare(b));
                    for (const subNxt of subNeighbors) {
                        if (!visitedBfs.has(subNxt)) {
                            visitedBfs.add(subNxt);
                            treeChildrenMap.get(subCurr)!.push(subNxt);
                            queue.push(subNxt);
                        }
                    }
                 }
             }
          }
      }
    }

    // Phase C: 영원히 고립된 완전히 끊어진 노드/서브그래프 렌더링을 위한 독립 루트 선언
    for (const n of nodes) {
       if (!visitedBfs.has(n.id)) {
           roots.push(n);
           visitedBfs.add(n.id);
           queue.push(n.id);
           while (queue.length > 0) {
              const curr = queue.shift()!;
              const neighbors = undirectedDir.get(curr) || [];
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

    // 6. Camera 변환 (World -> Screen - 3D Perspective Projection 적용)
    // Y축 기울임 효과를 적용하여 표면적을 조절하고 입체감을 높임
    const cx = canvasW / 2 + cameraOffsetX;
    const cy = canvasH / 2 + cameraOffsetY;

    const tiltAngle = 40 * Math.PI / 180; // 40도 눕힘 (10% 추가 기울임)
    const cameraDist = 1000; // 카메라 원근 투영 거리

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
      
      const rotatedY = worldY * Math.cos(tiltAngle);
      // worldY가 음수(위쪽)일 때 뒤로 기울어지므로 depth는 증가(카메라에서 멀어짐)
      const depth = -worldY * Math.sin(tiltAngle);
      const perspectiveScale = cameraDist / (cameraDist + depth);

      const targetRenderX = cx + worldX * zoom * perspectiveScale;
      const targetRenderY = cy + rotatedY * zoom * perspectiveScale;

      // 만약 방금 전까지 숨겨진 상태(-999999)였다면 날아오지 않도록 즉시 해당 좌표로 순간이동
      if (node.renderX === -999999) {
        node.renderX = targetRenderX;
        node.renderY = targetRenderY;
      } else {
        node.renderX = targetRenderX;
        node.renderY = targetRenderY;
      }
      
      node.renderZ = depth;
      (node as any).perspectiveScale = perspectiveScale;
      
      // 반경 대신 box 너비/높이 렌더링에 사용할 기준값 설정 (호환성 유지 용도)
      node.nodeRadius = 24; 
    }
  }

  // 더 이상 사용하지 않음
  public static computeOrbitRadii(_canvasW: number, _canvasH: number): number[] {
    return [];
  }
}
