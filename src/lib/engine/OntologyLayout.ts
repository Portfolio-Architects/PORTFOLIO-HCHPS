import { OrbitalNode, OntologyEdge } from '../ontology.types';

// ============ Constants ============

export const NUM_ORBITS = 8;
export const ELLIPSE_RATIO = 1.3;  
export const MIN_NODE_R = 3;
export const MAX_NODE_R = 24;
export const ORBIT_SPEED_BASE = 0.0006; 
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
    recomputeWorldPositions: boolean = true,
    layoutMode: 'orbit' = 'orbit',
    isOrbiting: boolean = false
  ): void {
    if (nodes.length === 0) return;

    // Silence unused parameter warnings when maxIterations === 0
    if (isInteractive || layoutMode) {
      // noop
    }

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
      const mainRoot = nodes.find(n => n.id === 'root-HCHPS') || nodes.find(n => n.orbitIndex === 0) || nodes[0];
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

      // 3. Bidirectional Depth-Based Contour Layout (양방향 마인드맵 전개) 또는 Concentric Orbit Layout (우주 궤도 배치)
      const visibleNodes = new Set<string>();

      // Concentric Orbit Layout: 모든 노드를 중앙(0,0) 중심의 동심 궤도에 배치
      const getNodeDepth = (nodeId: string): number => {
        let depth = 0;
        const visited = new Set<string>();
        let curr = nodeMap.get(nodeId);
        while (curr && curr.parentId) {
          if (visited.has(curr.id)) {
            console.error(`[OntologyLayout] Circular parentId reference detected at node: ${curr.id}. Breaking loop to prevent infinite loop hang.`);
            break;
          }
          visited.add(curr.id);
          depth++;
          curr = nodeMap.get(curr.parentId);
        }
        return depth;
      };

      const layoutOrbitNode = (
        nodeId: string,
        parentNode: OrbitalNode | null,
        assignedAngle: number,
        arcWidth: number
      ) => {
        const node = nodeMap.get(nodeId);
        if (!node) return;

        visibleNodes.add(nodeId);

        let depth = getNodeDepth(nodeId);
        // 중앙 노드(mainRoot)가 아니면서 depth가 0인 고아 노드들은 강제로 1차 궤도에 안착시킵니다.
        if (depth === 0 && nodeId !== mainRoot.id) {
          depth = 1;
        }
        node.orbitIndex = depth;
        node.orbitAngle = assignedAngle;

        // 💡 런타임 충돌 피직스를 완전히 꺼두는 대신, 정적 지그재그 반경 오프셋(Static Radial Offset)을 
        // 형제 노드들의 인덱스에 따라 안팎으로 +-40px씩 엇갈리게 교차 배치하여 겹침을 정적으로 해결합니다.
        let staticOffset = 0;
        if (depth > 0 && parentNode) {
          const siblings = treeChildrenMap.get(parentNode.id) || [];
          const sibIdx = siblings.indexOf(nodeId);
          if (sibIdx !== -1) {
            staticOffset = sibIdx % 2 === 0 ? -40 : 40;
          }
        }
        (node as any).radialOffset = staticOffset;

        // 허용 각도 쐐기 범위 계산 및 부여 (경계 간 겹침 방지 버퍼 0.02 적용)
        const buffer = 0.02;
        const halfArc = arcWidth / 2;
        (node as any).minAngle = assignedAngle - halfArc + buffer;
        (node as any).maxAngle = assignedAngle + halfArc - buffer;

        if (depth === 0) {
          node.targetWorldX = 0;
          node.targetWorldY = 0;
          (node as any).minAngle = -Infinity;
          (node as any).maxAngle = Infinity;
        } else {
          if (!isOrbiting && node.fixedX !== undefined && node.fixedY !== undefined) {
            node.targetWorldX = node.fixedX;
            node.targetWorldY = node.fixedY;
            node.worldX = node.fixedX;
            node.worldY = node.fixedY;
          } else {
            // R 간격을 조금 더 넓혀(240px) 공간감 확보하고, radialOffset(지그재그)을 합산합니다.
            const rOffset = (node as any).radialOffset ?? 0;
            const R = depth * 240 + rOffset;
            node.targetWorldX = R * Math.cos(assignedAngle) * ELLIPSE_RATIO;
            node.targetWorldY = R * Math.sin(assignedAngle);
          }
        }

        if (!collapsedNodeIds.has(nodeId)) {
          const children = treeChildrenMap.get(nodeId) || [];
          const N = children.length;
          if (N > 0) {
            const childArcWidth = Math.min(Math.PI * 1.5, arcWidth * 0.75);
            const angleStep = N === 1 ? 0 : childArcWidth / (N - 1);
            const startAngle = assignedAngle - childArcWidth / 2;

            children.forEach((childId, idx) => {
              const childNode = nodeMap.get(childId);
              if (childNode) {
                const childAngle = N === 1 ? assignedAngle : startAngle + idx * angleStep;
                layoutOrbitNode(childId, node, childAngle, childArcWidth);
              }
            });
          }
        }
      };

      if (mainRoot) {
        mainRoot.orbitIndex = 0;
        mainRoot.orbitAngle = 0;
        mainRoot.targetWorldX = 0;
        mainRoot.targetWorldY = 0;
        mainRoot.worldX = 0;
        mainRoot.worldY = 0;
        visibleNodes.add(mainRoot.id);

        const children = treeChildrenMap.get(mainRoot.id) || [];
        const N = children.length;
        if (N > 0) {
          const angleStep = (Math.PI * 2) / N;
          const orbitRotationOffset = 0.2; // 약간 경사진 느낌을 주기 위한 오프셋
          children.forEach((childId, idx) => {
            const childNode = nodeMap.get(childId);
            if (childNode) {
              const childAngle = (idx * angleStep) + orbitRotationOffset;
              layoutOrbitNode(childId, mainRoot, childAngle, angleStep);
            }
          });
        }
      }

      const orphanRoots = roots.slice(1);
      const orphanCount = orphanRoots.length;
      if (orphanCount > 0) {
        const angleStep = (Math.PI * 2) / orphanCount;
        orphanRoots.forEach((root, idx) => {
          const rootNode = nodeMap.get(root.id);
          if (rootNode) {
            const assignedAngle = idx * angleStep;
            layoutOrbitNode(root.id, null, assignedAngle, angleStep);
          }
        });
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
    } else {
      // Fast-path: 토폴로지가 변하지 않는 동안 공전 및 LERP 모핑을 지원하기 위한 targetWorldX/Y 최신화
      for (const node of nodes) {
        if (node.orbitIndex === 0) {
          node.targetWorldX = 0;
          node.targetWorldY = 0;
        } else if (!isOrbiting && node.fixedX !== undefined && node.fixedY !== undefined) {
          node.targetWorldX = node.fixedX;
          node.targetWorldY = node.fixedY;
          node.worldX = node.fixedX;
          node.worldY = node.fixedY;
        } else if (node.orbitIndex !== undefined && node.orbitAngle !== undefined) {
          const R = node.orbitIndex * 240;
          const rOffset = (node as any).radialOffset ?? 0;
          node.targetWorldX = (R + rOffset) * Math.cos(node.orbitAngle) * ELLIPSE_RATIO;
          node.targetWorldY = (R + rOffset) * Math.sin(node.orbitAngle);
        }
      }
    }

    // 6. Camera 변환 (World -> Screen - 3D Vertical Stacked Projection)
    const cx = canvasW / 2 + cameraOffsetX;
    const cy = canvasH / 2 + cameraOffsetY;

    const tiltAngle = 42 * Math.PI / 180; // 42도 경사각
    const cosTilt = Math.cos(tiltAngle);
    const sinTilt = Math.sin(tiltAngle);
    const cameraDist = 1000;              // 카메라 거리
    const LAYER_GAP = 190;                // 레이어 간 수직 적층 격차 (가독성 최적값)

    for (const node of nodes) {
      const effectiveLayer = node.effectiveLayer ?? 3;
      // 수직 레이어 필터 기능을 완전히 비활성화(삭제)하여 항상 보이도록 강제
      const isFiltered = false;

      // 레이어 필터 또는 계층 접힘에 의해 최종적으로 숨김 여부 설정
      node.layoutHidden = node.topoHidden || isFiltered;

      if (node.layoutHidden) {
        node.renderX = -999999;
        node.renderY = -999999;
        continue;
      }
      
      if (!isOrbiting && node.fixedX !== undefined && node.fixedY !== undefined) {
        node.worldX = node.fixedX;
        node.worldY = node.fixedY;
      }
      if (node.worldX === undefined || isNaN(node.worldX)) {
        node.worldX = node.targetWorldX ?? 0;
      }
      if (node.worldY === undefined || isNaN(node.worldY)) {
        node.worldY = node.targetWorldY ?? 0;
      }
      const worldX = node.worldX ?? 0;
      const worldY = node.worldY ?? 0;
      
      // 💡 Z축(수직 적층 레이어 높이)을 추가로 설정하여 4단 아크릴 판 위에 입체적으로 안착시킵니다.
      const h = effectiveLayer * LAYER_GAP;
      const depthH = effectiveLayer * LAYER_GAP;

      // 3D X축 회전 변환 공식 적용 (depthH를 활용해 원근 배율 조정)
      const rotatedY = worldY * cosTilt - h * sinTilt;
      const depth = -worldY * sinTilt + depthH * cosTilt;
      
      const perspectiveScale = Math.max(0.05, cameraDist / (cameraDist + depth));

      node.renderX = cx + worldX * zoom * perspectiveScale;
      node.renderY = cy + rotatedY * zoom * perspectiveScale;
      
      node.renderZ = depth;
      (node as any).perspectiveScale = perspectiveScale;
      node.nodeRadius = 24; 
    }

    // 7. Screen-Space Collision Resolution (2D 화면 공간 충돌 방지 루프)
    // 💡 노드들이 튕기고 흔들리는 물리적 요동(Jittering)을 박멸하고 CPU 병목을 근본적으로 차단하기 위해
    // 런타임 2D 화면 공간 충돌 물리 연산은 완전히 꺼둡니다(maxIterations = 0).
    const maxIterations = 0;
    
    if (maxIterations > 0) {
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
        const isFixed = (!isOrbiting && (node as any).fixedX !== undefined && (node as any).fixedY !== undefined) || node.orbitIndex === 0;
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
      
      layerGroups.forEach((group) => {
        // 💡 공전 중인 환경에서 노드들이 튕기거나 요동치는 떨림(Jittering)을 박멸하기 위해,
        // 충돌 반발력 감쇠(damping)를 극도로 낮추어 부드럽게 미끄러지며 분산되도록 튜닝합니다.
        const damping = 0.015;
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

              const overlapX = minDistX - absDx;
              const overlapY = minDistY - absDy;
              
              if (overlapX <= 0 || overlapY <= 0) {
                continue;
              }

              hasOverlap = true;
              const overlap = Math.min(overlapX, overlapY);

              let angleDiff = (nodeB.orbitAngle || 0) - (nodeA.orbitAngle || 0);
              while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
              while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

              const radiusA = (nodeA.orbitIndex || 1) * 240;
              // 1회 충돌 반발 당 최대 밀기 회전각을 0.04라디안으로 제한하여 과도한 진동/발산 운동을 차단합니다.
              const rawPushAngle = (overlap / Math.max(50, radiusA)) * damping;
              // 💡 1회 프레임당 가해지는 최대 밀기각 한도를 0.04 -> 0.005로 크게 줄여 급격한 각도 흔들림을 억제합니다.
              const pushAngle = Math.min(0.005, rawPushAngle);
              const direction = angleDiff >= 0 ? 1 : -1;

              if (!isFixedA && !isFixedB) {
                nodeA.orbitAngle = (nodeA.orbitAngle || 0) - pushAngle * 0.5 * direction;
                nodeB.orbitAngle = (nodeB.orbitAngle || 0) + pushAngle * 0.5 * direction;
              } else if (isFixedA && !isFixedB) {
                nodeB.orbitAngle = (nodeB.orbitAngle || 0) + pushAngle * direction;
              } else if (!isFixedA && isFixedB) {
                nodeA.orbitAngle = (nodeA.orbitAngle || 0) - pushAngle * direction;
              }

              // 부모의 각도 쐐기 바운더리를 벗어나지 않도록 강제 제한 (Clamping)
              if (!isFixedA && (nodeA as any).minAngle !== undefined) {
                nodeA.orbitAngle = Math.max((nodeA as any).minAngle, Math.min((nodeA as any).maxAngle, nodeA.orbitAngle || 0));
              }
              if (!isFixedB && (nodeB as any).minAngle !== undefined) {
                nodeB.orbitAngle = Math.max((nodeB as any).minAngle, Math.min((nodeB as any).maxAngle, nodeB.orbitAngle || 0));
              }

              // 동일 궤도상 노드들 간 겹침 시 지그재그 반경 오프셋 적용
              if (nodeA.orbitIndex === nodeB.orbitIndex && nodeA.orbitIndex > 0) {
                const rawOverlap = overlap;
                if (rawOverlap > 0) {
                  const maxOffset = 45;
                  // 💡 반경 방향 밀림 계수를 0.45에서 0.05로 크게 낮추어 궤도 반경 방향 튕김 현상을 억제합니다.
                  if (!isFixedA) {
                    (nodeA as any).radialOffset = ((nodeA as any).radialOffset ?? 0) - rawOverlap * 0.05;
                    (nodeA as any).radialOffset = Math.max(-maxOffset, Math.min(maxOffset, (nodeA as any).radialOffset));
                  }
                  if (!isFixedB) {
                    (nodeB as any).radialOffset = ((nodeB as any).radialOffset ?? 0) + rawOverlap * 0.05;
                    (nodeB as any).radialOffset = Math.max(-maxOffset, Math.min(maxOffset, (nodeB as any).radialOffset));
                  }
                }
              }

              // worldX, worldY 즉시 싱크 (LERP 지연에 의해 이전 renderX/Y가 계속해서 반발되는 교착 떨림 현상을 해소합니다)
              if (nodeA.orbitIndex !== 0) {
                const radiusA = (nodeA.orbitIndex || 1) * 240;
                const rOffsetA = (nodeA as any).radialOffset ?? 0;
                nodeA.targetWorldX = (radiusA + rOffsetA) * Math.cos(nodeA.orbitAngle) * ELLIPSE_RATIO;
                nodeA.targetWorldY = (radiusA + rOffsetA) * Math.sin(nodeA.orbitAngle);
                nodeA.worldX = nodeA.targetWorldX;
                nodeA.worldY = nodeA.targetWorldY;
              } else {
                nodeA.targetWorldX = 0;
                nodeA.targetWorldY = 0;
                nodeA.worldX = 0;
                nodeA.worldY = 0;
              }

              if (nodeB.orbitIndex !== 0) {
                const radiusB = (nodeB.orbitIndex || 1) * 240;
                const rOffsetB = (nodeB as any).radialOffset ?? 0;
                nodeB.targetWorldX = (radiusB + rOffsetB) * Math.cos(nodeB.orbitAngle) * ELLIPSE_RATIO;
                nodeB.targetWorldY = (radiusB + rOffsetB) * Math.sin(nodeB.orbitAngle);
                nodeB.worldX = nodeB.targetWorldX;
                nodeB.worldY = nodeB.targetWorldY;
              } else {
                nodeB.targetWorldX = 0;
                nodeB.targetWorldY = 0;
                nodeB.worldX = 0;
                nodeB.worldY = 0;
              }

              // 2D 스크린 투영 좌표 즉시 갱신 (이중 루프 내 후속 노드들의 겹침 계산에 즉각 반영하여 진동을 종식시킵니다)
              const cosT = Math.cos(tiltAngle);
              const sinT = Math.sin(tiltAngle);

              const rotYA = nodeA.worldY * cosT;
              const depthA = -nodeA.worldY * sinT;
              const scaleA = cameraDist / (cameraDist + depthA);
              nodeA.renderX = cx + nodeA.worldX * zoom * scaleA;
              nodeA.renderY = cy + rotYA * zoom * scaleA;
              (nodeA as any).perspectiveScale = scaleA;

              const rotYB = nodeB.worldY * cosT;
              const depthB = -nodeB.worldY * sinT;
              const scaleB = cameraDist / (cameraDist + depthB);
              nodeB.renderX = cx + nodeB.worldX * zoom * scaleB;
              nodeB.renderY = cy + rotYB * zoom * scaleB;
              (nodeB as any).perspectiveScale = scaleB;
            }
          }
          if (!hasOverlap) break;
        }
      });
    }
  }

  // 더 이상 사용하지 않음
  public static computeOrbitRadii(_canvasW: number, _canvasH: number): number[] {
    return [];
  }
}
