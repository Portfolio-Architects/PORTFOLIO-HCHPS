/**
 * Ontology Canvas Engine — Layer 3
 * Pure Canvas 2D Orbital Rendering (No React dependency)
 */

import {
  OntologyNode, OntologyEdge, OntologyGraph, OrbitalNode,
} from './ontology.types';
import { OntologyNetwork } from './engine/OntologyNetwork';
import { OntologyRenderer } from './engine/OntologyRenderer';
import { PerformanceProfiler } from './engine/PerformanceProfiler';

import {
  OntologyLayout,
  NUM_ORBITS,
  MIN_NODE_R,
  MAX_NODE_R,
  ORBIT_SPEED_BASE,
  LERP_SPEED,
  MIN_ZOOM,
  MAX_ZOOM,
} from './engine/OntologyLayout';

// ============ Callbacks ============

export interface EngineCallbacks {
  onActiveNodeChange?: (node: OrbitalNode | null) => void;
  onHoveredNodeChange?: (node: OrbitalNode | null) => void;
  onNodeReparent?: (nodeId: string, newParentId: string | undefined, newOrbitIndex: number) => void;
  onNodePin?: (nodeId: string, fixedX: number, fixedY: number) => void;
  onNodeBatchPin?: (pins: { id: string; fixedX: number; fixedY: number }[]) => void;
  onNodeDoubleClick?: (node: OrbitalNode) => void;
}

// ============ Engine Class ============

export class OntologyCanvasEngine {
  nodes: OrbitalNode[] = [];
  edges: OntologyEdge[] = [];
  centralitySortedNodes: OrbitalNode[] = [];
  centerNode: OrbitalNode | null = null;
  activeNode: OrbitalNode | null = null;
  hoveredNode: OrbitalNode | null = null;

  // Camera
  zoom = 1;
  targetZoom = 1;
  public needsRedraw: boolean = true;
  public layoutWorldGeometryDirty: boolean = true;
  public cameraOffsetX = 0;
  private activeTreeSetCache: Set<string> = new Set();
  private lastActiveNodeIdForTree: string | null = null;
  public topologyDirty = true;
  public isTopologyDirty = true;
  cameraOffsetY = 0;
  targetOffsetX = 0;
  targetOffsetY = 0;
  private autoFitPending = false;
  public collapsedNodeIds: Set<string> = new Set();
  public hasInitializedCollapse: boolean = false;
  public isInitialCameraSnap: boolean = true;
  public physicsAlpha = 1.0;
  private idleFramesCount = 0;
  private physicsFrameCount = 0;

  // Physics / Interaction
  isOrbiting = false;
  private isFirstFrame = true;
  private frameCount = 0;
  private isDragging = false;
  private hasDragged = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private lastDragX = 0;
  private lastDragY = 0;
  private draggedNode: OrbitalNode | null = null;
  private draggedSubTree: { node: OrbitalNode; dx0: number; dy0: number }[] = [];
  previousActiveNodeId: string | null = null;
  public pendingCameraTargetId: string | null = null;

  // Stats
  nodeCount = 0;
  edgeCount = 0;

  // Callbacks
  callbacks: EngineCallbacks = {};

  // Precomputed
  private orbitRadii: number[] = [];
  private nodeMap = new Map<string, OrbitalNode>();
  private connectionSet = new Set<string>();  // 'id1|||id2' for O(1) lookup
  private spatialGrid = new Map<number, OrbitalNode[]>();
  private visitedMatrix = new Uint8Array(160000); // Pre-allocated matrix for up to 400 nodes
  private cellArrayPool: OrbitalNode[][] = [];
  private cellArrayPoolUsed = 0;
  private physicsEdges: { sourceNode: OrbitalNode; targetNode: OrbitalNode; weight: number }[] = [];

  // Reusable sort buffers (avoid per-frame allocation)
  private sortedNodes: OrbitalNode[] = [];
  private canvasW = 0;
  private canvasH = 0;
  private hasNodeMoved = false;
  private physicsTickCounter = 0;

  // Cache inputs for layout performance optimization
  private lastSortedActiveNodeId: string | null = null;
  private lastLayoutInputs?: {
    canvasW: number;
    canvasH: number;
    cameraOffsetX: number;
    cameraOffsetY: number;
    zoom: number;
    activeLayersKey: string;
    collapsedNodesKey: string;
    isInteractive: boolean;
  };



  public wakeUp(): void {
    this.physicsFrameCount = 0;
    this.physicsAlpha = 1.0;
    this.idleFramesCount = 0;
    this.needsRedraw = true;
  }

  // ============ Init ============
  
    init(graph: OntologyGraph, callbacks?: EngineCallbacks, prevNodes?: OrbitalNode[]): void {
      this.callbacks = callbacks || {};
      this.isFirstFrame = true;
      this.frameCount = 0;
      this.edges = graph.edges;
      this.nodeCount = graph.nodes.length;
      this.edgeCount = graph.edges.length;
      this.layoutWorldGeometryDirty = true;
      this.topologyDirty = true;
      this.isTopologyDirty = true;
  
      // 메모리에 잔존하는 NaN 카메라 좌표를 초기화하여 복구 (Hot Reload 시 캔버스 백화현상 방지)
      if (isNaN(this.cameraOffsetX) || isNaN(this.cameraOffsetY) || 
          isNaN(this.targetOffsetX) || isNaN(this.targetOffsetY)) {
        this.cameraOffsetX = 0;
        this.cameraOffsetY = 0;
        this.targetOffsetX = 0;
        this.targetOffsetY = 0;
        this.zoom = 1;
      }
  
      // Pre-build connection set for O(1) lookup
      this.connectionSet.clear();
      const degreeMap = new Map<string, number>();
      for (const edge of this.edges) {
        this.connectionSet.add(edge.source + '|||' + edge.target);
        this.connectionSet.add(edge.target + '|||' + edge.source);
        // 💡 각 노드가 갖는 총 연결선 개수(degree)를 O(E)로 사전 계산합니다.
        degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1);
        degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1);
      }

    // Sort by centrality descending → center node = highest
    const sorted = [...graph.nodes].sort(
      (a, b) => (b.centralityScore ?? 0) - (a.centralityScore ?? 0)
    );

    if (sorted.length === 0) return;

    const centerId = sorted[0].id;

    // Compute connection weights to center for each node
    const connectionMap = new Map<string, number>();
    for (const edge of this.edges) {
      if (edge.source === centerId) {
        connectionMap.set(edge.target, (connectionMap.get(edge.target) ?? 0) + Math.abs(edge.weight));
      } else if (edge.target === centerId) {
        connectionMap.set(edge.source, (connectionMap.get(edge.source) ?? 0) + Math.abs(edge.weight));
      }
    }

    // Non-center nodes sorted by customSortOrder, falling back to connection weight
    const otherNodes = sorted.slice(1).sort((a, b) => {
      const orderA = a.customSortOrder ?? 99999;
      const orderB = b.customSortOrder ?? 99999;
      if (orderA !== 99999 || orderB !== 99999) {
        return orderA - orderB;
      }
      return (connectionMap.get(b.id) ?? 0) - (connectionMap.get(a.id) ?? 0);
    });

    // ── 중심성(Centrality) 기반으로 주변 궤도(Orbit 1~8) 자동 순차 배정 매핑 ──
    const nonCenterNodesByCentrality = sorted.slice(1);
    const nonCenterCount = nonCenterNodesByCentrality.length;
    const centralityOrbitMap = new Map<string, number>();
    nonCenterNodesByCentrality.forEach((node, rank) => {
      if (node.customOrbitIndex !== undefined && node.customOrbitIndex !== null) {
        centralityOrbitMap.set(node.id, node.customOrbitIndex);
      } else {
        const targetOrbit = Math.min(NUM_ORBITS, Math.max(2, 1 + Math.floor(rank / Math.max(1, nonCenterCount / NUM_ORBITS))));
        centralityOrbitMap.set(node.id, targetOrbit);
      }
    });

    // 이전 엔진 상태(현재 공전 각도)를 백업해두어, 색상 변경 등으로 재초기화될 때 노드가 시작 좌표로 순간이동하는 현상(Whiplash)을 방지합니다.
    const previousNodeMap = new Map<string, Partial<OrbitalNode>>();
    if (prevNodes) {
      for (const n of prevNodes) {
        previousNodeMap.set(n.id, n);
      }
    } else {
      // 💡 페이지 이탈 후 재진입 시(prevNodes가 없는 상태)에도 노드의 공전 각도를 세션 캐시로부터 복원하여 위치를 완벽하게 유지시킵니다.
      if (typeof window !== 'undefined') {
        try {
          const cachedAnglesStr = sessionStorage.getItem('hchps-mindmap-orbit-angles');
          if (cachedAnglesStr) {
            const cachedAngles = JSON.parse(cachedAnglesStr);
            Object.entries(cachedAngles).forEach(([id, angle]) => {
              previousNodeMap.set(id, { id, orbitAngle: Number(angle) });
            });
          }
        } catch (e) {
          console.warn('[SessionStorage] Failed to restore orbit angles:', e);
        }
      }
    }

    // Build orbital nodes
    this.nodes = [];
    this.nodeMap.clear();
    this.needsRedraw = true;

    // Center node
    const centerPre = previousNodeMap.get(sorted[0].id);
    const centerAngle = (centerPre && typeof centerPre.orbitAngle === 'number' && !isNaN(centerPre.orbitAngle)) ? centerPre.orbitAngle : 0;
    const centerOrbital = this.makeOrbitalNode(sorted[0], 0, centerAngle, centerId, connectionMap, degreeMap);
    this.nodes.push(centerOrbital);
    this.centerNode = centerOrbital;
    this.nodeMap.set(centerOrbital.id, centerOrbital);
    // Categories (No parent) and Leaves (Has parent)
    const categoryNodes = otherNodes.filter(n => !n.parentId);
    const leafNodes = otherNodes.filter(n => n.parentId);

    // 1. Place Categories radially evenly, honoring their customOrbitIndex
    const categoriesByOrbit = new Map<number, OntologyNode[]>();
    categoryNodes.forEach(node => {
      const oIndex = centralityOrbitMap.get(node.id) ?? 1;
      if (!categoriesByOrbit.has(oIndex)) categoriesByOrbit.set(oIndex, []);
      categoriesByOrbit.get(oIndex)!.push(node);
    });

    categoriesByOrbit.forEach((catNodes, oIndex) => {
      const N = catNodes.length;
      const randomRingOffset = Math.random() * Math.PI * 2;
      catNodes.forEach((node, i) => {
        let angle = (2 * Math.PI * i / N) + randomRingOffset;
        
        // 이전 엔진 상태 백업이 있다면 카테고리 기둥도 각도를 복원해야 합니다! (NaN 오염 방지)
        const preData = previousNodeMap.get(node.id);
        if (preData && typeof preData.orbitAngle === 'number' && !isNaN(preData.orbitAngle)) {
          angle = preData.orbitAngle;
        }

        const orbital = this.makeOrbitalNode(node, oIndex, angle, centerId, connectionMap, degreeMap);
        this.nodes.push(orbital);
        this.nodeMap.set(orbital.id, orbital);
      });
    });

    // 2. Place Leaves iteratively using a Queue (Topological order)
    // This ensures parents are always processed before their children.
    const leavesByParent = new Map<string, OntologyNode[]>();
    leafNodes.forEach(node => {
      if (!node.parentId) return;
      if (!leavesByParent.has(node.parentId)) leavesByParent.set(node.parentId, []);
      leavesByParent.get(node.parentId)!.push(node);
    });

    const queue: string[] = Array.from(this.nodeMap.keys());
    const processedParents = new Set<string>();
    
    while(queue.length > 0) {
      const parentId = queue.shift()!;
      
      // Prevent infinite loops if parentId has a cycle!
      if (processedParents.has(parentId)) continue;
      processedParents.add(parentId);

      const leaves = leavesByParent.get(parentId);
      if (!leaves) continue;

      const parent = this.nodeMap.get(parentId)!;

      // Group leaves by their assigned orbit
      const orbitGroups = new Map<number, OntologyNode[]>();
      leaves.forEach((node, idx) => {
        // If no custom orbit, auto-assign layer based on 3 nodes per layer
        const layer = Math.floor(idx / 3);
        const orbitIndex = centralityOrbitMap.get(node.id) ?? Math.min(NUM_ORBITS, 2 + layer);
        if (!orbitGroups.has(orbitIndex)) orbitGroups.set(orbitIndex, []);
        orbitGroups.get(orbitIndex)!.push(node);
      });

      // Spread each group in a fan (arc) around the parent's angle
      orbitGroups.forEach((groupNodes, oIndex) => {
        const N = groupNodes.length;
        // 부모 노드의 각도를 기준으로 좌우 부채꼴 대역(Fan Arc)으로 자식 노드 분산 배치
        const parentAngle = parent.orbitAngle || 0;
        const maxSpan = Math.PI * 0.45; // 약 80도 대역폭으로 한정하여 겹침 억제
        const angleStep = N <= 1 ? 0 : maxSpan / (N - 1);
        const startAngle = N <= 1 ? parentAngle : parentAngle - maxSpan / 2;

        groupNodes.forEach((node, gIdx) => {
          let angle = startAngle + (gIdx * angleStep);
          // 기존에 공전 중이던 위치(각도)가 있다면 그대로 유지시켜 화면 중심 재정렬로 인한 순간이동 애니메이션 차단 (NaN 오염 방지)
          const preData = previousNodeMap.get(node.id);
          if (preData && typeof preData.orbitAngle === 'number' && !isNaN(preData.orbitAngle)) {
            angle = preData.orbitAngle;
          }
          
          const orbital = this.makeOrbitalNode(node, oIndex, angle, centerId, connectionMap, degreeMap);
          
          // 자식 노드가 고유 지정 색상이 없다면, 부모의 지정 색상(customColor)을 물려받아 
          // 1차 카테고리를 색칠하면 하위 2, 3차 카테고리까지 색상이 자동 동기화(Cascade) 되도록 처리
          if (!orbital.customColor && parent.customColor) {
            orbital.customColor = parent.customColor;
          }
          
          // 💡 화면상 모든 궤도의 물리적 선속도(Linear Velocity)를 균일하게 맞추기 위해,
          // 각속도(orbitSpeed)를 궤도 반경(orbitIndex)에 반비례하도록 튜닝하여 바깥쪽 노드가 폭주하는 현상을 보정합니다.
          orbital.orbitSpeed = (ORBIT_SPEED_BASE * 0.75) / Math.max(1, orbital.orbitIndex);
          this.nodes.push(orbital);
          this.nodeMap.set(orbital.id, orbital);
          
          queue.push(orbital.id); // Queue children for processing
        });
      });
      
      leavesByParent.delete(parentId);
    }
    
    // Fallback for isolated orphans or cycles (so no nodes visually vanish)
    leavesByParent.forEach((leaves) => {
      leaves.forEach(node => {
        let angle = Math.random() * Math.PI * 2;
        const preData = previousNodeMap.get(node.id);
        if (preData && typeof preData.orbitAngle === 'number' && !isNaN(preData.orbitAngle)) {
          angle = preData.orbitAngle;
        }
        
        const oIndex = node.customOrbitIndex ?? 1;
        const orbital = this.makeOrbitalNode(node, oIndex, angle, centerId, connectionMap, degreeMap);
        this.nodes.push(orbital);
        this.nodeMap.set(orbital.id, orbital);
      });
    });

    // 3. Restore Active Node / Camera Tracking
    if (this.previousActiveNodeId && this.nodeMap.has(this.previousActiveNodeId)) {
      this.activeNode = this.nodeMap.get(this.previousActiveNodeId)!;
    } else {
      this.activeNode = this.centerNode;
    }
    this.callbacks.onActiveNodeChange?.(this.activeNode);

    // 사용자의 요청에 따라: 초기 로딩 및 렌더 속도 극대화를 위해 1차 카테고리(orbitIndex === 1) 노드들을 기본적으로 접힌(collapsed) 상태로 설정하여 로드를 대폭 단축
    if (!this.hasInitializedCollapse && this.nodes.length > 0) {
      this.hasInitializedCollapse = true;
      this.collapsedNodeIds.clear();
      this.nodes.forEach(n => {
        if (n.orbitIndex === 1) {
          this.collapsedNodeIds.add(n.id);
        }
      });
    }

    // 중요도(renderSize) 내림차순으로 정렬된 노드 리스트 캐싱
    this.centralitySortedNodes = [...this.nodes].sort((a, b) => {
      const sizeA = a.renderSize ?? 0.5;
      const sizeB = b.renderSize ?? 0.5;
      return sizeB - sizeA;
    });

    // 18차 최적화: 매 프레임 Map 해시 룩업을 생략하기 위해 물리 연산용 노드 포인터 미리 바인딩
    this.physicsEdges.length = 0;
    for (const edge of this.edges) {
      if (edge.source === 'root-HCHPS' || edge.target === 'root-HCHPS') continue;
      const nodeA = this.nodeMap.get(edge.source);
      const nodeB = this.nodeMap.get(edge.target);
      if (nodeA && nodeB) {
        this.physicsEdges.push({
          sourceNode: nodeA,
          targetNode: nodeB,
          weight: Math.abs(edge.weight)
        });
      }
    }

    // 각 노드에 정수 인덱스 부여 (물리 척력 연산 내 visitedPairs 비트 연산 최적화용)
    this.nodes.forEach((node, i) => {
      node.index = i;
    });

    // 이전 엔진 노드들의 실제 물리 위치(worldX, worldY) 및 속도(vx, vy) 상태 복원
    for (const node of this.nodes) {
      const preNode = previousNodeMap.get(node.id);
      if (preNode) {
        if (typeof preNode.worldX === 'number' && !isNaN(preNode.worldX)) {
          node.worldX = preNode.worldX;
          node.targetWorldX = preNode.worldX;
        }
        if (typeof preNode.worldY === 'number' && !isNaN(preNode.worldY)) {
          node.worldY = preNode.worldY;
          node.targetWorldY = preNode.worldY;
        }
        if (typeof preNode.vx === 'number' && !isNaN(preNode.vx)) {
          node.vx = preNode.vx;
        }
        if (typeof preNode.vy === 'number' && !isNaN(preNode.vy)) {
          node.vy = preNode.vy;
        }
        if (typeof preNode.orbitCos === 'number' && !isNaN(preNode.orbitCos)) {
          node.orbitCos = preNode.orbitCos;
        }
        if (typeof preNode.orbitSin === 'number' && !isNaN(preNode.orbitSin)) {
          node.orbitSin = preNode.orbitSin;
        }
      }
    }

    // 4차 최적화: 엔진 재초기화 시 물리 시뮬레이션을 다시 깨움 (Sleep -> Wake Up)
    this.physicsAlpha = 1.0;
  }

  private makeOrbitalNode(
    node: OntologyNode,
    orbitIndex: number,
    angle: number,
    centerId: string,
    connectionMap: Map<string, number>,
    degreeMap: Map<string, number>,
  ): OrbitalNode {
    const renderSize = node.renderSize ?? 0.5;
    // Scale node sizes down for dense graphs (100+ nodes)
    const densityScale = this.nodeCount > 60 ? Math.max(0.5, 1 - (this.nodeCount - 60) / 200) : 1;
    const maxR = MAX_NODE_R * densityScale;
    const minR = MIN_NODE_R;
    const nodeRadius = minR + renderSize * (maxR - minR);
    // 💡 화면상 모든 궤도의 물리적 선속도를 일치시켜 시각적 차분함과 가독성을 고도화합니다 (각속도를 반지름에 반비례 제어).
    const finalOrbitSpeed = orbitIndex === 0 ? 0 : (ORBIT_SPEED_BASE * 0.75) / Math.max(1, orbitIndex);

    // 비선형 궤도 반경 계산 (1차는 145px로 좁게, 그 외 2/3차는 여유있는 190px 간격 유지)
    let R = 0;
    if (orbitIndex === 1) {
      R = 145;
    } else if (orbitIndex > 1) {
      R = 145 + (orbitIndex - 1) * 190;
    }

    const initialWorldX = R * Math.cos(angle);
    const initialWorldY = R * Math.sin(angle);
    const degree = degreeMap.get(node.id) ?? 0;

    return {
      ...node,
      orbitIndex,
      orbitAngle: angle,
      orbitCos: Math.cos(angle),
      orbitSin: Math.sin(angle),
      orbitSpeed: finalOrbitSpeed,
      cosSpeed: Math.cos(finalOrbitSpeed),
      sinSpeed: Math.sin(finalOrbitSpeed),
      worldX: initialWorldX,
      worldY: initialWorldY,
      targetWorldX: initialWorldX,
      targetWorldY: initialWorldY,
      vx: 0,
      vy: 0,
      renderX: 0,
      renderY: 0,
      renderZ: 0,
      connectionToCenter: connectionMap.get(node.id) ?? 0,
      nodeRadius,
      degree,
    };
  }

  // ============ Tick (per frame) ============

  // force-directed simulation tick
  private runPhysicsTick(): boolean {
    return false; // 2D 평면 상대적 방사형 배치에서는 겹침이 기하학적으로 방지되어 척력이 필요 없음 (물리 비활성화)

    // 노드 수 80개 이상일 때 2프레임당 1회 계산 (연산량 절반으로 분산)
    if (this.nodes.length > 80) {
      this.physicsTickCounter++;
      if (this.physicsTickCounter % 2 !== 0) {
        return false;
      }
    }

    const isCameraMoving = Math.abs(this.targetOffsetX - this.cameraOffsetX) > 0.8 || 
                           Math.abs(this.targetOffsetY - this.cameraOffsetY) > 0.8 ||
                           Math.abs(this.targetZoom - this.zoom) > 0.008;
    // 줌/패닝 휠 조작 및 LERP 이동 중이거나 노드 드래그가 아닌 단순 화면 드래그 패닝 중에는 물리 틱을 프리즈하여 줌 성능 드랍 방지
    if (isCameraMoving || (this.isDragging && !this.draggedNode)) {
      return false;
    }

    const nodes = this.nodes;
    
    // 1. Initialize velocities & Lock centers to (0,0)
    for (const node of nodes) {
      if (node.id === this.centerNode?.id || node.id === 'root-HCHPS') {
        node.worldX = 0;
        node.worldY = 0;
        node.targetWorldX = 0;
        node.targetWorldY = 0;
        node.vx = 0;
        node.vy = 0;
      } else {
        node.vx = node.vx ?? 0;
        node.vy = node.vy ?? 0;
      }
    }

    // 2. Spatial Hash Grid Repulsion & Overlap Prevention (O(N) 공간 분할 척력 연산)
    // 💡 최초 기동 시(frameCount < 15) 노드 간 겹침으로 인한 척력 폭발(Jittering)을 방지하기 위해 
    // 물리 시뮬레이션의 힘을 점진적으로 가속시키는 Soft-Start(소프트 스타트) 배율을 적용합니다.
    const softStartScale = this.frameCount < 15 ? (this.frameCount / 15) : 1.0;
    const chargeStrength = 15000 * softStartScale;
    const cellSize = 160;
    
    this.spatialGrid.clear();
    const N = nodes.length;
    if (N * N > this.visitedMatrix.length) {
      this.visitedMatrix = new Uint8Array(N * N * 2);
    }
    this.visitedMatrix.fill(0);
    this.cellArrayPoolUsed = 0;
    
    // 그리드에 노드 파티셔닝
    for (const node of nodes) {
      if (node.layoutHidden || node.id === this.centerNode?.id || node.id === 'root-HCHPS') continue;
      if (node.worldX === undefined || node.worldY === undefined || isNaN(node.worldX!) || isNaN(node.worldY!)) continue;
      const gx = Math.floor(node.worldX! / cellSize);
      const gy = Math.floor(node.worldY! / cellSize);
      const cellKey = ((gx + 32768) << 16) | (gy + 32768);
      
      let cell = this.spatialGrid.get(cellKey);
      if (!cell) {
        if (this.cellArrayPoolUsed < this.cellArrayPool.length) {
          cell = this.cellArrayPool[this.cellArrayPoolUsed++];
          cell!.length = 0;
        } else {
          cell = [];
          this.cellArrayPool.push(cell!);
          this.cellArrayPoolUsed++;
        }
        this.spatialGrid.set(cellKey, cell!);
      }
      cell!.push(node);
    }
    
    for (const nodeA of nodes) {
      if (nodeA.layoutHidden || nodeA.id === this.centerNode?.id || nodeA.id === 'root-HCHPS') continue;
      if (nodeA.worldX === undefined || nodeA.worldY === undefined || isNaN(nodeA.worldX!) || isNaN(nodeA.worldY!)) continue;
      
      const ax = nodeA.worldX!;
      const ay = nodeA.worldY!;
      const rA = nodeA.nodeRadius;
      
      // Spatial Hash Grid 9셀 조회
      const gx = Math.floor(ax / cellSize);
      const gy = Math.floor(ay / cellSize);
      
      for (let odx = -1; odx <= 1; odx++) {
        for (let ody = -1; ody <= 1; ody++) {
          const neighborKey = (((gx + odx) + 32768) << 16) | ((gy + ody) + 32768);
          const neighborNodes = this.spatialGrid.get(neighborKey);
          if (!neighborNodes) continue;
          
          for (const nodeB of neighborNodes!) {
            if (nodeB.id === nodeA.id) continue;
            
            // 💡 서로 다른 레이어에 속한 노드들은 3D 입체 투영(Z축 높이가 다름)에 의해 절대 겹치지 않으므로
            // 2D 물리 엔진 상에서 불필요하게 밀쳐내지 않도록 척력 연산을 완전히 스킵합니다. (떨림/튕김 원천 방지)
            if (nodeA.layerId !== undefined && nodeB.layerId !== undefined && nodeA.layerId !== nodeB.layerId) {
              continue;
            }
            
            // 중복 연산 방지 (Uint8Array flat matrix 활용)
            const idxA = nodeA.index ?? 0;
            const idxB = nodeB.index ?? 0;
            const matrixIdx = idxA * N + idxB;
            const matrixIdxReverse = idxB * N + idxA;
            if (this.visitedMatrix[matrixIdx] === 1) continue;
            this.visitedMatrix[matrixIdx] = 1;
            this.visitedMatrix[matrixIdxReverse] = 1;
            
            const bx = nodeB.worldX ?? 0;
            const by = nodeB.worldY ?? 0;
            const rB = nodeB.nodeRadius;
            
            const dx = bx - ax;
            const dy = by - ay;
            const distSq = dx * dx + dy * dy;
            
            // 임계 거리(320px) 이상 떨어지면 힘이 극소하므로 제곱근 및 척력 연산을 생략해 60 FPS 사수
            if (distSq > 102400) continue; 
            
            const minDist = rA + rB + 45; // 버블 간 최소 마진 45px 확보
            const minDistSq = minDist * minDist;

            // 💡 Math.sqrt 연산을 하기 전에, 노드가 서로 충분히 멀리 떨어져 있고 겹치지 않는 경우 
            // 제곱근 연산을 완전히 스킵해 무거운 계산을 생략합니다 (90% 이상의 노드 쌍에 적용됨).
            if (distSq > 22500 && distSq > minDistSq) {
              const dist = Math.sqrt(distSq) || 0.1;
              const force = chargeStrength / (distSq * dist + 200);
              nodeA.vx = (nodeA.vx ?? 0) - dx * force;
              nodeA.vy = (nodeA.vy ?? 0) - dy * force;
              nodeB.vx = (nodeB.vx ?? 0) + dx * force;
              nodeB.vy = (nodeB.vy ?? 0) + dy * force;
              continue;
            }

            // 겹쳤거나 매우 가까운 거리에 있을 때만 비로소 Math.sqrt 연산을 실행
            const dist = Math.sqrt(distSq) || 0.1;

            // A. 전방위 분산 반발 (d3-force forceManyBody 유사식)
            // 분모 폭발 방지를 위해 소프트 마진 200 추가
            let force = chargeStrength / (distSq * dist + 200);

            // B. 겹침 방지 (Overlapping Prevention) - 겹쳤을 때 강한 추가 척력 부여
            // 5차 수치 튜닝: 분모에 소프트 마진 15를 두어 극단적 겹침 상황에서의 척력 폭발(떨림 현상)을 수학적으로 예방
            if (dist < minDist) {
              force += ((minDist - dist) / (dist + 15)) * 2.2 * softStartScale;
            }

            nodeA.vx = (nodeA.vx ?? 0) - dx * force;
            nodeA.vy = (nodeA.vy ?? 0) - dy * force;
            nodeB.vx = (nodeB.vx ?? 0) + dx * force;
            nodeB.vy = (nodeB.vy ?? 0) + dy * force;
          }
        }
      }
    }

    // 3. Spring Attraction (용수철 인력)
    const springStrength = 0.055;
    for (const pEdge of this.physicsEdges) {
      const nodeA = pEdge.sourceNode;
      const nodeB = pEdge.targetNode;
      
      if (nodeA.layoutHidden || nodeB.layoutHidden) {
        continue;
      }

      const ax = nodeA.worldX ?? 0;
      const ay = nodeA.worldY ?? 0;
      const bx = nodeB.worldX ?? 0;
      const by = nodeB.worldY ?? 0;

      const dx = bx - ax;
      const dy = by - ay;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;

      const weight = pEdge.weight;
      // 용수철 평형 거리 대폭 완화 (가중치가 높아도 최소 약 140px, 일반 200px 이상 유지되도록 설계)
      const targetDist = 220 / (weight * 0.4 + 0.6); 
      
      const force = ((dist - targetDist) / dist) * springStrength * (weight * 0.3 + 0.5) * softStartScale;
      
      // 센터 노드는 당겨지지 않고 자식 노드만 중심 방향으로 끌려오게 제한
      if (nodeA.id !== this.centerNode?.id) {
        nodeA.vx! += dx * force;
        nodeA.vy! += dy * force;
      }
      if (nodeB.id !== this.centerNode?.id) {
        nodeB.vx! -= dx * force;
        nodeB.vy! -= dy * force;
      }
    }

    // 4. Orbital Layer Gravity (오빗 뷰 기반 동심원 궤도 복원력)
    // 노드를 그냥 (0,0)으로 당기지 않고, 노드의 계층 깊이(orbitIndex)에 맞는 궤도 반경 대역으로 끌려가도록 물리력 부여
    const orbitalGravity = 0.016; // 궤도 대역 복원 강도
    for (const node of nodes) {
      if (node.layoutHidden || node.id === this.centerNode?.id || node.id === 'root-HCHPS') continue;

      const ax = node.worldX ?? 0;
      const ay = node.worldY ?? 0;
      const distToCenter = Math.sqrt(ax * ax + ay * ay) || 0.1;
      
      // 오빗 반경 대역 계산 (1층=145px, 2층=335px, 3층=525px 등 비선형 반경 분산 적용)
      let targetR = 0;
      const oIdx = node.orbitIndex ?? 1;
      if (oIdx === 1) {
        targetR = 145;
      } else if (oIdx > 1) {
        targetR = 145 + (oIdx - 1) * 190;
      }
      const rDiff = distToCenter - targetR;

      // 💡 센트럴리티(degree, 연결선 개수)가 높은 노드일수록 하위 노드들의 인력합에 끌려가지 않도록
      // 궤도 복원력을 차수에 비례하여 동적으로 대폭 강화합니다.
      const degree = node.degree ?? 0;
      const adaptiveGravity = orbitalGravity * (1.0 + degree * 0.45) * softStartScale;

      // 중앙 방향으로의 단위 벡터 (ax/distToCenter, ay/distToCenter)에 오차와 복원 강도를 곱하여 속도에 반영
      node.vx! -= (ax / distToCenter) * rDiff * adaptiveGravity;
      node.vy! -= (ay / distToCenter) * rDiff * adaptiveGravity;
    }

    // 5. Apply velocities with damping & jitter clamping
    // 댐핑(마찰)을 0.75로 완화하여 노드들이 척력을 받아 충분히 펼쳐지도록 튜닝하고, maxSpeed를 8.0으로 완화
    const damping = 0.75; 
    const maxSpeed = 8.0;  
    
    for (const node of nodes) {
      if (node.layoutHidden) continue;
      
      if (node.id === this.centerNode?.id || node.id === 'root-HCHPS') {
        node.worldX = 0;
        node.worldY = 0;
        node.targetWorldX = 0;
        node.targetWorldY = 0;
        node.vx = 0;
        node.vy = 0;
        continue;
      }

      const isFixed = node.fixedX !== undefined && node.fixedX !== null && 
                      node.fixedY !== undefined && node.fixedY !== null;
      const isDraggedNode = this.draggedNode?.id === node.id;
      
      if (isFixed || isDraggedNode) {
        node.vx = 0;
        node.vy = 0;
        continue;
      }

      // 속도 감속 및 클램핑 적용
      let vx = (node.vx ?? 0) * damping;
      let vy = (node.vy ?? 0) * damping;
      
      vx = Math.max(-maxSpeed, Math.min(maxSpeed, vx));
      vy = Math.max(-maxSpeed, Math.min(maxSpeed, vy));

      // 미세 진동 방지 데드존 (Dead-zone) 필터
      const speedSq = vx * vx + vy * vy;
      if (speedSq < 0.012) {
        node.vx = 0;
        node.vy = 0;
      } else {
        node.vx = vx;
        node.vy = vy;
        
        const dx = vx * this.physicsAlpha;
        const dy = vy * this.physicsAlpha;

        node.worldX = (node.worldX ?? 0) + dx;
        node.worldY = (node.worldY ?? 0) + dy;
      }
      
      if (node.orbitIndex === 1) {
        // 1차 카테고리 노드는 중심으로부터 항상 일정한 궤도 반경을 유지하도록 강제 투영 보정 (각도는 유지)
        const currentAngle = Math.atan2(node.worldY!, node.worldX!);
        const R = OntologyLayout.getOrbitRadius(1);
        node.worldX = R * Math.cos(currentAngle) * 1.3; // ELLIPSE_RATIO = 1.3
        node.worldY = R * Math.sin(currentAngle);
      }
      
      node.targetWorldX = node.worldX;
      node.targetWorldY = node.worldY;
    }

    // Early Sleep 판정: 모든 노드가 실질적으로 정지했는지 검사
    let maxSpeedFound = 0;
    for (const node of nodes) {
      if (node.layoutHidden || node.id === this.centerNode?.id || node.id === 'root-HCHPS') continue;
      const isFixed = node.fixedX !== undefined && node.fixedX !== null && 
                      node.fixedY !== undefined && node.fixedY !== null;
      if (isFixed) continue;
      const sp = Math.sqrt((node.vx ?? 0) * (node.vx ?? 0) + (node.vy ?? 0) * (node.vy ?? 0));
      if (sp > maxSpeedFound) {
        maxSpeedFound = sp;
      }
    }
    if (maxSpeedFound < 0.15) { // 정지 수렴 한계치를 0.15로 조율하여 진동 방지
      this.physicsAlpha = 0.0;
    } else {
      // 냉각 비율(alpha decay)을 0.95로 현실화하여 충분한 확산 시간을 확보
      this.physicsAlpha *= 0.95;
    }
    
    this.layoutWorldGeometryDirty = true;
    return true;
  }

  tick(): boolean {
    let isDirty = false;

    // LERP 상태나 카메라 모션이 존재하는지 확인
    const isCameraMoving = Math.abs(this.targetOffsetX - this.cameraOffsetX) > 0.5 || 
                           Math.abs(this.targetOffsetY - this.cameraOffsetY) > 0.5 || 
                           Math.abs(this.targetZoom - this.zoom) > 0.005;

    let isAnyNodeMoving = false;
    for (const node of this.nodes) {
      if (node.targetWorldX !== undefined && node.targetWorldY !== undefined) {
        const dx = node.targetWorldX - (node.worldX ?? 0);
        const dy = node.targetWorldY - (node.worldY ?? 0);
        if (Math.abs(dx) > 0.25 || Math.abs(dy) > 0.25) {
          isAnyNodeMoving = true;
          break;
        }
      }
    }

    const isInteractive = this.isDragging || isCameraMoving || isAnyNodeMoving;

    // 만약 사용자가 조작 중이거나(isInteractive) 물리 연산이 덜 끝났다면(physicsAlpha > 0.005) 깨어있는다.
    if (isInteractive) {
      this.idleFramesCount = 0;
      this.physicsFrameCount = 0;
      this.physicsAlpha = 1.0;
    } else {
      this.idleFramesCount++;
      this.physicsFrameCount++;
      if (this.physicsFrameCount >= 120) {
        this.physicsAlpha = 0;
      }
    }

    // 💡 약 1.5초(90프레임)간 완전한 유휴 상태가 지속되면 궤도 공전을 일시정지(Sleep)하여 
    // 프레임 레이트 렌더링 호출을 0으로 차단하고 유휴 CPU 부하를 0.1% 이하로 낮춥니다.
    if (this.idleFramesCount > 90) {
      if (this.needsRedraw) {
        this.needsRedraw = false;
        return true; // 마지막 한 번 더 그리고 정지
      }
      return false; 
    }

    // 4차 최적화: 물리 시뮬레이션 프레임 연동 및 더티 마킹 (Spatial Hash Grid 기반)
    const t0 = performance.now();
    const ranPhysics = this.runPhysicsTick();
    const t1 = performance.now();
    PerformanceProfiler.getInstance().recordPhysics(ranPhysics ? (t1 - t0) : 0);

    if (ranPhysics) {
      isDirty = true;
    }

    // Camera interpolation
    if (Math.abs(this.targetOffsetX - this.cameraOffsetX) > 0.5 || 
        Math.abs(this.targetOffsetY - this.cameraOffsetY) > 0.5 || 
        Math.abs(this.targetZoom - this.zoom) > 0.005) {
      this.cameraOffsetX += (this.targetOffsetX - this.cameraOffsetX) * LERP_SPEED;
      this.cameraOffsetY += (this.targetOffsetY - this.cameraOffsetY) * LERP_SPEED;
      this.zoom += (this.targetZoom - this.zoom) * LERP_SPEED;
      isDirty = true;
    }

    // Node targetWorldX/Y LERP Morphing
    let nodesMoving = false;
    for (const node of this.nodes) {
      if (node.targetWorldX !== undefined && node.targetWorldY !== undefined) {
        if (node.worldX === undefined || isNaN(node.worldX!)) {
          node.worldX = node.targetWorldX;
        }
        if (node.worldY === undefined || isNaN(node.worldY!)) {
          node.worldY = node.targetWorldY;
        }

        const currentX = node.worldX ?? 0;
        const currentY = node.worldY ?? 0;
        const dx = node.targetWorldX - currentX;
        const dy = node.targetWorldY - currentY;
        
        // 💡 첫 프레임이나 공전 활성화 중에는 즉시 순간이동하고, 그 외에는 LERP 감속 모션으로 이동시킵니다.
        if (this.isFirstFrame || this.isOrbiting) {
          node.worldX = node.targetWorldX;
          node.worldY = node.targetWorldY;
        } else if (Math.abs(dx) > 0.25 || Math.abs(dy) > 0.25) {
          // 첫 25프레임 동안은 조금 더 신속히 감쇠 수렴하도록 빠른 LERP(0.20)를 제공하고, 이후에는 LERP_SPEED(0.08)로 소프트 모션을 유도합니다.
          const currentLerp = this.frameCount < 25 ? 0.20 : LERP_SPEED;
          node.worldX = currentX + dx * currentLerp;
          node.worldY = currentY + dy * currentLerp;
          nodesMoving = true;
        } else {
          node.worldX = node.targetWorldX;
          node.worldY = node.targetWorldY;
        }
      }
    }
    if (this.isFirstFrame) {
      this.isFirstFrame = false;
    }
    this.frameCount++;
    this.hasNodeMoved = nodesMoving;
    if (nodesMoving) {
      isDirty = true;
    }

    // Update orbital angles if enabled
    if (this.isOrbiting) {
      for (const node of this.nodes) {
        if (node.orbitIndex === 0) continue;
        node.orbitAngle += node.orbitSpeed;
      }
      isDirty = true;
    }
    
    if (this.needsRedraw) {
      isDirty = true;
      this.needsRedraw = false;
    }

    // 활성 노드/호버 펄스 애니메이션 소거에 따른 강제 리드로잉 조건 제거

    return isDirty;
  }



  // ============ Compute Positions ============

  private computePositions(canvasW: number, canvasH: number, activeLayers?: Set<number>): void {
    const isCameraMoving = Math.abs(this.targetOffsetX - this.cameraOffsetX) > 0.5 || 
                           Math.abs(this.targetOffsetY - this.cameraOffsetY) > 0.5 ||
                           Math.abs(this.targetZoom - this.zoom) > 0.005;
    const isInteractive = this.isDragging || isCameraMoving || this.physicsFrameCount < 120;

    const activeLayersKey = activeLayers ? Array.from(activeLayers).sort().join(',') : '';
    const collapsedNodesKey = Array.from(this.collapsedNodeIds).sort().join(',');

    if (this.lastLayoutInputs && this.lastLayoutInputs.activeLayersKey !== activeLayersKey) {
      this.isTopologyDirty = true;
    }

    const canSkip = !this.layoutWorldGeometryDirty &&
                    !isCameraMoving &&
                    !this.isDragging &&
                    !this.hasNodeMoved &&
                    !this.isOrbiting && // 💡 공전 중일 때는 2D 투영 좌표 갱신 스킵을 차단하여 60 FPS 회전을 지속시킵니다.
                    this.physicsFrameCount >= 120 && // 물리 수렴 중에는 스킵하지 않음
                    this.lastLayoutInputs &&
                    this.lastLayoutInputs.canvasW === canvasW &&
                    this.lastLayoutInputs.canvasH === canvasH &&
                    this.lastLayoutInputs.cameraOffsetX === this.cameraOffsetX &&
                    this.lastLayoutInputs.cameraOffsetY === this.cameraOffsetY &&
                    this.lastLayoutInputs.zoom === this.zoom &&
                    this.lastLayoutInputs.activeLayersKey === activeLayersKey &&
                    this.lastLayoutInputs.collapsedNodesKey === collapsedNodesKey &&
                    this.lastLayoutInputs.isInteractive === isInteractive;

    if (canSkip) {
      // Viewport is stationary, world geometry is clean, and the last run was already non-interactive.
      // We can skip the entire coordinate projection and collision check loop safely.
      PerformanceProfiler.getInstance().recordLayout(0);
      return;
    }

    const forceRecompute = this.isTopologyDirty;

    const tL0 = performance.now();
    OntologyLayout.computePositions(
      this.nodes,
      this.nodeMap,
      this.edges,
      canvasW,
      canvasH,
      this.cameraOffsetX,
      this.cameraOffsetY,
      this.zoom,
      this.collapsedNodeIds,
      activeLayers,
      isInteractive,
      forceRecompute,
      this.isOrbiting,
      this.isDragging
    );
    const tL1 = performance.now();
    PerformanceProfiler.getInstance().recordLayout(tL1 - tL0);
    this.layoutWorldGeometryDirty = false;
    this.isTopologyDirty = false;

    // Cache layout inputs
    this.lastLayoutInputs = {
      canvasW,
      canvasH,
      cameraOffsetX: this.cameraOffsetX,
      cameraOffsetY: this.cameraOffsetY,
      zoom: this.zoom,
      activeLayersKey,
      collapsedNodesKey,
      isInteractive
    };

    // Cache pre-sorted nodes array to avoid 60 FPS sorting cost in Renderer
    const activeNodeId = this.activeNode?.id || null;
    const needsSort = activeNodeId !== this.lastSortedActiveNodeId || this.sortedNodes.length !== this.nodes.length;
    
    if (needsSort) {
      this.sortedNodes = [...this.nodes];
      this.sortedNodes.sort((a, b) => {
        if (a.id === activeNodeId) return 1;
        if (b.id === activeNodeId) return -1;

        const depthA = a.renderZ || 0;
        const depthB = b.renderZ || 0;
        if (Math.abs(depthB - depthA) > 1) {
          return depthB - depthA;
        }
        return (a.orbitIndex || 0) - (b.orbitIndex || 0);
      });
      this.lastSortedActiveNodeId = activeNodeId;
    }

    // Apply pending camera tracking instantly (after positions are known)
    // 💡 초기 진입 시 전체 온톨로지를 화면 중앙에 놓거나, 명시적으로 pendingCameraTargetId가 지정된 1회성 스냅의 경우에만 작동합니다.
    const trackingTargetId = this.pendingCameraTargetId
      ? this.pendingCameraTargetId
      : (this.isInitialCameraSnap && this.centerNode)
        ? this.centerNode.id
        : null;

    if (trackingTargetId && !this.isDragging) {
      const target = this.nodeMap.get(trackingTargetId);
      if (target && typeof target.worldX === 'number' && !isNaN(target.worldX) && 
          typeof target.worldY === 'number' && !isNaN(target.worldY)) {
        
        // 2D 평면 변환을 반영하여 스크린 상 노드의 실제 위치로 카메라 스냅 보정
        const snapX = -(target.worldX * this.zoom);
        const snapY = -(target.worldY * this.zoom);
        
        if (!isNaN(snapX) && !isNaN(snapY)) {
          this.targetOffsetX = snapX;
          this.targetOffsetY = snapY;
          
          if (this.isInitialCameraSnap && canvasW > 0 && canvasH > 0) {
            this.cameraOffsetX = snapX;
            this.cameraOffsetY = snapY;
            this.isInitialCameraSnap = false;
            
            // 카메라가 0,0에서 snapX,snapY로 점프했으므로 방금 계산했던 구좌표 파기 후 현재 좌표로 재계산
            // (이때 isInteractive는 false로 snap 위치에서 충돌 해결 유도)
            OntologyLayout.computePositions(
              this.nodes,
              this.nodeMap,
              this.edges,
              canvasW,
              canvasH,
              this.cameraOffsetX,
              this.cameraOffsetY,
              this.zoom,
              this.collapsedNodeIds,
              activeLayers,
              false, // force non-interactive for final snap collision resolution
              this.layoutWorldGeometryDirty,
              this.isOrbiting,
              this.isDragging
            );

            // sortedNodes 재정렬도 강제 적용
            this.sortedNodes = [...this.nodes];
            this.sortedNodes.sort((a, b) => {
              if (a.id === activeNodeId) return 1;
              if (b.id === activeNodeId) return -1;
              const depthA = a.renderZ || 0;
              const depthB = b.renderZ || 0;
              if (Math.abs(depthB - depthA) > 1) return depthB - depthA;
              return (a.orbitIndex || 0) - (b.orbitIndex || 0);
            });
            this.lastSortedActiveNodeId = activeNodeId;
          }
        }
      }
      this.pendingCameraTargetId = null;
    }
  }

  // ============ Render ============

  render(ctx: CanvasRenderingContext2D, width: number, height: number, activeLayers?: Set<number>): void {
    this.canvasW = width;
    this.canvasH = height;
    this.computePositions(width, height, activeLayers);

    const isCameraMoving = Math.abs(this.targetOffsetX - this.cameraOffsetX) > 0.5 || 
                           Math.abs(this.targetOffsetY - this.cameraOffsetY) > 0.5 ||
                           Math.abs(this.targetZoom - this.zoom) > 0.005;
    const isInteractive = this.isDragging || isCameraMoving;

    OntologyRenderer.render({
      ctx,
      canvasW: width,
      canvasH: height,
      zoom: this.zoom,
      orbitRadii: this.orbitRadii,
      nodes: this.nodes,
      edges: this.edges,
      nodeMap: this.nodeMap,
      activeNodeId: this.activeNode?.id || null,
      hoveredNodeId: this.hoveredNode?.id || null,
      activeTreeSet: this.getActiveTreeSet(),
      centerNode: this.centerNode,
      sortedNodesBuffer: this.sortedNodes,
      collapsedNodeIds: this.collapsedNodeIds,
      cameraOffsetX: this.cameraOffsetX,
      cameraOffsetY: this.cameraOffsetY,
      activeLayers: activeLayers,
      layoutMode: 'mindmap',
      isInteractive: isInteractive,
      isOrbiting: this.isOrbiting,
      centralitySortedNodes: this.centralitySortedNodes
    });
  }

  public getActiveTreeSet(): Set<string> {
    const rootId = this.activeNode?.id;
    if (!rootId) {
      if (this.activeTreeSetCache.size > 0) this.activeTreeSetCache.clear();
      this.lastActiveNodeIdForTree = null;
      return this.activeTreeSetCache;
    }
    
    // activeNodeId가 변경되었거나, 위상(Topology)이 변경되었을 때만 트리 탐색 재연산
    if (this.lastActiveNodeIdForTree !== rootId || this.topologyDirty) {
      this.activeTreeSetCache = OntologyNetwork.getActiveTreeSet(rootId, this.nodeMap);
      this.lastActiveNodeIdForTree = rootId;
      this.topologyDirty = false;
    }
    
    return this.activeTreeSetCache;
  }
  // ============ Interaction ============

  hitTest(mx: number, my: number): OrbitalNode | null {
    let closest: OrbitalNode | null = null;
    let minDistSq = Infinity;

    for (const node of this.nodes) {
      if (node.layoutHidden) continue;

      const rx = node.renderX;
      const ry = node.renderY;
      // 화면 밖 노드는 마우스 충돌 연산에서 완전 배제 (Frustum Culling)
      if (rx < -15 || rx > this.canvasW + 15 || ry < -15 || ry > this.canvasH + 15) {
        continue;
      }

      const dx = mx - rx;
      const dy = my - ry;
      const distSq = dx * dx + dy * dy;
      const hitRadius = node.nodeRadius * this.zoom * 0.6 + 12;
      const hitRadiusSq = hitRadius * hitRadius;
      if (distSq < hitRadiusSq && distSq < minDistSq) {
        minDistSq = distSq;
        closest = node;
      }
    }
    return closest;
  }

  handleClick(mx: number, my: number): void {
    this.wakeUp();
    if (this.hasDragged) {
      this.hasDragged = false;
      return;
    }

    const hit = this.hitTest(mx, my);
    if (hit) {
      // 1. 트리 계층 구조 가져오기 (레이아웃 엔진이 캐싱한 정확한 부모-자식 관계 파악)
      const treeChildrenMap = OntologyLayout.lastTreeChildrenMap;

      // 자식 노드가 있는지 확인
      const children = treeChildrenMap.get(hit.id) || [];
      const hasChildren = children.length > 0;

      // 1. 노드 선택 및 카메라 포커스 이동 (우선 처리)
      const isNewlyActivated = this.activeNode?.id !== hit.id;
      
      if (isNewlyActivated) {
         // 최초 클릭 시: 카테고리와 함께 하위 카테고리가 모두 활성화되며 중심으로 이동
         this.activeNode = hit;
         this.previousActiveNodeId = hit.id;
         
         // 💡 노드 클릭 시 뷰포트를 해당 노드로 부드럽게 패닝 스냅
         this.pendingCameraTargetId = hit.id;
         
         const getDescendants = (nodeId: string): string[] => {
            const desc: string[] = [];
            const q = [nodeId];
            while (q.length > 0) {
               const curr = q.shift()!;
               const kids = treeChildrenMap.get(curr) || [];
               for (const kid of kids) {
                  desc.push(kid);
                  q.push(kid);
               }
            }
            return desc;
         };

         if (hit.orbitIndex === 1) {
            // 1차 카테고리 노드를 클릭한 경우:
            // 기존에 열려있던 다른 1차 카테고리 하위는 모두 접고, 본 카테고리 하위만 전개
            this.collapseAll();
            this.collapsedNodeIds.delete(hit.id);
            const descendants = getDescendants(hit.id);
            descendants.forEach(d => this.collapsedNodeIds.delete(d));
         } else if (hit.orbitIndex === 0) {
            // 최상위 루트 노드를 클릭한 경우: 모두 접힌 디폴트 상태로 되돌림
            this.collapseAll();
         } else {
            // 2차 카테고리 이상 노드를 클릭한 경우:
            // 기존 전개 상태를 유지하며 클릭한 노드 및 자손 접힘만 해제
            this.collapsedNodeIds.delete(hit.id);
            const descendants = getDescendants(hit.id);
            descendants.forEach(d => this.collapsedNodeIds.delete(d));
         }
         this.topologyDirty = true;
         this.isTopologyDirty = true;
      } else {
         // 2. 이미 활성화(선택)된 노드를 "다시 한 번" 클릭했을 때 동작
         // 수동 접기/펼치기 기능은 전면 삭제되었습니다.
         if (!hasChildren) {
            // 자식이 없는 리프 노드를 재클릭하면 포커스 해제 (최상위 루트 노드로 돌아감)
            this.activeNode = this.centerNode;
            this.previousActiveNodeId = this.centerNode?.id || null;
            this.collapseAll();
            this.topologyDirty = true;
            this.isTopologyDirty = true;
         }
      }
      
      // 노드 단순 클릭 시에는 카메라 이동 스냅 및 기하학 각도 리셋을 수행하지 않습니다.
    } else {
      // 💡 바탕 배경(빈 곳) 클릭 시 활성 노드 선택을 해제하고, 모두 접힌 디폴트 상태로 복원합니다.
      this.activeNode = null;
      this.previousActiveNodeId = null;
      this.collapseAll();
      this.topologyDirty = true;
      this.isTopologyDirty = true;
    }
    this.needsRedraw = true;
    this.callbacks.onActiveNodeChange?.(this.activeNode);
  }

  expandAll(): void {
    this.collapsedNodeIds.clear();
    this.layoutWorldGeometryDirty = true;
    this.topologyDirty = true;
    this.isTopologyDirty = true;
    this.needsRedraw = true;
  }

  collapseAll(): void {
    if (!this.centerNode) return;
    this.collapsedNodeIds.clear();
    
    // 1차 카테고리들(centerChildren)을 모두 찾아 그 녀석들을 닫는다. (2차, 3차 숨김)
    const treeChildrenMap = OntologyLayout.lastTreeChildrenMap;
    const centerChildren = treeChildrenMap.get(this.centerNode.id) || [];
    
    for (const childId of centerChildren) {
       this.collapsedNodeIds.add(childId);
       
       // 모든 자손들도 다 닫힘 상태로 세팅 (다시 열 때 서브트리가 닫혀있도록)
       const q = [childId];
       while(q.length > 0) {
         const curr = q.shift()!;
         this.collapsedNodeIds.add(curr);
         for (const kid of treeChildrenMap.get(curr) || []) {
            q.push(kid);
         }
       }
    }
    this.layoutWorldGeometryDirty = true;
    this.topologyDirty = true;
    this.isTopologyDirty = true;
    this.needsRedraw = true;
  }

  handleDoubleClick(mx: number, my: number): void {
    this.wakeUp();
    const hit = this.hitTest(mx, my);
    if (hit) {
      this.callbacks.onNodeDoubleClick?.(hit);
    } else {
      // 💡 빈 바탕 더블클릭 시 줌 1.0배율 및 Tasks 노드(중앙) 위치로 카메라 뷰포트를 부드럽게 홈 리셋시킵니다.
      this.targetZoom = 1.0;
      if (this.centerNode) {
        this.pendingCameraTargetId = this.centerNode.id;
      } else {
        this.targetOffsetX = 0;
        this.targetOffsetY = 0;
      }
      this.needsRedraw = true;
    }
  }

  handleHover(mx: number, my: number): void {
    this.wakeUp();
    const hit = this.hitTest(mx, my);
    if (hit?.id !== this.hoveredNode?.id) {
      this.hoveredNode = hit;
      this.needsRedraw = true;
      this.callbacks.onHoveredNodeChange?.(hit);
    }
  }

  handleWheel(delta: number, mx?: number, my?: number): void {
    this.wakeUp();
    const oldZoom = this.zoom;
    const zoomFactor = Math.exp(-delta * 0.001);
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom * zoomFactor));
    
    this.zoom = newZoom;
    this.targetZoom = newZoom;
    this.needsRedraw = true;

    // 피봇(마우스 커서 또는 화면 중심) 기준 줌 좌표 역산 보정 (항상 작동)
    const hasPivot = mx !== undefined && my !== undefined && this.canvasW > 0 && this.canvasH > 0;
    if (hasPivot) {
      const cx = this.canvasW / 2;
      const cy = this.canvasH / 2;
      
      const px = (mx - cx - this.cameraOffsetX) / oldZoom;
      const py = (my - cy - this.cameraOffsetY) / oldZoom;

      const nextOffsetX = mx - cx - px * newZoom;
      const nextOffsetY = my - cy - py * newZoom;

      this.cameraOffsetX = nextOffsetX;
      this.cameraOffsetY = nextOffsetY;
      this.targetOffsetX = nextOffsetX;
      this.targetOffsetY = nextOffsetY;
    } else {
      this.cameraOffsetX = this.cameraOffsetX * (newZoom / oldZoom);
      this.cameraOffsetY = this.cameraOffsetY * (newZoom / oldZoom);
      this.targetOffsetX = this.cameraOffsetX;
      this.targetOffsetY = this.cameraOffsetY;
    }
  }

  // ── Interaction ──

  handleDragStart(nx: number, ny: number, _isShiftKey: boolean = false): void {
    this.wakeUp();
    if (_isShiftKey) {
      // reserved for sub-graph moving
    }
    this.isDragging = true;
    this.hasDragged = false;
    this.dragStartX = nx;
    this.dragStartY = ny;
    this.lastDragX = nx;
    this.lastDragY = ny;
    this.draggedNode = null;
    this.draggedSubTree = [];

    // 드래그 시작

    let closestId = null;
    let minDist = Infinity;
    for (const node of this.nodes) {
      if (node.id === 'root-HCHPS') continue;
      const dx = nx - node.renderX;
      const dy = ny - node.renderY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist && dist <= node.nodeRadius * this.zoom + 15) {
        minDist = dist;
        closestId = node.id;
      }
    }

    if (closestId) {
      this.draggedNode = this.nodeMap.get(closestId)!;
    }
  }

  handleDragMove(nx: number, ny: number): void {
    this.wakeUp();
    if (!this.isDragging) return;

    if (Math.abs(nx - this.dragStartX) > 5 || Math.abs(ny - this.dragStartY) > 5) {
      this.hasDragged = true;
      this.needsRedraw = true;
    }

    if (this.draggedNode) {
      // 2D 평면 마우스 드래그 역산
      const cx = this.canvasW / 2;
      const cy = this.canvasH / 2;
      const worldX = (nx - cx - this.cameraOffsetX) / this.zoom;
      const worldY = (ny - cy - this.cameraOffsetY) / this.zoom;
      
      this.draggedNode.fixedX = worldX;
      this.draggedNode.fixedY = worldY;
      this.draggedNode.worldX = worldX;
      this.draggedNode.worldY = worldY;

      // 하위 그룹(Shift 키 동반 드래그 등) 동반 이동 시각화
      for (const item of this.draggedSubTree) {
        const childWX = worldX + item.dx0;
        const childWY = worldY + item.dy0;
        item.node.fixedX = childWX;
        item.node.fixedY = childWY;
        item.node.worldX = childWX;
        item.node.worldY = childWY;
      }

      // 4차 최적화: 드래그 이동 발생 시 물리 엔진을 깨움 (Sleep -> Wake Up)
      this.physicsAlpha = 1.0;
      this.layoutWorldGeometryDirty = true;
    } else {
      // 카메라 패닝 (orbit 뷰 전용)
      const dx = nx - this.lastDragX;
      const dy = ny - this.lastDragY;
      
      this.cameraOffsetX += dx;
      this.cameraOffsetY += dy;
      this.targetOffsetX = this.cameraOffsetX; // 수동 드래그 시 카메라 타겟 덮어쓰기
      this.targetOffsetY = this.cameraOffsetY;
    }

    this.needsRedraw = true;
    this.lastDragX = nx;
    this.lastDragY = ny;
  }

  handleDragEnd(): void {
    this.wakeUp();
    this.isDragging = false;
    this.draggedNode = null;
    this.draggedSubTree = [];
    this.needsRedraw = true;
  }

  // ============ Queries ============

  isConnected(nodeId: string, targetId: string): boolean {
    return this.connectionSet.has(nodeId + '|||' + targetId);
  }

  getConnectedEdges(nodeId: string): Array<{ edge: OntologyEdge; otherNode: OrbitalNode }> {
    const results: Array<{ edge: OntologyEdge; otherNode: OrbitalNode }> = [];
    for (const edge of this.edges) {
      let otherId: string | null = null;
      if (edge.source === nodeId) otherId = edge.target;
      else if (edge.target === nodeId) otherId = edge.source;
      if (otherId) {
        const otherNode = this.nodeMap.get(otherId);
        if (otherNode) results.push({ edge, otherNode });
      }
    }
    return results.sort((a, b) => Math.abs(b.edge.weight) - Math.abs(a.edge.weight));
  }

  getNodeById(id: string): OrbitalNode | undefined {
    return this.nodeMap.get(id);
  }

  // ============ Helpers ============

  private colorWithAlpha(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  private lightenColor(hex: string, amount: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lr = Math.round(r + (255 - r) * amount);
    const lg = Math.round(g + (255 - g) * amount);
    const lb = Math.round(b + (255 - b) * amount);
    return `rgb(${lr},${lg},${lb})`;
  }

  destroy(): void {
    // Release node HTMLCanvasElement template caches (GC)
    for (const node of this.nodes) {
      if (node._cachedTemplate) {
        node._cachedTemplate.width = 0;
        node._cachedTemplate.height = 0;
        node._cachedTemplate = undefined;
      }
      node._cachedWords = undefined;
      node._cachedLines = undefined;
      node._cachedInteractiveText = undefined;
    }

    this.nodes = [];
    this.edges = [];
    this.centralitySortedNodes = [];
    this.centerNode = null;
    this.activeNode = null;
    this.hoveredNode = null;
    this.previousActiveNodeId = null;
    this.pendingCameraTargetId = null;

    this.nodeMap.clear();
    this.connectionSet.clear();
    this.spatialGrid.clear();
    this.cellArrayPool.length = 0;
    this.physicsEdges = [];
    this.sortedNodes = [];
    this.callbacks = {};

    // Clear static renderer cache
    OntologyRenderer.clearTextBoxPool();
  }
}
