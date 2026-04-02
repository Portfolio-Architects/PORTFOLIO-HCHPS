/**
 * Ontology Canvas Engine — Layer 3
 * Pure Canvas 2D Orbital Rendering (No React dependency)
 */

import {
  OntologyNode, OntologyEdge, OntologyGraph, OrbitalNode,
  GROUP_COLORS, OntologyGroup, EdgeType,
} from './ontology.types';

// ============ Constants ============

const NUM_ORBITS = 8;
const ELLIPSE_RATIO = 1.3;  // tilted 2D ellipse
const MIN_NODE_R = 3;
const MAX_NODE_R = 24;
const ORBIT_SPEED_BASE = 0.00025; // 0.0004에서 속도 약간 감소
const LERP_SPEED = 0.12;  // faster camera response
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3.0;
const MIN_TILT = 0.3;
const MAX_TILT = 1.0;
const CULL_MARGIN = 80;  // px margin for frustum culling

// Force relaxation constants
const CHARGE_STRENGTH = -80;    // repulsion (milder to stay on orbit)
const LINK_STRENGTH = 0.01;     // edge spring (gentle)
const DAMPING = 0.80;           // velocity damping per tick
const FORCE_ALPHA = 0.2;        // force intensity
const MAX_VELOCITY = 2.0;       // max velocity cap
const FORCE_WARMUP_TICKS = 150; // freeze after this many ticks

// ============ Callbacks ============

export interface EngineCallbacks {
  onActiveNodeChange?: (node: OrbitalNode | null) => void;
  onHoveredNodeChange?: (node: OrbitalNode | null) => void;
  onNodeReparent?: (nodeId: string, newParentId: string | undefined, newOrbitIndex: number) => void;
}

// ============ Engine Class ============

export class OntologyCanvasEngine {
  nodes: OrbitalNode[] = [];
  edges: OntologyEdge[] = [];
  centerNode: OrbitalNode | null = null;
  activeNode: OrbitalNode | null = null;
  hoveredNode: OrbitalNode | null = null;

  // Camera
  zoom = 1;
  cameraTilt = 0.6;  // tilted 2D
  cameraOffsetX = 0;
  cameraOffsetY = 0;
  targetOffsetX = 0;
  targetOffsetY = 0;

  // Physics / Interaction
  isOrbiting = false;
  private isDragging = false;
  private hasDragged = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private lastDragX = 0;
  private lastDragY = 0;
  private dragStartTilt = 0;
  private draggedNode: OrbitalNode | null = null;
  previousActiveNodeId: string | null = null;
  private pendingCameraTargetId: string | null = null;

  // Stats
  nodeCount = 0;
  edgeCount = 0;

  // Callbacks
  callbacks: EngineCallbacks = {};

  // Precomputed
  private orbitRadii: number[] = [];
  private nodeMap = new Map<string, OrbitalNode>();
  private connectionSet = new Set<string>();  // 'id1|||id2' for O(1) lookup

  // Reusable sort buffers (avoid per-frame allocation)
  private sortedNodes: OrbitalNode[] = [];
  private canvasW = 0;
  private canvasH = 0;

  // Force relaxation state
  private velocityX = new Map<string, number>();
  private velocityY = new Map<string, number>();
  private forceOffsetX = new Map<string, number>();
  private forceOffsetY = new Map<string, number>();
  private forceSettled = false;
  private forceTickCount = 0;

    // ============ Init ============
  
    init(graph: OntologyGraph, callbacks?: EngineCallbacks, prevNodes?: OrbitalNode[]): void {
      this.callbacks = callbacks || {};
      this.edges = graph.edges;
      this.nodeCount = graph.nodes.length;
      this.edgeCount = graph.edges.length;
  
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
    for (const edge of this.edges) {
      this.connectionSet.add(edge.source + '|||' + edge.target);
      this.connectionSet.add(edge.target + '|||' + edge.source);
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

    const nodesPerOrbit = Math.max(1, Math.ceil(otherNodes.length / NUM_ORBITS));

    // 이전 엔진 상태(현재 공전 각도)를 백업해두어, 색상 변경 등으로 재초기화될 때 노드가 시작 좌표로 순간이동하는 현상(Whiplash)을 방지합니다.
    const previousNodeMap = new Map<string, OrbitalNode>();
    if (prevNodes) {
      for (const n of prevNodes) {
        previousNodeMap.set(n.id, n);
      }
    } else {
      for (const n of this.nodes) {
        previousNodeMap.set(n.id, n);
      }
    }

    // Build orbital nodes
    this.nodes = [];
    this.nodeMap.clear();

    // Center node
    const centerPre = previousNodeMap.get(sorted[0].id);
    const centerAngle = (centerPre && typeof centerPre.orbitAngle === 'number' && !isNaN(centerPre.orbitAngle)) ? centerPre.orbitAngle : 0;
    const centerOrbital = this.makeOrbitalNode(sorted[0], 0, centerAngle, centerId, connectionMap);
    this.nodes.push(centerOrbital);
    this.centerNode = centerOrbital;
    this.nodeMap.set(centerOrbital.id, centerOrbital);
    // Categories (No parent) and Leaves (Has parent)
    const categoryNodes = otherNodes.filter(n => !n.parentId);
    const leafNodes = otherNodes.filter(n => n.parentId);

    // 1. Place Categories radially evenly, honoring their customOrbitIndex
    const categoriesByOrbit = new Map<number, OntologyNode[]>();
    categoryNodes.forEach(node => {
      const oIndex = node.customOrbitIndex ?? 1;
      if (!categoriesByOrbit.has(oIndex)) categoriesByOrbit.set(oIndex, []);
      categoriesByOrbit.get(oIndex)!.push(node);
    });

    categoriesByOrbit.forEach((catNodes, oIndex) => {
      const N = catNodes.length;
      // 고정된 오프셋을 주어 페이지 로드 시마다 동일하게 배치되도록 하여 기존 자리를 유지하게 만듭니다.
      const randomRingOffset = 0; 
      catNodes.forEach((node, i) => {
        let angle = (2 * Math.PI * i / N) + randomRingOffset;
        
        // 이전 엔진 상태 백업이 있다면 카테고리 기둥도 각도를 복원해야 합니다! (NaN 오염 방지)
        const preData = previousNodeMap.get(node.id);
        if (preData && typeof preData.orbitAngle === 'number' && !isNaN(preData.orbitAngle)) {
          angle = preData.orbitAngle;
        }

        const orbital = this.makeOrbitalNode(node, oIndex, angle, centerId, connectionMap);
          
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
    
    while(queue.length > 0) {
      const parentId = queue.shift()!;
      const leaves = leavesByParent.get(parentId);
      if (!leaves) continue;

      const parent = this.nodeMap.get(parentId)!;

      // Group leaves by their assigned orbit
      const orbitGroups = new Map<number, OntologyNode[]>();
      leaves.forEach((node, idx) => {
        // If no custom orbit, auto-assign layer based on 3 nodes per layer
        const layer = Math.floor(idx / 3);
        const orbitIndex = node.customOrbitIndex ?? Math.min(NUM_ORBITS, 2 + layer);
        if (!orbitGroups.has(orbitIndex)) orbitGroups.set(orbitIndex, []);
        orbitGroups.get(orbitIndex)!.push(node);
      });

      // Spread each group in a fan (arc) around the parent's angle
      orbitGroups.forEach((groupNodes, oIndex) => {
        // 커스텀 정렬 순서 적용 (수동 설정된 순서 존중)
        groupNodes.sort((a, b) => {
          const orderA = a.customSortOrder ?? 0;
          const orderB = b.customSortOrder ?? 0;
          return orderA - orderB;
        });
        const N = groupNodes.length;
        // 기둥 카테고리(1번 궤도)는 중앙 뿌리 주변 360도 전체에 균등하게 퍼뜨린 상태로 시작합니다
        const isCenterParent = parent.orbitIndex === 0;
        // 깊은 궤도(2궤도 이상)일수록 자식들이 할당된 파이(각도) 영역을 넘지 않도록 좁은 부채꼴로 제한합니다.
        // 중심부 직속 자식의 경우 무작위 각도 배정을 폐기하고 고정된 0도부터 규칙적으로 배치하여 페이지 로드시 얽힘과 진형 붕괴를 완벽 차단합니다.
        const totalSpreadAngle = isCenterParent ? (Math.PI * 2) : Math.min(1.5, N * 0.225);
        const startAngle = isCenterParent ? 0 : parent.orbitAngle - (totalSpreadAngle / 2);
        const angleStep = N <= 1 ? 0 : totalSpreadAngle / (isCenterParent ? N : (N - 1));

        groupNodes.forEach((node, gIdx) => {
          let angle = N === 1 ? parent.orbitAngle : startAngle + (gIdx * angleStep);
          // 기존에 공전 중이던 위치(각도)가 있다면 그대로 유지시켜 화면 중심 재정렬로 인한 순간이동 애니메이션 차단 (NaN 오염 방지)
          const preData = previousNodeMap.get(node.id);
          if (preData && typeof preData.orbitAngle === 'number' && !isNaN(preData.orbitAngle)) {
            angle = preData.orbitAngle;
          }
          
          const orbital = this.makeOrbitalNode(node, oIndex, angle, centerId, connectionMap);
          
          
          
          
          
          // 자식 노드가 고유 지정 색상이 없다면, 부모의 지정 색상(customColor)을 물려받아 
          // 1차 카테고리를 색칠하면 하위 2, 3차 카테고리까지 색상이 자동 동기화(Cascade) 되도록 처리
          if (!orbital.customColor && parent.customColor) {
            orbital.customColor = parent.customColor;
          }
          
          // 부모가 공전하지 않는 '중앙 중심 노드(태양)'일 경우, 부모의 0.0 속도를 모방하면 평생 멈춰버리게 됩니다!
          // 이때는 본인(orbital)이 스스로 계산한 고유의 공전 속도를 사용하고, 그 외의 자식들은 부모의 속도로 동기화합니다.
          orbital.orbitSpeed = parent.orbitIndex === 0 ? orbital.orbitSpeed : parent.orbitSpeed; 
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
        if (preData) {
          angle = preData.orbitAngle;
        }
        
        const oIndex = node.customOrbitIndex ?? 1;
        const orbital = this.makeOrbitalNode(node, oIndex, angle, centerId, connectionMap);
        this.nodes.push(orbital);
        this.nodeMap.set(orbital.id, orbital);
      });
    });

    // 3. Restore Active Node / Camera Tracking
    if (this.previousActiveNodeId && this.nodeMap.has(this.previousActiveNodeId)) {
      this.activeNode = this.nodeMap.get(this.previousActiveNodeId)!;
      // Tell render loop to pan camera to this node smoothly on next frame
      this.pendingCameraTargetId = this.previousActiveNodeId;
    } else {
      this.activeNode = this.centerNode;
      // Center camera naturally
      if (this.centerNode) {
        this.pendingCameraTargetId = this.centerNode.id;
      }
    }
    this.callbacks.onActiveNodeChange?.(this.activeNode);

    // Initialize force state (disabled for radial tech tree mode)
    this.velocityX.clear();
    this.velocityY.clear();
    this.forceOffsetX.clear();
    this.forceOffsetY.clear();
    this.forceSettled = false;
    this.forceTickCount = 0;
    for (const node of this.nodes) {
      this.velocityX.set(node.id, 0);
      this.velocityY.set(node.id, 0);
      this.forceOffsetX.set(node.id, 0);
      this.forceOffsetY.set(node.id, 0);
    }
  }

  private makeOrbitalNode(
    node: OntologyNode,
    orbitIndex: number,
    angle: number,
    centerId: string,
    connectionMap: Map<string, number>,
  ): OrbitalNode {
    const renderSize = node.renderSize ?? 0.5;
    // Scale node sizes down for dense graphs (100+ nodes)
    const densityScale = this.nodeCount > 60 ? Math.max(0.5, 1 - (this.nodeCount - 60) / 200) : 1;
    const maxR = MAX_NODE_R * densityScale;
    const minR = MIN_NODE_R;
    const nodeRadius = minR + renderSize * (maxR - minR);
    // 맵 전체가 꼬이는 현상을 방지하기 위해 모든 노드가 동일한 속도(단일 팽이처럼)로 공전하도록 통일합니다.
    // 기존의 무작위 속도 변수(speedVariation)가 파벌 간의 궤도 충돌을 유발했습니다.
    const finalOrbitSpeed = orbitIndex === 0 ? 0 : ORBIT_SPEED_BASE * 0.8;

    return {
      ...node,
      orbitIndex,
      orbitAngle: angle,
      orbitSpeed: finalOrbitSpeed,
      renderX: 0,
      renderY: 0,
      renderZ: 0,
      connectionToCenter: connectionMap.get(node.id) ?? 0,
      nodeRadius,
    };
  }

  // ============ Tick (per frame) ============

  tick(): void {
    // Camera interpolation
    this.cameraOffsetX += (this.targetOffsetX - this.cameraOffsetX) * LERP_SPEED;
    this.cameraOffsetY += (this.targetOffsetY - this.cameraOffsetY) * LERP_SPEED;

    // Update orbital angles if enabled
    if (this.isOrbiting) {
      for (const node of this.nodes) {
        if (node.orbitIndex === 0) continue;
        node.orbitAngle += node.orbitSpeed;
      }
    }

    // ── Angular Radial Physics ──
    // 노드들이 동일 궤도상에서 겹치지 않고 자연스럽게 밀어내며 부모-자식 간에는 방사형으로 정렬되도록 각도 물리엔진 적용
    if (this.forceTickCount < 600 || this.isDragging) {
      if (!this.isDragging) {
        this.forceTickCount++;
      }
      
      // 서서히 물리력을 줄여 완전히 안정화(Settled)되도록 합니다
      let alpha = 0.005;
      if (this.forceTickCount < 600) {
        const progress = Math.min(1, this.forceTickCount / 600);
        alpha = Math.max(0.005, 1 - Math.pow(progress, 0.5)); // 보다 일찍 안정화되지만 서서히 식게 만듦
      }
      
      if (this.isDragging) alpha = Math.max(alpha, 0.1);

      this.applyForces(alpha);
    }
  }

  private applyForces(alpha: number): void {
    const n = this.nodes.length;
    const forceQ = new Float64Array(n);

    const idxMap = new Map<string, number>();
    for (let i = 0; i < n; i++) idxMap.set(this.nodes[i].id, i);

    // 1. Angular Repulsion (Avoid node text/bubble overlap on same or adjacent orbits)
    for (let i = 0; i < n; i++) {
      const a = this.nodes[i];
      if (a.orbitIndex === 0 || a.fixedX !== undefined) continue;

      for (let j = i + 1; j < n; j++) {
        const b = this.nodes[j];
        if (b.orbitIndex === 0 || b.fixedX !== undefined) continue;

        const orbitDiff = Math.abs(a.orbitIndex - b.orbitIndex);
        // 밀어내기(텍스트 겹침 방지)는 오직 완벽하게 같은 궤도(동일 반경)에 있는 노드끼리만 적용합니다!
        // (부모가 자식을 밀어내거나, 다른 궤도 노드끼리 서로 간섭하여 진형을 붕괴시키는 현상을 원천 차단)
        if (orbitDiff > 0) continue; 

        let rawAngleDiff = a.orbitAngle - b.orbitAngle;
        let angleDiff = Math.atan2(Math.sin(rawAngleDiff), Math.cos(rawAngleDiff));

        const absDiff = Math.abs(angleDiff);

        let repulsionThreshold = 0.5;
        if (a.orbitIndex === 1) repulsionThreshold = Math.PI; // 기둥은 크게 밀어냄
        else if (a.orbitIndex === 2) repulsionThreshold = 0.8; // 2궤도는 넓은 반경
        else if (a.orbitIndex === 3) repulsionThreshold = 0.6; // 3궤도
        else repulsionThreshold = 0.4; // 4궤도 이상

        const isAlien = a.orbitIndex > 1 && b.orbitIndex > 1 && a.parentId !== b.parentId;
        if (isAlien) {
          // 타 파벌일 경우에도 최소한의 절대 반경은 강제 유지하여 '절대 겹치지 않게' 함
          repulsionThreshold *= 0.9;
        }

        if (absDiff === 0) angleDiff = (Math.random() - 0.5) * 0.05;

        // 임계값 이내로 다른 노드가 진입할 경우 (겹침 발생 위험 구간)
        if (absDiff < repulsionThreshold) {
          // 노드 겹침 방지를 위해 척력 강도를 매우 강력하게 상향 조정 (부모 인력 0.08을 완전히 이길 수 있어야 함)
          let strength = (0.25 * alpha) * (1 - absDiff / repulsionThreshold) * Math.sign(angleDiff);
          
          // 강제 충돌 방어막(Hard Bumper): 시각적으로 완전히 겹치는 약 8.5도(0.15 라디안) 이내 접근 시,
          // 부모들의 인력이 아무리 강해도 텍스트 겹침 등 가독성 붕괴를 방어하기 위해 튕겨냅니다.
          if (absDiff < 0.225) {
            strength += Math.sign(angleDiff) * (0.225 - absDiff) * 3.5 * alpha;
          } else if (absDiff <= 0.001) {
            strength += (Math.random() - 0.5) * 0.1 * alpha;
          }
          
          let finalStrength = strength;
          if (isAlien) {
            // 타 파벌 밀어내기 힘이 약해서 겹치던 고질적 문제 해결 (인력에 밀리지 않게 0.8배 수준으로 타협)
            finalStrength *= 0.8; 
          }

          // 완벽한 동급 궤도간의 강력한 척력 적용
          forceQ[i] += finalStrength;
          forceQ[j] -= finalStrength;
        }
      }
    }

    // 2. Link Attraction (Edges act as angular springs pointing to same ray)
    for (const edge of this.edges) {
      const srcIdx = idxMap.get(edge.source) ?? -1;
      const tgtIdx = idxMap.get(edge.target) ?? -1;
      if (srcIdx < 0 || tgtIdx < 0) continue;

      const src = this.nodes[srcIdx];
      const tgt = this.nodes[tgtIdx];
      
      // 중심 노드(0)와의 엣지는 각도 정렬에서 무시
      if (src.orbitIndex === 0 || tgt.orbitIndex === 0) continue;

      let rawAngleDiff = tgt.orbitAngle - src.orbitAngle;
      let angleDiff = Math.atan2(Math.sin(rawAngleDiff), Math.cos(rawAngleDiff));

      // 방사형 법칙(Radial Tree) 강제 적용:
      // 안쪽 궤도(부모)는 굉장히 무겁게 버티고, 바깥쪽 궤도(자식)는 안쪽 궤도를 따라가도록 물리량(Mass) 차등 적용!
      let srcMass = Math.max(1, 6 - (src.orbitIndex || 1)); // Orbit 1=5, Orbit 2=4, Orbit 3=3, ...
      let tgtMass = Math.max(1, 6 - (tgt.orbitIndex || 1));

      // 부모가 되는 안쪽 궤도와 깊은 뎁스의 자식 간격이 멀수록 
      // 자식만 일방적으로 강력하게 안쪽 궤도의 각도로 맞춰지게 됩니다. (방사형 완전 보장)
      // 부모-자식 결합력(0.3) > 타 노드의 밀어내는 반발력(0.25) 으로 설정하여, 
      // 아무리 중간에 다른 노드들이 가로막고 있어도(Beads-on-a-wire 트래픽 잼) 모세의 기적처럼 뚫고 지나가 부모에게 갈 수 있도록 합니다.
      let pullForce = 0.3; 
      if (src.orbitIndex === 1 || tgt.orbitIndex === 1) pullForce = 0.4;
      
      // 만약 두 노드가 같은 궤도(위성 링) 상에 수평 연결되어 있다면, 
      // 엉뚱한 이웃 노드들이 이 둘 사이를 가르고 들어오지 못하도록 결합 인력을 대폭 강화합니다.
      if (src.orbitIndex > 0 && src.orbitIndex === tgt.orbitIndex) {
        pullForce = 0.5;
      }
      
      // 수학적 정반대편(데드존)에서 두 노드가 서로 당기는 힘(180도)이 상쇄되어 갇히는 현상(Unstable Equilibrium)을 방지하기 위해, 
      let pull = angleDiff * pullForce * alpha;
      
      // 완전히 정반대(Math.PI) 근처에서만 미세한 난수(노이즈)를 옆구리에 섞어 완벽한 180도 균형을 무너뜨려 굴러떨어지도록 유도합니다.
      // (평상시 연결된 다중 엣지들 간에는 노이즈를 0으로 만들어 쉐이킹/진동 현상을 완전히 제거합니다.)
      if (Math.abs(Math.abs(angleDiff) - Math.PI) < 0.1) {
        pull += (Math.random() - 0.5) * 0.1 * alpha;
      }
      
      // 질량의 반비례 법칙 (가벼운 쪽이 무거운 쪽으로 확 끌려감)
      let srcPull = pull * (tgtMass / (srcMass + tgtMass)) * 2;
      let tgtPull = pull * (srcMass / (srcMass + tgtMass)) * 2;

      // 1차 카테고리(Orbit 1)는 자식의 무게(편향)에 절대 끌려가지 않고 꿋꿋이 버팀
      if (src.orbitIndex !== 1) forceQ[srcIdx] += srcPull;
      if (tgt.orbitIndex !== 1) forceQ[tgtIdx] -= tgtPull;
    }

    // 3. Category Attraction (같은 카테고리/색상 노드끼리 강하게 끌어당기는 군집화 인력)
    for (let i = 0; i < n; i++) {
      const a = this.nodes[i];
      if (a.orbitIndex === 0 || a.fixedX !== undefined) continue;
      const groupA = a.customGroup || a.group;

      for (let j = i + 1; j < n; j++) {
        const b = this.nodes[j];
        if (b.orbitIndex === 0 || b.fixedX !== undefined) continue;
        const groupB = b.customGroup || b.group;

        if (groupA === groupB) {
          let rawAngleDiff = b.orbitAngle - a.orbitAngle;
          let angleDiff = Math.atan2(Math.sin(rawAngleDiff), Math.cos(rawAngleDiff));

          // 선분이 없더라도 같은 색상/카테고리(소속)라면 끼리끼리 강하게 뭉치게 했던 힘(0.025)을
          // 다시 0.002 수준으로 대폭 낮춥니다. (이 힘이 너무 강하면 방사형 가지가 옆으로 휘어버림)
          const pull = angleDiff * 0.002 * alpha;
          
          if (a.orbitIndex !== 1) forceQ[i] += pull;
          if (b.orbitIndex !== 1) forceQ[j] -= pull;
        }
      }
    }

    // --- 2.5: Structural Anchor (수동 정렬 노드 순서 보존) ---
    // 수동으로 순서가 지정된 노드(customSortOrder 보유)는 다른 엣지 부모들이 아무리 강하게 
    // 자신을 당겨도, 처음에 지정된 정렬 순서값(targetAngle)으로 강력하게 복원(Anchor)되게 하여 순서를 무조건 지킵니다.
    for (let i = 0; i < n; i++) {
        const node = this.nodes[i];
        if (node.customSortOrder !== undefined && node.targetAngle !== undefined && node.orbitIndex > 0) {
            let sDiff = node.targetAngle - node.orbitAngle;
            sDiff = Math.atan2(Math.sin(sDiff), Math.cos(sDiff));
            
            // 인력(0.3)보다 훨씬 강력한 앵커(0.6)를 걸어 다른 링크에 끌려가서 순서가 뒤집히는 것을 원천 방지
            forceQ[i] += sDiff * 0.6 * alpha;
        }
    }

    // 3. Apply angular delta (No XY offset manipulation, strictly locks onto orbit rings!)
    for (let i = 0; i < n; i++) {
        const node = this.nodes[i];
        if (node.orbitIndex === 0 || node.fixedX !== undefined) continue;
        
        let delta = forceQ[i];
        

        // 강제 속도 제한 (Explosion 및 쉐이킹 완벽 차단)
        // 텔레포트(Warp)를 허용하면 1D 궤도 특성상 다른 노드들을 관통하며 Bumper 폭발을 일으키므로 
        // 무조건 프레임당 최대 0.25 라디안(약 14도) 이동으로 강력하게 제한합니다.
        let maxDelta = 0.25;
        if (Math.abs(delta) < 0.05) maxDelta = 0.015; // 미세 진동 방지 브레이크

        if (Math.abs(delta) > maxDelta) {
          delta = Math.sign(delta) * maxDelta;
        }
        node.orbitAngle += delta;
    }
  }

  // ============ Compute Positions ============

  private computePositions(canvasW: number, canvasH: number): void {
    const cx = canvasW / 2 + this.cameraOffsetX;
    const cy = canvasH / 2 + this.cameraOffsetY;
    const cosTilt = Math.cos(this.cameraTilt);
    const sinTilt = Math.sin(this.cameraTilt);

    // Orbit radii — wide spread for 100-node readability (궤도 간격을 넓혀 시각적 쾌적함 확보)
    const baseRadius = Math.min(canvasW, canvasH) * 0.90;
    this.orbitRadii = Array.from({ length: NUM_ORBITS + 1 }, (_, i) =>
      i === 0 ? 0 : baseRadius * (0.18 + (i / NUM_ORBITS) * 0.82)
    );

    for (const node of this.nodes) {
      // 1. Orbital position
      let worldX = 0;
      let worldY = 0;

      // LocalStorage 혹은 이전 연산 오류로 인해 NaN이 들어왔을 경우 방어
      if (typeof node.fixedX === 'number' && !isNaN(node.fixedX) && 
          typeof node.fixedY === 'number' && !isNaN(node.fixedY)) {
        worldX = node.fixedX;
        worldY = node.fixedY;
      } else {
        let orbR = 0;
        if (typeof node.orbitIndex === 'number' && !isNaN(node.orbitIndex) && node.orbitIndex <= NUM_ORBITS) {
          orbR = this.orbitRadii[node.orbitIndex] || 0;
        } else if (typeof node.orbitIndex === 'number' && !isNaN(node.orbitIndex)) {
          // 지원하는 기본 궤도수(NUM_ORBITS)를 초과하는 깊은 자식 노드가 생성될 경우, 
          // 멈추지 않고 선형적으로 궤도 반경을 무한히 확장하여 에러(NaN)를 원천 차단합니다.
          const baseR = Math.min(canvasW, canvasH) * 0.90;
          orbR = baseR * (0.18 + (node.orbitIndex / NUM_ORBITS) * 0.82);
        }
        
        const safeAngle = typeof node.orbitAngle === 'number' && !isNaN(node.orbitAngle) ? node.orbitAngle : 0;
        worldX = Math.cos(safeAngle) * orbR * ELLIPSE_RATIO;
        worldY = Math.sin(safeAngle) * orbR;
      }

      // Map to isometric/tilted 3D space
      // Apply camera tilt
      const tiltedY = worldY * Math.cos(this.cameraTilt);
      const renderZ = worldY * Math.sin(this.cameraTilt) / 500; 

      node.renderX = cx + worldX * this.zoom;
      node.renderY = cy + tiltedY * this.zoom;
      node.renderZ = renderZ;
    }

    // Apply pending camera tracking instantly (after positions are known)
    if (this.pendingCameraTargetId) {
      const target = this.nodeMap.get(this.pendingCameraTargetId);
      if (target && typeof target.renderX === 'number' && !isNaN(target.renderX) && 
          typeof target.renderY === 'number' && !isNaN(target.renderY)) {
        const snapX = this.cameraOffsetX - (target.renderX - canvasW / 2);
        const snapY = this.cameraOffsetY - (target.renderY - canvasH / 2);
        
        // 확실한 숫자일 때만 갱신 (NaN 오염 방지)
        if (!isNaN(snapX) && !isNaN(snapY)) {
          this.targetOffsetX = snapX;
          this.targetOffsetY = snapY;
        }
      }
      this.pendingCameraTargetId = null;
    }
  }

  // ============ Render ============

  render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.canvasW = width;
    this.canvasH = height;
    this.computePositions(width, height);

    // 1. Background
    this.renderBackground(ctx, width, height);

    // 2. Orbit tracks
    this.renderOrbitTracks(ctx, width, height);

    // 3. Edges
    this.renderEdges(ctx);

    // 4. Nodes (depth-sorted, back-to-front)
    this.renderNodes(ctx);

    // 5. Drag & Drop Live Preview Overlay
    if (this.isDragging && this.hasDragged && this.draggedNode) {
      this.renderDragPreview(ctx);
    }
  }

  private renderBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#f8f9fc');
    grad.addColorStop(1, '#ebeef4');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle nebula tint
    const cx = w / 2, cy = h / 2;
    const nebula = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.5);
    nebula.addColorStop(0, 'rgba(49,130,246,0.03)');
    nebula.addColorStop(1, 'rgba(49,130,246,0)');
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, w, h);
  }

  private renderOrbitTracks(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const centerX = w / 2 + this.cameraOffsetX;
    const centerY = h / 2 + this.cameraOffsetY;
    const cosTilt = Math.cos(this.cameraTilt);

    ctx.strokeStyle = 'rgba(170,180,200,0.35)';
    ctx.lineWidth = 1;

    for (let i = 1; i <= NUM_ORBITS; i++) {
      const rx = this.orbitRadii[i] * ELLIPSE_RATIO * this.zoom;
      const ry = this.orbitRadii[i] * cosTilt * this.zoom;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, rx, ry, 0, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }

  private getActiveTreeSet(): Set<string> {
    const set = new Set<string>();
    const rootId = this.activeNode?.id;
    if (!rootId) return set;
    
    set.add(rootId);
    
    // BFS (전체 하위 트리 및 양방향 커스텀 연결망 탐색)
    const queue = [rootId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const current = this.nodeMap.get(currentId);
      if (!current) continue;

      for (const edge of this.edges) {
        let nextId: string | null = null;
        if (edge.source === currentId) nextId = edge.target;
        else if (edge.target === currentId) nextId = edge.source;

        if (nextId && !set.has(nextId)) {
          // 구조적 부모 방향이나 최상위 루트 노드(Center) 방향으로의 탐색 시,
          // 선분 자체는 하이라이트 되도록 Set에는 포함하되 Queue에는 넣지 않아 전체 맵 전이를 방지합니다.
          if (nextId === current.parentId || nextId === 'root-HCHPS') {
             set.add(nextId);
             continue;
          }

          set.add(nextId);
          queue.push(nextId);
        }
      }
    }
    
    // Upward parents (전체 상위 경로)
    let currNode = this.nodeMap.get(rootId);
    const visitedParents = new Set<string>();
    while (currNode && currNode.parentId) {
      if (visitedParents.has(currNode.parentId)) break; // 사이클 방지
      visitedParents.add(currNode.parentId);
      
      set.add(currNode.parentId);
      currNode = this.nodeMap.get(currNode.parentId);
    }
    
    return set;
  }

  private renderDragPreview(ctx: CanvasRenderingContext2D): void {
    if (!this.draggedNode) return;
    
    // 이전에 분리한 공통 로직 재사용
    const { targetParentId, closestOrbit, isDirectDrop, closestCat } = this.getDropTarget(this.draggedNode);
    const targetNode = targetParentId ? this.nodeMap.get(targetParentId) : null;
    
    // 1. 목표 타겟 부모와 연결되는 점선 및 하이라이트 표시
    if (targetNode && targetNode.id !== 'root-HCHPS') {
      ctx.save();
      // 점선 연결
      ctx.beginPath();
      ctx.moveTo(this.draggedNode.renderX, this.draggedNode.renderY);
      ctx.lineTo(targetNode.renderX, targetNode.renderY);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)'; // 맑은 하늘색 (Tailwind light-blue)
      ctx.lineWidth = 2 * this.zoom;
      ctx.setLineDash([6 * this.zoom, 6 * this.zoom]);
      ctx.stroke();

      // 타겟 노드 글로우 링
      ctx.beginPath();
      const r = targetNode.nodeRadius * this.zoom + 8;
      ctx.arc(targetNode.renderX, targetNode.renderY, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
      ctx.lineWidth = 3 * this.zoom;
      ctx.setLineDash([]);
      ctx.stroke();
      
      // 타겟 배경 은은한 빛
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.fill();
      ctx.restore();
    }

    // 2. 마우스(현재 드래그 중인 노드) 상단에 헬퍼 텍스트(오버레이) 표시
    ctx.save();
    
    // 문맥에 맞는 자연스러운 한국어 안내문 생성
    let previewText = '';
    
    if (isDirectDrop && closestCat) {
      previewText = `🎯 "${closestCat.label}"(올려둔 노드)의 하위 로 편입 (궤도 ${closestOrbit})`;
    } else if (targetNode && targetNode.id !== 'root-HCHPS') {
      previewText = `"${targetNode.label}" 중심의 ${closestOrbit}번 궤도 배치`;
    } else if (closestOrbit === 1) {
      previewText = `✨ 새로운 독립 카테고리로 1번 궤도 배치`;
    } else if (closestOrbit === 0) {
      previewText = `🌟 중앙 뿌리(태양) 노드로 초기화`;
    } else {
      previewText = `현재 구조 유지 (궤도 ${closestOrbit})`;
    }
         
    const fontSize = Math.max(10, Math.min(13, 11 * this.zoom));
    ctx.font = `600 ${fontSize}px 'Pretendard', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const paddingX = 14;
    const paddingY = 8;
    const textWidth = ctx.measureText(previewText).width;
    const bgWidth = textWidth + paddingX * 2;
    const bgHeight = fontSize + paddingY * 2;
    
    // 노드 위에 띄울 Y 좌표 (노드 반지름 + 여백)
    const tooltipY = this.draggedNode.renderY - (this.draggedNode.nodeRadius * this.zoom) - 24;
    
    // 반투명 프리미엄 다크 라벨 배경
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; // Slate-900
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(this.draggedNode.renderX - bgWidth/2, tooltipY - bgHeight/2, bgWidth, bgHeight, Math.min(8, bgHeight/2));
    } else {
      ctx.rect(this.draggedNode.renderX - bgWidth/2, tooltipY - bgHeight/2, bgWidth, bgHeight);
    }
    ctx.fill();
    
    // 눈에 띄는 하늘색 텍스트
    ctx.fillStyle = '#38bdf8'; 
    ctx.fillText(previewText, this.draggedNode.renderX, tooltipY);
    ctx.restore();
  }

  private renderEdges(ctx: CanvasRenderingContext2D): void {
    const activeId = this.activeNode?.id ?? null;
    const activeTreeSet = this.getActiveTreeSet();
    const w = this.canvasW;
    const h = this.canvasH;

    // When a node is selected, only draw connected edges + faint others
    // This dramatically reduces draw calls from 200 to ~20
    for (const edge of this.edges) {
      const src = this.nodeMap.get(edge.source);
      const tgt = this.nodeMap.get(edge.target);
      if (!src || !tgt) continue;

      const isConnected = activeId && activeTreeSet.has(src.id) && activeTreeSet.has(tgt.id);

      // PERF: Skip non-connected edges when a node is selected (draw only faint batch below)
      if (activeId && !isConnected) continue;

      // Frustum cull
      if (src.renderX < -CULL_MARGIN && tgt.renderX < -CULL_MARGIN) continue;
      if (src.renderX > w + CULL_MARGIN && tgt.renderX > w + CULL_MARGIN) continue;
      if (src.renderY < -CULL_MARGIN && tgt.renderY < -CULL_MARGIN) continue;
      if (src.renderY > h + CULL_MARGIN && tgt.renderY > h + CULL_MARGIN) continue;

      const isNegative = edge.weight < 0;
      const absWeight = Math.abs(edge.weight);
      const avgZ = (src.renderZ + tgt.renderZ) / 2;
      const depthBrightness = 0.3 + (avgZ + 1) * 0.35;

      // 선 굵기를 시각적으로 얇고 세련되게 줄입니다 (absWeight * 2 -> absWeight * 1.0)
      let lineWidth = 0.3 + absWeight * 1.0;
      if (isNegative) lineWidth *= 1.3;
      if (isConnected) lineWidth *= 1.2;

      const alpha = isConnected
        ? Math.max(0.4, depthBrightness * 0.8)
        : depthBrightness * 0.25;

      if (isNegative) {
        ctx.strokeStyle = `rgba(229,56,59,${alpha})`;
      } else if (isConnected) {
        ctx.strokeStyle = `rgba(59,130,246,${Math.min(1, alpha * 1.5)})`;
      } else {
        ctx.strokeStyle = `rgba(204,204,204,${alpha})`;
      }

      ctx.lineWidth = lineWidth;
      ctx.setLineDash(isNegative ? [4, 3] : []);
      ctx.beginPath();
      ctx.moveTo(src.renderX, src.renderY);
      ctx.lineTo(tgt.renderX, tgt.renderY);
      ctx.stroke();
    }

    // If active node selected, draw remaining edges as ultra-faint batch
    if (activeId) {
      ctx.strokeStyle = 'rgba(200,200,210,0.15)';
      ctx.lineWidth = 0.3; // 배경으로 물러나는 얇은 선
      ctx.setLineDash([]);
      ctx.beginPath();
      for (const edge of this.edges) {
        if (edge.source === activeId || edge.target === activeId) continue;
        const src = this.nodeMap.get(edge.source);
        const tgt = this.nodeMap.get(edge.target);
        if (!src || !tgt) continue;
        ctx.moveTo(src.renderX, src.renderY);
        ctx.lineTo(tgt.renderX, tgt.renderY);
      }
      ctx.stroke(); // single draw call for all faint edges
    }
    ctx.setLineDash([]);
  }

  private drawArrow(
    ctx: CanvasRenderingContext2D,
    src: OrbitalNode, tgt: OrbitalNode,
    lineWidth: number, color: string,
  ): void {
    const t = 0.7;
    const ax = src.renderX + (tgt.renderX - src.renderX) * t;
    const ay = src.renderY + (tgt.renderY - src.renderY) * t;
    const angle = Math.atan2(tgt.renderY - src.renderY, tgt.renderX - src.renderX);
    const arrowLen = 6 + lineWidth * 2;
    const arrowAngle = 0.4;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(
      ax - arrowLen * Math.cos(angle - arrowAngle),
      ay - arrowLen * Math.sin(angle - arrowAngle),
    );
    ctx.lineTo(
      ax - arrowLen * Math.cos(angle + arrowAngle),
      ay - arrowLen * Math.sin(angle + arrowAngle),
    );
    ctx.closePath();
    ctx.fill();
  }


  private getNodeColors(node: OrbitalNode): string[] {
    // 1. 사용자가 명시적으로 팔레트에서 칠한 색상이 있다면 파이 조각을 무시하고 단일 색상으로 강력하게 유지
    if ((node as any).isExplicitColor && node.customColor) {
      return [node.customColor];
    }
    
    const colors = new Set<string>();
    
    if (node.orbitIndex === 0) {
      colors.add(node.customColor || GROUP_COLORS[node.group as OntologyGroup] || GROUP_COLORS.OTHER);
      return Array.from(colors);
    }
    
    if (node.customColor) {
      colors.add(node.customColor);
    } else {
      colors.add(GROUP_COLORS[node.group as OntologyGroup] || GROUP_COLORS.OTHER);
    }

    // 2. 자신과 연결된 모든 노드를 순회하며 나와 동급(<=)이거나 중심부인 노드의 색상을 다중 수집 (상하좌우 브릿징)
    for (const edge of this.edges) {
      const sourceId = typeof edge.source === 'object' ? (edge.source as any).id : edge.source;
      const targetId = typeof edge.target === 'object' ? (edge.target as any).id : edge.target;
      
      // 중심 폴(root-HCHPS)과의 연결선에 의한 기본 회색 혼합은 방지
      if (sourceId === 'root-HCHPS' || targetId === 'root-HCHPS') continue;
      
      let neighborId: string | null = null;
      if (sourceId === node.id) neighborId = targetId;
      if (targetId === node.id) neighborId = sourceId;
      
      if (neighborId) {
        const neighbor = this.nodes.find(n => n.id === neighborId);
        // 자신보다 중심에 가깝거나, 같은 궤도의 이웃이라면 색상 흡수 (드래그하여 연결된 역방향 선분 대응)
        if (neighbor && neighbor.orbitIndex > 0 && neighbor.orbitIndex <= node.orbitIndex) {
          const c = neighbor.customColor || GROUP_COLORS[neighbor.group as OntologyGroup] || GROUP_COLORS.OTHER;
          colors.add(c);
        }
      }
    }
    
    return Array.from(colors);
  }

  private renderNodes(ctx: CanvasRenderingContext2D): void {
    // Reuse sorted buffer (avoid allocation)
    this.sortedNodes.length = 0;
    for (const n of this.nodes) this.sortedNodes.push(n);
    this.sortedNodes.sort((a, b) => a.renderZ - b.renderZ);
    const sorted = this.sortedNodes;
    const activeId = this.activeNode?.id;
    const hoveredId = this.hoveredNode?.id;
    const activeTreeSet = this.getActiveTreeSet();
    const w = this.canvasW;
    const h = this.canvasH;

    // Label occlusion tracking: array of placed label bounding boxes
    const placedLabels: Array<{x: number; y: number; w: number; h: number}> = [];

    for (const node of sorted) {
      // Frustum cull
      const r = node.nodeRadius * this.zoom;
      if (node.renderX + r * 3 < -CULL_MARGIN || node.renderX - r * 3 > w + CULL_MARGIN) continue;
      if (node.renderY + r * 3 < -CULL_MARGIN || node.renderY - r * 3 > h + CULL_MARGIN) continue;

      const isCenter = node.orbitIndex === 0;
      const isActive = node.id === activeId;
      const isHovered = node.id === hoveredId;
      // 노드 자신 또는 1-hop, 하위, 상위 경로가 선택된 트리에 포함되는지 확인
      const isConnectedToActive = activeTreeSet.has(node.id);
      const hasActiveSelection = !!activeId && activeId !== this.centerNode?.id;

      const depthAlpha = 0.4 + (node.renderZ + 1) * 0.3;
      const nodeColors = this.getNodeColors(node);
      const baseColor = nodeColors[0];

      // Determine opacity
      let opacity = hasActiveSelection
        ? (isActive || isConnectedToActive ? 1 : 0.28)
        : depthAlpha;

      if (isHovered && !isActive) opacity = Math.max(opacity, 0.9);

      ctx.save();
      ctx.globalAlpha = opacity;

      const labelText = node.label || '';
      // 캡슐(Pill) 노드 렌더링 삭제: 모든 노드를 동일한 3D 구체(Circle)로 렌더링합니다.
      const isMetaNode = false;
      const isDateMeta = false;

      // 1. 일반 개념(Concept) 노드의 경우 기존처럼 입체적인 글로우 서클(Circle) 렌더링
      if (!isMetaNode) {
        // ── Center Sun ──
        const sliceAngle = (2 * Math.PI) / nodeColors.length;

        if (isCenter) {
          const glow = ctx.createRadialGradient(node.renderX, node.renderY, r * 0.5, node.renderX, node.renderY, r * 6);
          glow.addColorStop(0, this.colorWithAlpha(baseColor, 0.05));
          glow.addColorStop(0.5, this.colorWithAlpha(baseColor, 0.01));
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(node.renderX, node.renderY, r * 6, 0, 2 * Math.PI); ctx.fill();

          const corona = ctx.createRadialGradient(node.renderX, node.renderY, r * 0.8, node.renderX, node.renderY, r * 2.5);
          corona.addColorStop(0, this.colorWithAlpha(baseColor, 0.08));
          corona.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = corona;
          ctx.beginPath(); ctx.arc(node.renderX, node.renderY, r * 2.5, 0, 2 * Math.PI); ctx.fill();

          const baseR = node.nodeRadius * this.zoom;
          const sizeOverride = (this.activeNode && this.activeNode.id === node.id) ? baseR * 1.5 : (isHovered ? baseR * 1.2 : baseR);

          for (let i = 0; i < nodeColors.length; i++) {
            const gradient = ctx.createRadialGradient(
              node.renderX - sizeOverride * 0.3, node.renderY - sizeOverride * 0.3, 0,
              node.renderX, node.renderY, sizeOverride
            );
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.3, this.lightenColor(nodeColors[i], 0.4));
            gradient.addColorStop(1, this.lightenColor(nodeColors[i], 0.1));
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(node.renderX, node.renderY);
            ctx.arc(node.renderX, node.renderY, sizeOverride, -Math.PI/2 + i * sliceAngle, -Math.PI/2 + (i + 1) * sliceAngle);
            ctx.fill();
          }

          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(node.renderX, node.renderY, sizeOverride, 0, 2 * Math.PI); ctx.stroke();

        // ── Active Node ──
        } else if (isActive) {
          const glow = ctx.createRadialGradient(node.renderX, node.renderY, r * 0.5, node.renderX, node.renderY, r * 3);
          glow.addColorStop(0, this.colorWithAlpha(baseColor, 0.15));
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(node.renderX, node.renderY, r * 3, 0, 2 * Math.PI); ctx.fill();

          for (let i = 0; i < nodeColors.length; i++) {
            const coreGrad = ctx.createRadialGradient(
              node.renderX - r * 0.15, node.renderY - r * 0.15, 0,
              node.renderX, node.renderY, r
            );
            coreGrad.addColorStop(0, '#ffffff');
            coreGrad.addColorStop(0.5, this.lightenColor(nodeColors[i], 0.5));
            coreGrad.addColorStop(1, nodeColors[i]);
            
            ctx.fillStyle = coreGrad;
            ctx.beginPath();
            ctx.moveTo(node.renderX, node.renderY);
            ctx.arc(node.renderX, node.renderY, r, -Math.PI/2 + i * sliceAngle, -Math.PI/2 + (i + 1) * sliceAngle);
            ctx.fill();
          }

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(node.renderX, node.renderY, r, 0, 2 * Math.PI); ctx.stroke();
          
          for (let i = 0; i < nodeColors.length; i++) {
            ctx.strokeStyle = nodeColors[i];
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(node.renderX, node.renderY); // Important so borders curve back to center if bridging, though stroke on arc usually handles arc length
            ctx.arc(node.renderX, node.renderY, r + 3, -Math.PI/2 + i * sliceAngle, -Math.PI/2 + (i + 1) * sliceAngle);
            ctx.stroke();
          }

        // ── Normal / Hovered / Connected ──
        } else {
          if (isHovered) {
            const glow = ctx.createRadialGradient(node.renderX, node.renderY, r * 0.5, node.renderX, node.renderY, r * 2);
            glow.addColorStop(0, this.colorWithAlpha(baseColor, 0.12));
            glow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.arc(node.renderX, node.renderY, r * 2, 0, 2 * Math.PI); ctx.fill();
          }

          for (let i = 0; i < nodeColors.length; i++) {
            const coreGrad = ctx.createRadialGradient(
              node.renderX - r * 0.15, node.renderY - r * 0.15, 0,
              node.renderX, node.renderY, r
            );
            coreGrad.addColorStop(0, this.lightenColor(nodeColors[i], 0.4));
            coreGrad.addColorStop(1, nodeColors[i]);
            
            ctx.fillStyle = coreGrad;
            ctx.beginPath();
            ctx.moveTo(node.renderX, node.renderY);
            ctx.arc(node.renderX, node.renderY, r, -Math.PI/2 + i * sliceAngle, -Math.PI/2 + (i + 1) * sliceAngle);
            ctx.fill();
          }

          if (isConnectedToActive) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(node.renderX, node.renderY, r, 0, 2 * Math.PI); ctx.stroke();
          }
        }
        
        // ── Hedge dashed ring ──
        if (node.isHedge) {
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = GROUP_COLORS.SYSTEM_RISK;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(node.renderX, node.renderY, r + 5, 0, 2 * Math.PI);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // 2. 렌더링 타입에 따른 텍스트/뱃지 라벨 드로잉
      if (isMetaNode) {
        // 날짜/전화번호 등 메타데이터는 공 형태가 아닌 '플로팅 태그 뱃지(Pill Badge)'로 렌더링
        const icon = isDateMeta ? '🗓️' : '📞';
        const fullLabel = `${icon} ${labelText}`;
        
        const fontSize = Math.max(9, Math.min(11, 10 * this.zoom));
        ctx.font = `600 ${fontSize}px 'Pretendard', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const textWidth = ctx.measureText(fullLabel).width;
        const paddingX = 8;
        const paddingY = 4;
        const bgWidth = textWidth + paddingX * 2;
        const bgHeight = fontSize + paddingY * 2;
        
        // 아이콘 종류에 따라 파스텔 톤 메타 태그 색상 지정
        ctx.fillStyle = isDateMeta ? 'rgba(56, 189, 248, 0.85)' : 'rgba(129, 142, 248, 0.85)';
        ctx.strokeStyle = isDateMeta ? '#0284c7' : '#4f46e5';
        ctx.lineWidth = 1.2;
        
        // 둥근 캡슐 (Pill) 테두리 그리기
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(node.renderX - bgWidth/2, node.renderY - bgHeight/2, bgWidth, bgHeight, bgHeight/2);
        } else {
          ctx.rect(node.renderX - bgWidth/2, node.renderY - bgHeight/2, bgWidth, bgHeight);
        }
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff'; // 텍스트는 깔끔한 흰색
        ctx.fillText(fullLabel, node.renderX, node.renderY);

      } else {
        // 일반 개념 노드의 라벨 렌더링
        const isActiveOrHovered = isActive || isHovered;
        const fontSize = Math.max(8, Math.min(12, 9 * this.zoom));
        const fontWeight = (isCenter || isActive) ? 'bold' : 'normal';
        
        ctx.font = `${fontWeight} ${fontSize}px 'Pretendard', 'Inter', system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const labelY = node.renderY + r + 3;
        const textWidth = ctx.measureText(labelText).width;

        // Draw premium pill background behind text to prevent overlap clutter
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.85, opacity * 1.5)})`;
        const paddingX = 4;
        const paddingY = 2;
        const bgWidth = textWidth + paddingX * 2;
        const bgHeight = fontSize + paddingY * 2;
        
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(node.renderX - bgWidth / 2, labelY - paddingY, bgWidth, bgHeight, 6);
        } else {
          ctx.rect(node.renderX - bgWidth / 2, labelY - paddingY, bgWidth, bgHeight);
        }
        ctx.fill();

        // Text stroke for extra crispness
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.strokeText(labelText, node.renderX, labelY);

        // Main Text
        ctx.fillStyle = isCenter || isActiveOrHovered
          ? '#1e293b'
          : `rgba(30,41,59,${Math.max(0.7, opacity)})`;
          
        ctx.fillText(labelText, node.renderX, labelY);
      }

      // 3. 궤도 번호 시각화 - 명시적인 숫자 대신 메카닉/HUD 스타일의 '끊어진 테두리(Segmented Arc)' 개수로 표현
      // 궤도가 1이면 1개의 긴 호, 2면 2개의 반원상 호, 3이면 3조각으로 분할되어 매우 직관적이고 깔끔함
      if (!isCenter && typeof node.orbitIndex === 'number' && !isMetaNode && node.orbitIndex > 0) {
        const orbitCount = node.orbitIndex;
        // 기존 Hover/Active 하이라이트 링과 겹치지 않게 살짝 공간을 둡니다.
        const arcRadius = r + (isActive ? 7 : 4) * this.zoom; 
        
        ctx.lineWidth = Math.max(1, 1.5 * this.zoom);
        // 부드럽게 반투명 처리하여 본체보다 튀지 않게
        ctx.strokeStyle = this.colorWithAlpha(baseColor, isActive ? 0.9 : 0.6);
        ctx.lineCap = 'round';
        
        const gap = 0.4; // 호 사이의 간격 (라디안)
        const totalAngle = Math.PI * 2;
        // 궤도 수에 따라 N개의 파편 단위 호 각도 계산
        const segmentAngle = (totalAngle - gap * orbitCount) / orbitCount;
        
        for (let i = 0; i < orbitCount; i++) {
          const startAngle = i * (segmentAngle + gap) - Math.PI / 2;
          const endAngle = startAngle + segmentAngle;
          
          ctx.beginPath();
          ctx.arc(node.renderX, node.renderY, arcRadius, startAngle, endAngle);
          ctx.stroke();
        }
        ctx.lineCap = 'butt'; // 복구
      }

      ctx.restore();
    }
  }

  // ============ Interaction ============

  hitTest(mx: number, my: number): OrbitalNode | null {
    let closest: OrbitalNode | null = null;
    let minDist = Infinity;

    for (const node of this.nodes) {
      const dx = mx - node.renderX;
      const dy = my - node.renderY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const hitRadius = node.nodeRadius * this.zoom * 0.6 + 12;
      if (dist < hitRadius && dist < minDist) {
        minDist = dist;
        closest = node;
      }
    }
    return closest;
  }

  handleClick(mx: number, my: number): void {
    if (this.hasDragged) {
      this.hasDragged = false;
      return;
    }

    const hit = this.hitTest(mx, my);
    if (hit) {
      if (this.activeNode?.id === hit.id) {
        // Toggle off → just deselect, maintain camera pos
        this.activeNode = this.centerNode;
        this.previousActiveNodeId = this.centerNode?.id || null;
      } else {
        this.activeNode = hit;
        this.previousActiveNodeId = hit.id;
        // Center clicked node on screen
        const screenCenterX = this.canvasW / 2;
        const screenCenterY = this.canvasH / 2;
        this.targetOffsetX = screenCenterX - (hit.renderX - this.cameraOffsetX);
        this.targetOffsetY = screenCenterY - (hit.renderY - this.cameraOffsetY);
      }
    } else {
      // Click empty space → deselect, maintain camera pos
      this.activeNode = this.centerNode;
      this.previousActiveNodeId = this.centerNode?.id || null;
    }
    this.callbacks.onActiveNodeChange?.(this.activeNode);
  }

  handleHover(mx: number, my: number): void {
    const hit = this.hitTest(mx, my);
    if (hit?.id !== this.hoveredNode?.id) {
      this.hoveredNode = hit;
      this.callbacks.onHoveredNodeChange?.(hit);
    }
  }

  handleWheel(delta: number): void {
    const zoomFactor = delta > 0 ? 0.92 : 1.08;
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom * zoomFactor));
  }

  // ── Interaction ──

  handleDragStart(nx: number, ny: number): void {
    this.isDragging = true;
    this.hasDragged = false;
    this.dragStartX = nx;
    this.dragStartY = ny;
    this.lastDragX = nx;
    this.lastDragY = ny;
    this.dragStartTilt = this.cameraTilt;
    this.draggedNode = null;

    // Check hit test for node dragging
    let closestId = null;
    let minDist = Infinity;
    for (const node of this.nodes) {
      if (node.id === 'root-HCHPS') continue; // Don't drag the main sun
      const dx = nx - node.renderX;
      const dy = ny - node.renderY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist && dist <= node.nodeRadius + 15) {
        minDist = dist;
        closestId = node.id;
      }
    }

    if (closestId) {
      this.draggedNode = this.nodeMap.get(closestId)!;
    }
  }

  handleDragMove(nx: number, ny: number, w: number, h: number): void {
    if (!this.isDragging) return;

    if (Math.abs(nx - this.dragStartX) > 5 || Math.abs(ny - this.dragStartY) > 5) {
      this.hasDragged = true;
    }

    if (this.draggedNode) {
      // 클릭만 한 상태(미세한 떨림)에서는 좌표를 고정(fixedX)시키지 않습니다. 
      // 고정시킬 경우 공전(Orbit)이 영구적으로 멈추는 버그가 발생하기 때문입니다.
      if (this.hasDragged) {
        // Inverse projection to find World X, Y
        const cx = w / 2 + this.cameraOffsetX;
        const cy = h / 2 + this.cameraOffsetY;
        const worldX = (nx - cx) / this.zoom;
        const worldY = (ny - cy) / this.zoom / Math.cos(this.cameraTilt);
        
        // Temporarily track mouse visually without snapping to orbits
        this.draggedNode.fixedX = worldX;
        this.draggedNode.fixedY = worldY;
      }
    } else {
      // Camera Panning
      const dx = nx - this.lastDragX;
      const dy = ny - this.lastDragY;
      
      this.cameraOffsetX += dx;
      this.cameraOffsetY += dy;
      this.targetOffsetX = this.cameraOffsetX;
      this.targetOffsetY = this.cameraOffsetY;
      
      this.lastDragX = nx;
      this.lastDragY = ny;
    }
  }

  private getDropTarget(draggedNode: OrbitalNode): { targetParentId: string | undefined; closestOrbit: number; isDirectDrop: boolean; closestCat: OrbitalNode | null } {
    let closestCat: OrbitalNode | null = null;
    let minSqDist = Infinity;
    
    for (const node of this.nodes) {
      if (node.id !== draggedNode.id) {
        const dx = node.renderX - draggedNode.renderX;
        const dy = node.renderY - draggedNode.renderY;
        const sqDist = dx * dx + dy * dy;
        if (sqDist < 40000 && sqDist < minSqDist) {
          minSqDist = sqDist;
          closestCat = node;
        }
      }
    }

    let closestOrbit = draggedNode.orbitIndex;
    let targetParentId: string | undefined = closestCat ? closestCat.id : undefined;

    // 만약 정밀하게 다른 노드 위(반경 100px 이내, sqDist 10000)에 드롭했다면 "해당 노드에 흡수(자식으로 편입)" 요청으로 간주합니다.
    const isDirectDrop = closestCat !== null && minSqDist < 10000;

    if (draggedNode.fixedX !== undefined && draggedNode.fixedY !== undefined) {
      const distFromCenter = Math.sqrt((draggedNode.fixedX * draggedNode.fixedX) / (ELLIPSE_RATIO * ELLIPSE_RATIO) + draggedNode.fixedY * draggedNode.fixedY);
      
      let minOrbitDiff = Infinity;
      // 중앙 노드(Orbit 0) 강제 편입 로직을 삭제하고 최소 1번 궤도(독립 카테고리)부터 탐색하게 하여 루트 노드 탈취 버그를 원천 삭제합니다.
      for (let i = 1; i < this.orbitRadii.length; i++) {
        const diff = Math.abs(distFromCenter - this.orbitRadii[i]);
        if (diff < minOrbitDiff) {
          minOrbitDiff = diff;
          closestOrbit = i;
        }
      }
      
      if (isDirectDrop && closestCat) {
        // 다른 노드 위로 정확히 올렸을 때 -> 궤도를 떠나서 강제로 흡수(자식 노드로 편입)
        targetParentId = closestCat.id;
        closestOrbit = closestCat.orbitIndex === 0 ? 1 : closestCat.orbitIndex + 1;
      } else if (closestOrbit === 1) {
        // 빈 공간 1번 궤도 위에 놓았을 때 -> 독립 카테고리 승격 (명시적으로 중앙 태양 노드를 부모로 지정)
        targetParentId = 'root-HCHPS';
      } else if (closestOrbit >= 2 && !targetParentId) {
        // 안쪽 궤도로 떨어뜨렸는데 주변에 마땅한 부모가 없으면 기존 부모 유지
        targetParentId = draggedNode.parentId;
      }
    }

    return { targetParentId, closestOrbit, isDirectDrop, closestCat };
  }

  handleDragEnd(): void {
    if (this.draggedNode && this.hasDragged) {
      const { targetParentId, closestOrbit } = this.getDropTarget(this.draggedNode);
      
      // 드래그된 궤도/부모 결과를 항상 저장 (fixedX/Y 해제 포함)
      this.callbacks.onNodeReparent?.(this.draggedNode.id, targetParentId, closestOrbit);
      
      this.draggedNode.fixedX = undefined;
      this.draggedNode.fixedY = undefined;
    }
    this.isDragging = false;
    this.draggedNode = null;
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
}
