import { OrbitalNode, OntologyEdge } from '../ontology.types';
import { PerformanceProfiler } from './PerformanceProfiler';

// ============ Constants ============

export const NUM_ORBITS = 8;
export const ELLIPSE_RATIO = 1.3;  
export const MIN_NODE_R = 3;
export const MAX_NODE_R = 24;
export const ORBIT_SPEED_BASE = 0.0006; 
export const LERP_SPEED = 0.08;  
export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 3.0;
export const MIN_TILT = 0.3;
export const MAX_TILT = 1.0;
export const CULL_MARGIN = 80;  

// Layout parameters - defined inside computePositions

export class OntologyLayout {
  public static LAYER_GAP = 65;
  public static tiltAngle = 42 * Math.PI / 180;
  public static readonly cosTilt = Math.cos(42 * Math.PI / 180);
  public static readonly sinTilt = Math.sin(42 * Math.PI / 180);
  public static filterLayers = new Set<number>([0, 1, 2, 3]);
  public static filterGroups = new Set<string>();
  public static filterRiskOnly = false;
  public static lastTreeChildrenMap = new Map<string, string[]>();
  public static lastSpanningTreeEdgeSet = new Set<string>();
  public static dynamicRules: { agents: string[], resources: string[], executions: string[] } | null = null;
  public static totalNodesCount = 0;
  private static collisionGroups: [OrbitalNode[], OrbitalNode[], OrbitalNode[], OrbitalNode[]] = [[], [], [], []];

  /**
   * 궤도 인덱스에 따른 비선형 반경을 반환하는 지능형 헬퍼
   * 1차 궤도(카테고리)는 145px로 좁게, 그 외 2/3차는 여유있는 190px 간격 유지
   * 대규모 맵(노드 수에 비례)일 때는 자동으로 궤도 간격을 확장하여 겹침을 방지함
   */
  public static getOrbitRadius(orbitIndex: number): number {
    if (orbitIndex === 0) return 0;
    
    const totalCount = OntologyLayout.totalNodesCount;
    const expansionFactor = totalCount > 100
      ? Math.min(1.15, 1.0 + (totalCount - 100) * 0.0005)
      : 1.0;

    const baseRadius1 = 80 * expansionFactor;
    const baseGap = 65 * expansionFactor;

    if (orbitIndex === 1) return baseRadius1;

    let radius = baseRadius1;
    let currentGap = baseGap;
    for (let i = 1; i < orbitIndex; i++) {
      radius += currentGap;
      currentGap = Math.max(25, currentGap * 0.75);
    }
    return radius;
  }

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
    isOrbiting: boolean = false,
    isDragging: boolean = false
  ): void {
    if (nodes.length === 0) return;
    OntologyLayout.totalNodesCount = nodes.length;

    // Silence unused parameter warnings when maxIterations === 0
    if (isInteractive) {
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
      const mainRoot = nodes.find(n => n.centralityScore === 9999999) || nodes.find(n => n.id === 'root-HCHPS') || nodes[0];
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
      // 💡 토폴로지 위계가 꼬이지 않도록, parentId가 없거나 부모가 이미 방문된 노드부터 우선적으로 루트로 선언하여 BFS를 구동합니다.
      while (true) {
        const sortedUnvisited = nodes
          .filter(n => !visitedBfs.has(n.id))
          .sort((a, b) => {
            const hasParentA = a.parentId && !visitedBfs.has(a.parentId) ? 1 : 0;
            const hasParentB = b.parentId && !visitedBfs.has(b.parentId) ? 1 : 0;
            return hasParentA - hasParentB;
          });
        
        if (sortedUnvisited.length === 0) break;
        
        const n = sortedUnvisited[0];
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

      // 3. Layout Execution
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
        assignedAngle: number
      ) => {
        const node = nodeMap.get(nodeId);
        if (!node) return;

        visibleNodes.add(nodeId);

        let depth = getNodeDepth(nodeId);
        if (depth === 0 && nodeId !== mainRoot.id) {
          depth = 1;
        }

        let defaultOrbit: number;
        if (parentNode) {
          if (parentNode.orbitIndex === 0) {
            defaultOrbit = 2;
          } else {
            defaultOrbit = parentNode.orbitIndex + 1;
          }
        } else {
          defaultOrbit = Math.max(2, depth);
        }
        node.orbitIndex = node.customOrbitIndex ?? defaultOrbit;
        node.orbitAngle = assignedAngle;

        let staticOffset = 0;
        if (depth > 0 && parentNode) {
          const siblings = treeChildrenMap.get(parentNode.id) || [];
          const sibIdx = siblings.indexOf(nodeId);
          if (sibIdx !== -1) {
            staticOffset = sibIdx % 2 === 0 ? -12 : 12; // 2D 평면에서는 정적 지그재그 오프셋 폭을 12px로 축소
          }
        }
        node.radialOffset = staticOffset;

        if (depth === 0) {
          node.targetWorldX = 0;
          node.targetWorldY = 0;
        } else {
          if (!isOrbiting && node.fixedX !== undefined && node.fixedX !== null && node.fixedY !== undefined && node.fixedY !== null) {
            node.targetWorldX = node.fixedX;
            node.targetWorldY = node.fixedY;
            node.worldX = node.fixedX;
            node.worldY = node.fixedY;
          } else {
            if (parentNode && (parentNode.id.startsWith('festival-hub') || parentNode.id.includes('hub'))) {
              // Outward sector arc clustering for domain hubs
              const hubX = parentNode.fixedX ?? parentNode.targetWorldX ?? 0;
              const hubY = parentNode.fixedY ?? parentNode.targetWorldY ?? 0;
              const hubAngle = Math.atan2(hubY, hubX);
              const siblings = treeChildrenMap.get(parentNode.id) || [];
              const N = siblings.length;
              const sibIdx = siblings.indexOf(nodeId);
              const spread = (70 * Math.PI) / 180;
              const startA = hubAngle - spread / 2;
              const stepA = N > 1 ? spread / (N - 1) : 0;
              const childA = N > 1 ? startA + sibIdx * stepA : hubAngle;
              const sectorR = 110;

              node.targetWorldX = hubX + sectorR * Math.cos(childA) * ELLIPSE_RATIO;
              node.targetWorldY = hubY + sectorR * Math.sin(childA);
            } else if (depth === 1) {
              // 1차 카테고리: 절대 반경 145px
              const R = OntologyLayout.getOrbitRadius(1);
              node.targetWorldX = R * Math.cos(assignedAngle) * ELLIPSE_RATIO;
              node.targetWorldY = R * Math.sin(assignedAngle);
            } else if (depth === 2 && parentNode) {
              // 2차 카테고리: 부모 1차 노드 기점 상대 반경 65px + 지그재그 오프셋
              const r = 65 + staticOffset;
              node.targetWorldX = parentNode.targetWorldX! + r * Math.cos(assignedAngle) * ELLIPSE_RATIO;
              node.targetWorldY = parentNode.targetWorldY! + r * Math.sin(assignedAngle);
            } else if (depth === 3 && parentNode) {
              // 3차 카테고리: 부모 2차 노드 기점 상대 반경 50px + 지그재그 오프셋
              const r = 50 + staticOffset;
              node.targetWorldX = parentNode.targetWorldX! + r * Math.cos(assignedAngle) * ELLIPSE_RATIO;
              node.targetWorldY = parentNode.targetWorldY! + r * Math.sin(assignedAngle);
            } else {
              // 폴백 (고아 노드 등)
              const R = OntologyLayout.getOrbitRadius(node.orbitIndex);
              node.targetWorldX = R * Math.cos(assignedAngle) * ELLIPSE_RATIO;
              node.targetWorldY = R * Math.sin(assignedAngle);
            }
          }
        }

        if (!collapsedNodeIds.has(nodeId)) {
          const children = treeChildrenMap.get(nodeId) || [];
          const N = children.length;
          if (N > 0) {
            let span = Math.PI * 0.75;
            if (depth === 1) {
              // 1차 카테고리의 자식들은 바깥 방향 240도(Math.PI * 1.33) 대역으로 쫙 펼침 (중심 루트 회피)
              span = Math.PI * 1.33;
            } else if (depth === 2) {
              // 2차 카테고리의 자식들은 바깥 방향 160도(Math.PI * 0.88) 대역으로 고르게 분산
              span = Math.PI * 0.88;
            }

            const angleStep = N === 1 ? 0 : span / (N - 1);
            const startAngle = assignedAngle - span / 2;

            children.forEach((childId, idx) => {
              const childNode = nodeMap.get(childId);
              if (childNode) {
                const childAngle = N === 1 ? assignedAngle : startAngle + idx * angleStep;
                layoutOrbitNode(childId, node, childAngle);
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
              layoutOrbitNode(childId, mainRoot, childAngle);
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
            layoutOrbitNode(root.id, null, assignedAngle);
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
        } else if (!isOrbiting && node.fixedX !== undefined && node.fixedX !== null && node.fixedY !== undefined && node.fixedY !== null) {
          node.targetWorldX = node.fixedX;
          node.targetWorldY = node.fixedY;
          node.worldX = node.fixedX;
          node.worldY = node.fixedY;
        } else if (node.orbitIndex !== undefined && node.orbitAngle !== undefined) {
          const cosS = node.cosSpeed ?? Math.cos(node.orbitSpeed ?? 0);
          const sinS = node.sinSpeed ?? Math.sin(node.orbitSpeed ?? 0);
          
          if (isOrbiting && node.orbitCos !== undefined && node.orbitSin !== undefined) {
            // Rotate unit vector
            const nextCos = node.orbitCos * cosS - node.orbitSin * sinS;
            const nextSin = node.orbitCos * sinS + node.orbitSin * cosS;
            
            // Renormalize using Taylor series fast-path + drift correction
            const d = nextCos * nextCos + nextSin * nextSin;
            node._renormFrame = (node._renormFrame || 0) + 1;
            if (node._renormFrame >= 120 || d < 0.999 || d > 1.001) {
              node._renormFrame = 0;
              const len = Math.sqrt(d);
              node.orbitCos = nextCos / (len || 0.1);
              node.orbitSin = nextSin / (len || 0.1);
            } else {
              const invLen = 1.5 - 0.5 * d; // Taylor series approximation around x = 1
              node.orbitCos = nextCos * invLen;
              node.orbitSin = nextSin * invLen;
            }
            
            // Map back to coordinates using exact radius
            const rOffset = node.radialOffset ?? 0;
            const R = OntologyLayout.getOrbitRadius(node.orbitIndex) + rOffset;
            node.targetWorldX = R * node.orbitCos * ELLIPSE_RATIO;
            node.targetWorldY = R * node.orbitSin;
          } else {
            // 비공전 중이거나 초기화 상태일 때는 삼각함수로 위치 확정
            if (node.targetWorldX === undefined || node.targetWorldY === undefined || isNaN(node.targetWorldX) || isNaN(node.targetWorldY)) {
              const rOffset = node.radialOffset ?? 0;
              const R = OntologyLayout.getOrbitRadius(node.orbitIndex) + rOffset;
              node.targetWorldX = R * Math.cos(node.orbitAngle) * ELLIPSE_RATIO;
              node.targetWorldY = R * Math.sin(node.orbitAngle);
            }
          }
        }
      }
    }

    // 6. Camera 변환 (World -> Screen - 3D Perspective Projection 복원)
    const cx = canvasW / 2 + cameraOffsetX;
    const cy = canvasH / 2 + cameraOffsetY;
    const cosTilt = OntologyLayout.cosTilt;
    const sinTilt = OntologyLayout.sinTilt;
    const cameraDist = 800; // 3D 원근 기준 거리

    for (const node of nodes) {
      const effectiveLayer = node.effectiveLayer ?? 3;
      const risk = node.riskFactor ?? 0;
      const isRiskOrigin = node.group === 'SYSTEM_RISK';
      const isRiskAffected = risk > 0.3;
      const isRiskHigh = isRiskOrigin || isRiskAffected;

      let isFiltered = false;
      if (OntologyLayout.filterLayers && !OntologyLayout.filterLayers.has(effectiveLayer)) {
        isFiltered = true;
      }
      if (OntologyLayout.filterGroups && OntologyLayout.filterGroups.size > 0 && !OntologyLayout.filterGroups.has(node.group)) {
        isFiltered = true;
      }
      if (OntologyLayout.filterRiskOnly && !isRiskHigh) {
        isFiltered = true;
      }

      // 레이어 필터 또는 계층 접힘에 의해 최종적으로 숨김 여부 설정
      node.layoutHidden = node.topoHidden || isFiltered;

      if (node.layoutHidden) {
        node.renderX = -999999;
        node.renderY = -999999;
        continue;
      }
      
      if (!isOrbiting && node.fixedX !== undefined && node.fixedX !== null && node.fixedY !== undefined && node.fixedY !== null) {
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
      
      // 3D 조감도 원근 변환 적용
      const h = effectiveLayer * OntologyLayout.LAYER_GAP;
      const rotatedY = worldY * cosTilt - h * sinTilt;
      const depth = -worldY * sinTilt + h * cosTilt;
      const perspectiveScale = Math.max(0.05, cameraDist / Math.max(120, cameraDist + depth));
      
      node.renderX = cx + worldX * zoom * perspectiveScale;
      node.renderY = cy + rotatedY * zoom * perspectiveScale;
      node.renderZ = depth;
      node.perspectiveScale = perspectiveScale;
      node.nodeRadius = 24 * perspectiveScale; 
      
      // Calculate and cache collision properties on the node itself:
      const weight = node.renderSize ?? 0.5;
      const sizeFactor = 0.8 + 0.5 * weight;
      const scale = perspectiveScale * sizeFactor;
      let textW = (node.label || '').length * 7.5;
      if (node._cachedTextWidth) {
        const cache = node._cachedTextWidth;
        textW = cache['600'] || cache['500'] || textW;
      }
      node._collisionW = Math.max(60 * scale, textW * scale + 28 * scale) + 16 * scale;
      node._collisionH = Math.max(28 * scale, 12 * scale + 20 * scale) + 12 * scale;
      node._isCollisionFixed = (!isOrbiting && node.fixedX !== undefined && node.fixedX !== null && node.fixedY !== undefined && node.fixedY !== null) || node.orbitIndex === 0; 
    }

    // 7. Screen-Space Collision Resolution (2D 화면 공간 충돌 방지 루프 복원)
    // 💡 노드들이 튕기고 흔들리는 물리적 요동(Jittering)을 박멸하기 위해 공전 중이 아닐 때만 충돌 방지 루프를 가동합니다.
    const shouldRunCollision = !isOrbiting && (recomputeWorldPositions || isDragging);
    let maxIterations = 0;
    if (shouldRunCollision) {
      if (isInteractive) {
        maxIterations = 5;
        const fps = PerformanceProfiler.getInstance().getMetrics().fps;
        if (fps > 0) {
          if (fps < 40) {
            maxIterations = 1;
          } else if (fps < 50) {
            maxIterations = 2;
          }
        }
      }
    }
    
    if (maxIterations > 0) {
      // Clear the pre-allocated static collisionGroups:
      for (let k = 0; k < 4; k++) {
        OntologyLayout.collisionGroups[k].length = 0;
      }
      
      // Populate collisionGroups using direct loop (no filter, no map, no array allocations):
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (
          !node.layoutHidden &&
          node.renderX !== -999999 &&
          node.renderX >= -CULL_MARGIN &&
          node.renderX <= canvasW + CULL_MARGIN &&
          node.renderY >= -CULL_MARGIN &&
          node.renderY <= canvasH + CULL_MARGIN
        ) {
          const layer = node.effectiveLayer ?? 3;
          // Ensure layer is clamped to 0..3 to avoid index out of bounds
          const layerIdx = Math.max(0, Math.min(3, layer));
          OntologyLayout.collisionGroups[layerIdx].push(node);
        }
      }
      
      for (let k = 0; k < 4; k++) {
        const group = OntologyLayout.collisionGroups[k];
        const groupLen = group.length;
        if (groupLen === 0) continue;
        
        let iterationDamping = 0.025;
        for (let iter = 0; iter < maxIterations; iter++) {
          iterationDamping *= 0.80;
          let hasOverlap = false;
          
          for (let i = 0; i < groupLen; i++) {
            const nodeA = group[i];
            const wA = nodeA._collisionW!;
            const hA = nodeA._collisionH!;
            const isFixedA = nodeA._isCollisionFixed!;
            
            for (let j = i + 1; j < groupLen; j++) {
              const nodeB = group[j];
              const wB = nodeB._collisionW!;
              const hB = nodeB._collisionH!;
              const isFixedB = nodeB._isCollisionFixed!;

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

              const overlap = Math.min(overlapX, overlapY);
              if (overlap < 0.8) {
                continue; // Ignore overlaps below 0.8px
              }
              hasOverlap = true;

              let angleDiff = (nodeB.orbitAngle || 0) - (nodeA.orbitAngle || 0);
              while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
              while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

              const radiusA = OntologyLayout.getOrbitRadius(nodeA.orbitIndex || 1);
              const rawPushAngle = (overlap / Math.max(50, radiusA)) * iterationDamping;
              const pushAngle = Math.min(0.005, rawPushAngle);
              const direction = angleDiff >= 0 ? 1 : -1;

              // compute dTheta for nodeA and nodeB
              let dThetaA = 0;
              let dThetaB = 0;

              if (!isFixedA && !isFixedB) {
                dThetaA = -pushAngle * 0.5 * direction;
                dThetaB = pushAngle * 0.5 * direction;
              } else if (isFixedA && !isFixedB) {
                dThetaB = pushAngle * direction;
              } else if (!isFixedA && isFixedB) {
                dThetaA = -pushAngle * direction;
              }

              if (dThetaA !== 0) {
                nodeA.orbitAngle = (nodeA.orbitAngle || 0) + dThetaA;
                if (!isFixedA && nodeA.minAngle !== undefined) {
                  nodeA.orbitAngle = Math.max(nodeA.minAngle, Math.min(nodeA.maxAngle ?? 0, nodeA.orbitAngle));
                }
                // Taylor-series approximation for nodeA unit vector
                const cosDA = 1 - dThetaA * dThetaA * 0.5;
                const sinDA = dThetaA;
                const prevCosA = nodeA.orbitCos ?? Math.cos(nodeA.orbitAngle - dThetaA);
                const prevSinA = nodeA.orbitSin ?? Math.sin(nodeA.orbitAngle - dThetaA);
                const nextCosA = prevCosA * cosDA - prevSinA * sinDA;
                const nextSinA = prevCosA * sinDA + prevSinA * cosDA;
                const lenA = Math.sqrt(nextCosA * nextCosA + nextSinA * nextSinA);
                nodeA.orbitCos = nextCosA / (lenA || 0.1);
                nodeA.orbitSin = nextSinA / (lenA || 0.1);
              }

              if (dThetaB !== 0) {
                nodeB.orbitAngle = (nodeB.orbitAngle || 0) + dThetaB;
                if (!isFixedB && nodeB.minAngle !== undefined) {
                  nodeB.orbitAngle = Math.max(nodeB.minAngle, Math.min(nodeB.maxAngle ?? 0, nodeB.orbitAngle));
                }
                // Taylor-series approximation for nodeB unit vector
                const cosDB = 1 - dThetaB * dThetaB * 0.5;
                const sinDB = dThetaB;
                const prevCosB = nodeB.orbitCos ?? Math.cos(nodeB.orbitAngle - dThetaB);
                const prevSinB = nodeB.orbitSin ?? Math.sin(nodeB.orbitAngle - dThetaB);
                const nextCosB = prevCosB * cosDB - prevSinB * sinDB;
                const nextSinB = prevCosB * sinDB + prevSinB * cosDB;
                const lenB = Math.sqrt(nextCosB * nextCosB + nextSinB * nextSinB);
                nodeB.orbitCos = nextCosB / (lenB || 0.1);
                nodeB.orbitSin = nextSinB / (lenB || 0.1);
              }

              // 동일 궤도상 노드들 간 겹침 시 지그재그 반경 오프셋 적용
              if (nodeA.orbitIndex === nodeB.orbitIndex && nodeA.orbitIndex > 0) {
                const rawOverlap = overlap;
                if (rawOverlap > 0) {
                  const maxOffset = 45;
                  if (!isFixedA) {
                    nodeA.radialOffset = (nodeA.radialOffset ?? 0) - rawOverlap * 0.05;
                    nodeA.radialOffset = Math.max(-maxOffset, Math.min(maxOffset, nodeA.radialOffset));
                  }
                  if (!isFixedB) {
                    nodeB.radialOffset = (nodeB.radialOffset ?? 0) + rawOverlap * 0.05;
                    nodeB.radialOffset = Math.max(-maxOffset, Math.min(maxOffset, nodeB.radialOffset));
                  }
                }
              }

              // worldX, worldY 즉시 싱크
              if (nodeA.fixedX !== undefined && nodeA.fixedX !== null && nodeA.fixedY !== undefined && nodeA.fixedY !== null) {
                nodeA.targetWorldX = nodeA.fixedX;
                nodeA.targetWorldY = nodeA.fixedY;
                nodeA.worldX = nodeA.fixedX;
                nodeA.worldY = nodeA.fixedY;
              } else if (nodeA.orbitIndex !== 0) {
                const radiusA = OntologyLayout.getOrbitRadius(nodeA.orbitIndex || 1);
                const rOffsetA = nodeA.radialOffset ?? 0;
                nodeA.targetWorldX = (radiusA + rOffsetA) * (nodeA.orbitCos ?? Math.cos(nodeA.orbitAngle)) * ELLIPSE_RATIO;
                nodeA.targetWorldY = (radiusA + rOffsetA) * (nodeA.orbitSin ?? Math.sin(nodeA.orbitAngle));
                nodeA.worldX = nodeA.targetWorldX;
                nodeA.worldY = nodeA.targetWorldY;
              } else {
                nodeA.targetWorldX = 0;
                nodeA.targetWorldY = 0;
                nodeA.worldX = 0;
                nodeA.worldY = 0;
              }

              if (nodeB.fixedX !== undefined && nodeB.fixedX !== null && nodeB.fixedY !== undefined && nodeB.fixedY !== null) {
                nodeB.targetWorldX = nodeB.fixedX;
                nodeB.targetWorldY = nodeB.fixedY;
                nodeB.worldX = nodeB.fixedX;
                nodeB.worldY = nodeB.fixedY;
              } else if (nodeB.orbitIndex !== 0) {
                const radiusB = OntologyLayout.getOrbitRadius(nodeB.orbitIndex || 1);
                const rOffsetB = nodeB.radialOffset ?? 0;
                nodeB.targetWorldX = (radiusB + rOffsetB) * (nodeB.orbitCos ?? Math.cos(nodeB.orbitAngle)) * ELLIPSE_RATIO;
                nodeB.targetWorldY = (radiusB + rOffsetB) * (nodeB.orbitSin ?? Math.sin(nodeB.orbitAngle));
                nodeB.worldX = nodeB.targetWorldX;
                nodeB.worldY = nodeB.targetWorldY;
              } else {
                nodeB.targetWorldX = 0;
                nodeB.targetWorldY = 0;
                nodeB.worldX = 0;
                nodeB.worldY = 0;
              }

              // 2D 스크린 투영 좌표 즉시 갱신
              const cosT = OntologyLayout.cosTilt;
              const sinT = OntologyLayout.sinTilt;

              const rotYA = nodeA.worldY * cosT;
              const depthA = -nodeA.worldY * sinT;
              const scaleA = cameraDist / (cameraDist + depthA);
              nodeA.renderX = cx + nodeA.worldX * zoom * scaleA;
              nodeA.renderY = cy + rotYA * zoom * scaleA;
              nodeA.perspectiveScale = scaleA;

              const rotYB = nodeB.worldY * cosT;
              const depthB = -nodeB.worldY * sinT;
              const scaleB = cameraDist / (cameraDist + depthB);
              nodeB.renderX = cx + nodeB.worldX * zoom * scaleB;
              nodeB.renderY = cy + rotYB * zoom * scaleB;
              nodeB.perspectiveScale = scaleB;
            }
          }
          if (!hasOverlap) break;
        }
      }
    }
  }


}
