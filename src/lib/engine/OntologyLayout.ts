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
  public static lastSpanningTreeEdgeSet = new Set<string>();
  public static dynamicRules: { agents: string[], resources: string[], executions: string[] } | null = null;

  /**
   * 노드의 효과적인 레이어 ID를 반환하는 지능형 헬퍼
   */
  public static getEffectiveLayerId(node: any): number {
    if (node.layerId !== undefined && node.layerId !== null) {
      return Number(node.layerId);
    }
    const label = node.label || '';
    const id = node.id || '';
    const dyn = OntologyLayout.dynamicRules;
    
    // 0: 인물 (Agent)
    if (
      /[가-힣]+ (이사|대리|부장|과장|사원|담당|대표|팀장|주임|주무관|소장|선생님)/.test(label) || 
      label.endsWith('님') || 
      id.startsWith('user_') || 
      id.includes('person') || 
      id.includes('assignee') ||
      id === 'hong_jongnam' ||
      id === 'kim_jaeeun' ||
      id === 'oh_changsun' ||
      id === 'gangnam_health_center' ||
      label.includes('담당자') ||
      label.includes('본부장') ||
      label.includes('과장') ||
      label.includes('팀장') ||
      label.includes('주무관') ||
      label.includes('소장') ||
      label.includes('선생님') ||
      label.includes('인수자') ||
      label.includes('인계자') ||
      label.includes('입회자') ||
      label.includes('팀장대직') ||
      // 실무 인력 직접 매핑
      label.includes('오창선') ||
      label.includes('김형종') ||
      label.includes('신진성') ||
      label.includes('김은주') ||
      label.includes('김태환') ||
      (dyn?.agents && dyn.agents.some((w: string) => label.includes(w)))
    ) {
      return 0;
    }
    
    // 1: 예산/비품 (Resource)
    if (
      label.includes('예산') || 
      label.includes('비용') || 
      label.includes('구매') || 
      label.includes('임대') || 
      label.includes('비품') || 
      label.includes('원') || 
      id.includes('budget') || 
      id.includes('inventory') || 
      id.includes('equip') ||
      id.includes('cost') ||
      id.includes('fee') ||
      id.includes('price') ||
      id.includes('amount') ||
      label.includes('지출') ||
      label.includes('단가') ||
      label.includes('집행액') ||
      label.includes('지출잔액') ||
      label.includes('예산현액') ||
      label.includes('불용') ||
      label.includes('용역비') ||
      label.includes('계약') ||
      label.includes('수익') ||
      label.includes('차액') ||
      (dyn?.resources && dyn.resources.some((w: string) => label.includes(w)))
    ) {
      return 1;
    }
    
    // 2: 업무/회의/프로젝트 (Execution)
    if (
      label.includes('회의') || 
      label.includes('개발') || 
      label.includes('도입') || 
      label.includes('시스템') || 
      label.includes('프로그램') || 
      label.includes('검사') || 
      label.includes('체크업') || 
      label.includes('센터') || 
      label.includes('검진') ||
      label.includes('업무') ||
      id.includes('task') || 
      id.includes('meeting') || 
      id.includes('checkup') || 
      id.includes('program') || 
      id.includes('test') || 
      id.includes('system') || 
      id.includes('sports') ||
      id.includes('center') ||
      id.includes('project') ||
      id.includes('execution') ||
      id.includes('campaign') ||
      id.includes('challenge') ||
      id.includes('event') ||
      id.includes('report') ||
      label.includes('캠페인') ||
      label.includes('챌린지') ||
      label.includes('조례') ||
      label.includes('행사') ||
      label.includes('교육') ||
      label.includes('계획') ||
      label.includes('성과관리') ||
      label.includes('보고') ||
      label.includes('인계') ||
      label.includes('인수') ||
      (dyn?.executions && dyn.executions.some((w: string) => label.includes(w)))
    ) {
      return 2;
    }
    
    // 3: 위키/문서 (Knowledge) - 기본값
    return 3;
  }

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
    collapsedNodeIds: Set<string>,
    activeLayers?: Set<number>,
    isInteractive: boolean = false,
    recomputeWorldPositions: boolean = true
  ): void {
    if (nodes.length === 0) return;

    if (recomputeWorldPositions) {
      // 1. 방향성이 있는 인접 리스트 (Directed Adjacency List) 생성 및 무방향(Fallback) 준비
      // - 크로스 엣지(횡적 연결)로 인해 하위 노드가 잘못된 부모 밑으로(Spanning Tree 구조 붕괴) 종속되는 것을 방지하기 위함
      const directedDir = new Map<string, string[]>();
      const undirectedDir = new Map<string, string[]>();
      nodes.forEach(n => {
        // 1회 계산 및 런타임 캐싱
        n.effectiveLayer = OntologyLayout.getEffectiveLayerId(n);
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
      const X_SPACING = 250; // 가로 간격을 조금 더 넓혀 가독성 향상 (상향 조정)
      const Y_SPACING = 14;  // 세로 간격 상향 조정
      const NODE_HEIGHT = 36; // 노드 가상 높이 상향 조정
      
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

      // Build spanning tree edge set for fast O(1) rendering lookups
      const spanningTreeEdgeSet = new Set<string>();
      treeChildrenMap.forEach((children, parentId) => {
        for (const childId of children) {
          spanningTreeEdgeSet.add(`${parentId}|||${childId}`);
          spanningTreeEdgeSet.add(`${childId}|||${parentId}`);
        }
      });
      OntologyLayout.lastSpanningTreeEdgeSet = spanningTreeEdgeSet;

      // Mark which nodes are topologically visible
      for (const node of nodes) {
        node.topoHidden = !visibleNodes.has(node.id);
      }
    }

    // 6. Camera 변환 (World -> Screen - 3D Vertical Stacked Projection)
    const cx = canvasW / 2 + cameraOffsetX;
    const cy = canvasH / 2 + cameraOffsetY;

    const tiltAngle = 42 * Math.PI / 180; // 42도 경사각
    const cameraDist = 1000;              // 카메라 거리
    const LAYER_GAP = 190;                // 레이어 간 수직 적층 격차 (가독성 최적값)

    for (const node of nodes) {
      const effectiveLayer = node.effectiveLayer ?? 3;
      const isFiltered = activeLayers && !activeLayers.has(effectiveLayer);

      // 레이어 필터 또는 계층 접힘에 의해 최종적으로 숨김 여부 설정
      node.layoutHidden = node.topoHidden || isFiltered;

      if (node.layoutHidden) {
        node.renderX = -999999;
        node.renderY = -999999;
        continue;
      }
      
      const worldX = node.worldX || 0;
      const worldY = node.worldY || 0;
      
      // 레이어 수직 높이 (Z축 방향 높이: 0층이 가장 아래, 3층이 가장 위)
      const h = effectiveLayer * LAYER_GAP;

      // 아래에서 위를 올려다보는 뷰 (Upward 뷰)
      const depthH = effectiveLayer * LAYER_GAP;

      // 3D X축 회전 변환 공식 적용 (depthH를 활용해 원근 배율 조정)
      const rotatedY = worldY * Math.cos(tiltAngle) - h * Math.sin(tiltAngle);
      const depth = -worldY * Math.sin(tiltAngle) + depthH * Math.cos(tiltAngle);
      
      const perspectiveScale = cameraDist / (cameraDist + depth);

      node.renderX = cx + worldX * zoom * perspectiveScale;
      node.renderY = cy + rotatedY * zoom * perspectiveScale;
      
      node.renderZ = depth;
      (node as any).perspectiveScale = perspectiveScale;
      node.nodeRadius = 24; 
    }

    // 7. Screen-Space Collision Resolution (2D 화면 공간 충돌 방지 루프)
    // 화면 영역(Frustum) 바깥의 노드는 충돌 물리 계산에서 제외하여 O(N^2) 루프의 연산 대상을 격감시킴
    const activeNodes = nodes.filter(n => 
      !n.layoutHidden && 
      n.renderX !== -999999 &&
      n.renderX >= -CULL_MARGIN &&
      n.renderX <= canvasW + CULL_MARGIN &&
      n.renderY >= -CULL_MARGIN &&
      n.renderY <= canvasH + CULL_MARGIN
    );
    
    // O(N)으로 사전 계산
    const nodeData = activeNodes.map(node => {
      const weight = node.renderSize ?? 0.5;
      const sizeFactor = 0.8 + 0.5 * weight;
      const scale = ((node as any).perspectiveScale ?? 1.0) * sizeFactor;
      
      let textW = (node.label || '').length * 7.5;
      if ((node as any)._cachedTextWidth) {
        const cache = (node as any)._cachedTextWidth;
        textW = cache['600'] || cache['500'] || textW;
      }
      
      const w = Math.max(60 * scale, textW * scale + 28 * scale) + 16 * scale; // 가로 마진 포함
      const h = Math.max(28 * scale, 12 * scale + 20 * scale) + 12 * scale;  // 세로 마진 포함
      const isFixed = (node as any).fixedX !== undefined && (node as any).fixedY !== undefined;
      const layer = node.effectiveLayer ?? 3;
      
      return {
        node,
        w,
        h,
        isFixed,
        layer
      };
    });

    // Group nodeData by layer for much faster collision checking (O(N^2 / L) vs O(N^2))
    const layerGroups = new Map<number, typeof nodeData>();
    for (const d of nodeData) {
      if (!layerGroups.has(d.layer)) {
        layerGroups.set(d.layer, []);
      }
      layerGroups.get(d.layer)!.push(d);
    }

    const maxIterations = isInteractive ? 1 : 4;
    
    layerGroups.forEach((group) => {
      for (let iter = 0; iter < maxIterations; iter++) {
        let hasOverlap = false;
        for (let i = 0; i < group.length; i++) {
          const dataA = group[i];
          const nodeA = dataA.node;
          const wA = dataA.w;
          const hA = dataA.h;
          const isFixedA = dataA.isFixed;
          for (let j = i + 1; j < group.length; j++) {
            const dataB = group[j];
            const nodeB = dataB.node;
            const wB = dataB.w;
            const hB = dataB.h;
            const isFixedB = dataB.isFixed;

            // 두 노드 겹침 확인
            const dx = nodeB.renderX - nodeA.renderX;
            const dy = nodeB.renderY - nodeA.renderY;
            
            const minDistX = (wA + wB) / 2;
            const minDistY = (hA + hB) / 2;
            
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            if (absDx >= minDistX || absDy >= minDistY) {
              continue;
            }

            hasOverlap = true;
            
            // 겹침 깊이
            const overlapX = minDistX - absDx;
            const overlapY = minDistY - absDy;
            
            // 충돌 반발 방향 벡터 설정 (0일 경우 방지)
            const signX = dx === 0 ? (Math.random() > 0.5 ? 1 : -1) : Math.sign(dx);
            const signY = dy === 0 ? (Math.random() > 0.5 ? 1 : -1) : Math.sign(dy);

            let pushX = 0;
            let pushY = 0;
            
            // 세로로 정렬
            if (overlapX < overlapY * 1.5) {
              pushX = overlapX * signX;
            } else {
              pushY = overlapY * signY;
            }
            
            const damping = 0.45;
            
            if (!isFixedA && !isFixedB) {
              nodeA.renderX -= pushX * 0.5 * damping;
              nodeA.renderY -= pushY * 0.5 * damping;
              nodeB.renderX += pushX * 0.5 * damping;
              nodeB.renderY += pushY * 0.5 * damping;
            } else if (isFixedA && !isFixedB) {
              nodeB.renderX += pushX * damping;
              nodeB.renderY += pushY * damping;
            } else if (!isFixedA && isFixedB) {
              nodeA.renderX -= pushX * damping;
              nodeA.renderY -= pushY * damping;
            }
          }
        }
        if (!hasOverlap) break;
      }
    });
  }

  // 더 이상 사용하지 않음
  public static computeOrbitRadii(_canvasW: number, _canvasH: number): number[] {
    return [];
  }
}
