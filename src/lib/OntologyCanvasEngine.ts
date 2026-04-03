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
  onEdgeClick?: (edge: OntologyEdge) => void;
  onNodeReparent?: (nodeId: string, newParentId: string | undefined, newOrbitIndex: number) => void;
  onNodePin?: (nodeId: string, fixedX: number, fixedY: number) => void;
  onNodeBatchPin?: (pins: { id: string; fixedX: number; fixedY: number }[]) => void;
}

// ============ Engine Class ============

export class OntologyCanvasEngine {
  nodes: OrbitalNode[] = [];
  edges: OntologyEdge[] = [];
  centerNode: OrbitalNode | null = null;
  activeNode: OrbitalNode | null = null;
  hoveredNode: OrbitalNode | null = null;
  hoveredEdge: OntologyEdge | null = null;

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

  // Reusable sort buffers (avoid per-frame allocation)
  private sortedNodes: OrbitalNode[] = [];
  private canvasW = 0;
  private canvasH = 0;



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
      const randomRingOffset = Math.random() * Math.PI * 2;
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
        const N = groupNodes.length;
        // 1차 카테고리 뿐만 아니라 모든 자식 노드들이 각자 부모를 기준으로 360도 방사형 배치되도록 수정
        const startAngle = Math.random() * Math.PI * 2;
        const angleStep = N === 0 ? 0 : (Math.PI * 2) / N;

        groupNodes.forEach((node, gIdx) => {
          let angle = startAngle + (gIdx * angleStep);
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
    
    // Physics engine (repulsion/attraction arrays) completely disabled 
    // to allow pure manual pinning and to instantly eliminate the O(n^2) drag lag.
  }



  // ============ Compute Positions ============

  private computePositions(canvasW: number, canvasH: number): void {
    const cx = canvasW / 2 + this.cameraOffsetX;
    const cy = canvasH / 2 + this.cameraOffsetY;
    const cosTilt = Math.cos(this.cameraTilt);
    const sinTilt = Math.sin(this.cameraTilt);

    // Orbit radii — wide spread for 100-node readability (궤도 간격을 넓혀 시각적 쾌적함 확보)
    const baseRadius = Math.min(canvasW, canvasH) * 0.65;
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
        const safeAngle = typeof node.orbitAngle === 'number' && !isNaN(node.orbitAngle) ? node.orbitAngle : 0;
        
        // 부모 노드가 있고, 자신이 자식(orbitIndex > 1)이라면 '부모 중심 방사형(Radial)' 배치 채택
        if (node.parentId && node.orbitIndex > 1) {
           const parentNode = this.nodeMap.get(node.parentId);
           // 부모 좌표 기준 계산
           const px = parentNode?.worldX || 0;
           const py = parentNode?.worldY || 0;
           
           // 부모 주변의 자식 궤도 반경 (부모를 감싸는 컴팩트한 클러스터 형태 유지)
           const localRadius = 50 + (node.orbitIndex - 1) * 20; 
           worldX = px + Math.cos(safeAngle) * localRadius * ELLIPSE_RATIO;
           worldY = py + Math.sin(safeAngle) * localRadius;
        } else {
          // 중앙 수퍼 노드 혹은 1차 카테고리(orbitIndex 0~1)의 경우 기존 캔버스 중앙을 중심으로 공전
          let orbR = 0;
          if (typeof node.orbitIndex === 'number' && !isNaN(node.orbitIndex) && node.orbitIndex <= NUM_ORBITS) {
            orbR = this.orbitRadii[node.orbitIndex] || 0;
          } else if (typeof node.orbitIndex === 'number' && !isNaN(node.orbitIndex)) {
            const baseR = Math.min(canvasW, canvasH) * 0.65;
            orbR = baseR * (0.18 + (node.orbitIndex / NUM_ORBITS) * 0.82);
          }
          worldX = Math.cos(safeAngle) * orbR * ELLIPSE_RATIO;
          worldY = Math.sin(safeAngle) * orbR;
        }
      }

      // 자식 노드가 체인 계산에서 활용할 수 있도록 월드 좌표 저장
      node.worldX = worldX;
      node.worldY = worldY;

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
    
    const rootNode = this.nodeMap.get(rootId);
    const isCategoryLevel = rootNode ? rootNode.orbitIndex <= 1 || rootNode.id === 'root-HCHPS' : false;

    // 1. Network Flow BFS
    const queue = [rootId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const current = this.nodeMap.get(currentId);
      const isImmediateHop = (currentId === rootId);
      
      for (const edge of this.edges) {
        // 중심 노드 관통 차단
        if (rootId !== 'root-HCHPS' && edge.target === 'root-HCHPS') continue;
        if (rootId !== 'root-HCHPS' && isImmediateHop && edge.source === 'root-HCHPS') continue;
        
        let nextId: string | null = null;
        
        if (isCategoryLevel) {
          // 카테고리는 하위 방향 우선 완전 전파. 
          if (edge.source === currentId) nextId = edge.target;
          else if (edge.target === currentId) nextId = edge.source; // 수평 커스텀 선분 등 포괄
          
          // 하지만 1-hop 이후 다른 카테고리로 역주행(Upward)하는 것은 차단
          if (!isImmediateHop && current && nextId === current.parentId) nextId = null;
        } else {
          // 하위(일반) 노드는 자신이 Source인 경우에만 큐를 타고 밑으로 번짐
          if (edge.source === currentId) {
            nextId = edge.target;
          } else if (edge.target === currentId && isImmediateHop) {
            // 내가 Target(수신자)인 역방향 1-hop 이웃은 시각적으로 불만 켜주고 큐 단절 -> 형제 오염 방지
            nextId = edge.source;
            if (!set.has(nextId)) set.add(nextId);
            nextId = null; 
          }
        }
        
        if (nextId && !set.has(nextId)) {
          set.add(nextId);
          queue.push(nextId);
        }
      }
    }
    
    // 2. Upward Ancestors (Structural Lineage)
    // 1줄기 뿌리만 추적
    let currNode = this.nodeMap.get(rootId);
    while (currNode && currNode.parentId) {
      set.add(currNode.parentId);
      currNode = this.nodeMap.get(currNode.parentId);
    }
    
    return set;
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
    
    // Draw '+' on active edges connected to activeNode
    if (activeId) {
      for (const edge of this.edges) {
        if (edge.source === activeId || edge.target === activeId) {
          const src = this.nodeMap.get(edge.source);
          const tgt = this.nodeMap.get(edge.target);
          if (!src || !tgt) continue;

          const midX = (src.renderX + tgt.renderX) / 2;
          const midY = (src.renderY + tgt.renderY) / 2;
          const isHovered = this.hoveredEdge === edge;

          ctx.fillStyle = isHovered ? '#3b82f6' : '#ffffff';
          ctx.strokeStyle = isHovered ? '#ffffff' : '#cbd5e1';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(midX, midY, isHovered ? 8 : 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isHovered ? '#ffffff' : '#94a3b8';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('+', midX, midY + 1);
        }
      }
    }
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
    const colors = new Set<string>();
    const myBaseColor = node.customColor || GROUP_COLORS[node.group as OntologyGroup] || GROUP_COLORS.OTHER;
    
    // 1. 중심 노드(0) 또는 색상 정체성이 확고한 상위 카테고리(사람, 핵심 부서 등)는 절대 파이차트가 되지 않고 고유 색상을 유지합니다.
    const isPrimaryCategory = node.group === 'CORE_PROJECT' || node.group === 'MACRO_RESEARCH' || node.group === 'DCF_MODELING';
    if (node.orbitIndex === 0 || isPrimaryCategory) {
      return [myBaseColor];
    }

    // 3. 자신과 연결된 모든 노드를 순회하며 나와 동급(<=)이거나 중심부인 노드의 색상을 수집
    for (const edge of this.edges) {
      const sourceId = typeof edge.source === 'object' ? (edge.source as any).id : edge.source;
      const targetId = typeof edge.target === 'object' ? (edge.target as any).id : edge.target;
      
      // 나와 연결된 선분 중, "내가 타겟(Target, 자식/의존자)"인 경우에만 소스(부모/원천)의 색상을 상속받습니다.
      // 즉, 부모 -> 자식 방향으로 연결되어야 자식이 부모들의 색상을 흡수해 파이차트가 됩니다.
      if (targetId === node.id) {
        const neighbor = this.nodes.find(n => n.id === sourceId);
        if (neighbor && neighbor.orbitIndex > 0) {
          const c = neighbor.customColor || GROUP_COLORS[neighbor.group as OntologyGroup] || GROUP_COLORS.OTHER;
          colors.add(c);
        }
      }
    }
    
    // 만약 수집된 상위/측면 노드가 없다면(혹은 단절되었다면) 태생 그룹의 색상으로 렌더링
    if (colors.size === 0) {
      return [myBaseColor];
    }
    
    // 자기 자신의 오리지널 그룹 색상을 기본 포함 (만약 상위 연결선의 색상 세트에 본인 고유의 색상이 빠져있다면 추가)
    // 브릿지 노드라면, 타 진영 색상(수집됨) + 본인 진영 색상을 반반씩 섞어서 파이차트로 생성!
    colors.add(myBaseColor);
    
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
      // 직관적이고 세련된 메타데이터 노드 분리 처리를 위한 정규식 패턴 판별
      const isDateMeta = /^\d{4}\([가-힣]\)|^\d{2,4}[\.\-\/\s월]*\d{1,2}[\.\-\/\s일]*\d{0,2}|^\d{1,2}월\s*\d{1,2}일|\d{2}:\d{2}|^\d{1,2}시(?:\s*\d{1,2}분)?$|^\d{4}년/.test(labelText) || labelText.includes('요일');
      const isPhoneMeta = /^0\d{1,2}-\d{3,4}-\d{4}/.test(labelText);
      const isMetaNode = isDateMeta || isPhoneMeta;

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

    if (this.hoveredEdge) {
      this.callbacks.onEdgeClick?.(this.hoveredEdge);
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
    
    let hwEdge: OntologyEdge | null = null;
    if (!hit && this.activeNode) {
      const activeId = this.activeNode.id;
      for (const edge of this.edges) {
        if (edge.source === activeId || edge.target === activeId) {
          const src = this.nodeMap.get(edge.source);
          const tgt = this.nodeMap.get(edge.target);
          if (!src || !tgt) continue;
          
          const midX = (src.renderX + tgt.renderX) / 2;
          const midY = (src.renderY + tgt.renderY) / 2;
          if (Math.hypot(mx - midX, my - midY) < 14) {
            hwEdge = edge;
            break;
          }
        }
      }
    }
    this.hoveredEdge = hwEdge;
  }

  handleWheel(delta: number): void {
    const zoomFactor = delta > 0 ? 0.92 : 1.08;
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom * zoomFactor));
  }

  // ── Interaction ──

  handleDragStart(nx: number, ny: number, isShiftKey: boolean = false): void {
    this.isDragging = true;
    this.hasDragged = false;
    this.dragStartX = nx;
    this.dragStartY = ny;
    this.lastDragX = nx;
    this.lastDragY = ny;
    this.dragStartTilt = this.cameraTilt;
    this.draggedNode = null;
    this.draggedSubTree = [];

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
      
      // Shift 키(카테고리 묶음 이동) 기능 작동 시 소속된 모든 트리를 이동합니다
      if (isShiftKey) {
        const descendants = new Set<string>();
        const queue = [closestId];
        
        while (queue.length > 0) {
          const currId = queue.shift()!;
          for (const edge of this.edges) {
            if (edge.source === currId) {
              const tgtId = edge.target;
              if (tgtId !== closestId && !descendants.has(tgtId) && tgtId !== 'root-HCHPS') {
                descendants.add(tgtId);
                queue.push(tgtId);
              }
            }
          }
        }
        
        const rootWX = (this.draggedNode.fixedX ?? this.draggedNode.worldX) ?? 0;
        const rootWY = (this.draggedNode.fixedY ?? this.draggedNode.worldY) ?? 0;
        
        descendants.forEach(id => {
          const dn = this.nodeMap.get(id);
          if (dn) {
            this.draggedSubTree.push({
              node: dn,
              dx0: ((dn.fixedX ?? dn.worldX) ?? 0) - rootWX,
              dy0: ((dn.fixedY ?? dn.worldY) ?? 0) - rootWY,
            });
          }
        });
      }
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
        this.draggedNode.worldX = worldX;
        this.draggedNode.worldY = worldY;
        
        // 하위 그룹 동반 이동 시각화
        for (const item of this.draggedSubTree) {
          const childWX = worldX + item.dx0;
          const childWY = worldY + item.dy0;
          item.node.fixedX = childWX;
          item.node.fixedY = childWY;
          item.node.worldX = childWX;
          item.node.worldY = childWY;
        }
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

  handleDragEnd(): void {
    this.isDragging = false;
    
    if (this.hasDragged && this.draggedNode && typeof this.draggedNode.fixedX === 'number' && typeof this.draggedNode.fixedY === 'number') {
      if (this.draggedSubTree.length > 0) {
        // 퍼포먼스(Undo 로깅 수 최소화)를 위한 일괄 배치 업데이트
        const pins = [{ id: this.draggedNode.id, fixedX: this.draggedNode.fixedX, fixedY: this.draggedNode.fixedY }];
        for (const item of this.draggedSubTree) {
          if (typeof item.node.fixedX === 'number' && typeof item.node.fixedY === 'number') {
            pins.push({ id: item.node.id, fixedX: item.node.fixedX, fixedY: item.node.fixedY });
          }
        }
        this.callbacks.onNodeBatchPin?.(pins);
      } else {
        this.callbacks.onNodePin?.(this.draggedNode.id, this.draggedNode.fixedX, this.draggedNode.fixedY);
      }
    }
    
    this.draggedNode = null;
    this.draggedSubTree = [];
    this.hasDragged = false;
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
