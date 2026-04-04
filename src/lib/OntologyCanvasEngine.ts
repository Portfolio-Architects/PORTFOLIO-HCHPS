/**
 * Ontology Canvas Engine — Layer 3
 * Pure Canvas 2D Orbital Rendering (No React dependency)
 */

import {
  OntologyNode, OntologyEdge, OntologyGraph, OrbitalNode,
  GROUP_COLORS, OntologyGroup, EdgeType,
} from './ontology.types';
import { OntologyNetwork } from './engine/OntologyNetwork';
import { OntologyRenderer } from './engine/OntologyRenderer';

import {
  OntologyLayout,
  NUM_ORBITS,
  ELLIPSE_RATIO,
  MIN_NODE_R,
  MAX_NODE_R,
  ORBIT_SPEED_BASE,
  LERP_SPEED,
  MIN_ZOOM,
  MAX_ZOOM,
  MIN_TILT,
  MAX_TILT,
  CULL_MARGIN,
} from './engine/OntologyLayout';

// ============ Callbacks ============

export interface EngineCallbacks {
  onActiveNodeChange?: (node: OrbitalNode | null) => void;
  onHoveredNodeChange?: (node: OrbitalNode | null) => void;
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

  // Camera
  zoom = 1;
  targetZoom = 1;
  public needsRedraw: boolean = true;
  public cameraOffsetX = 0;
  cameraOffsetY = 0;
  targetOffsetX = 0;
  targetOffsetY = 0;
  private autoFitPending = false;
  public collapsedNodeIds: Set<string> = new Set();
  public hasInitializedCollapse: boolean = false;

  // Physics / Interaction
  isOrbiting = false;
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
    this.needsRedraw = true;

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

    // Default to NotebookLM style: collapse everything starting from 1차 카테고리 (orbitIndex >= 1) 
    // so only the center and 1st level nodes are visible initially.
    if (!this.hasInitializedCollapse && this.nodes.length > 0) {
      this.hasInitializedCollapse = true;
      for (const node of this.nodes) {
        if (node.orbitIndex >= 1) {
          this.collapsedNodeIds.add(node.id);
        }
      }
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

  tick(): boolean {
    let isDirty = false;

    // Camera interpolation
    if (Math.abs(this.targetOffsetX - this.cameraOffsetX) > 0.5 || 
        Math.abs(this.targetOffsetY - this.cameraOffsetY) > 0.5 || 
        Math.abs(this.targetZoom - this.zoom) > 0.005) {
      this.cameraOffsetX += (this.targetOffsetX - this.cameraOffsetX) * LERP_SPEED;
      this.cameraOffsetY += (this.targetOffsetY - this.cameraOffsetY) * LERP_SPEED;
      this.zoom += (this.targetZoom - this.zoom) * LERP_SPEED;
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

    return isDirty;
  }



  // ============ Compute Positions ============

    private computePositions(canvasW: number, canvasH: number): void {
    OntologyLayout.computePositions(
      this.nodes,
      this.nodeMap,
      this.edges,
      canvasW,
      canvasH,
      this.cameraOffsetX,
      this.cameraOffsetY,
      this.zoom,
      this.collapsedNodeIds
    );

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

    if (this.autoFitPending) {
      this.autoFitPending = false;
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      for (const node of this.nodes) {
        if (node.layoutHidden) continue;
        minX = Math.min(minX, node.worldX || 0);
        maxX = Math.max(maxX, node.worldX || 0);
        minY = Math.min(minY, node.worldY || 0);
        maxY = Math.max(maxY, node.worldY || 0);
      }
      if (minX !== Infinity) {
        const treeW = maxX - minX;
        const treeH = maxY - minY;
        const sidePanelWidth = 320; // compensate for left UI panel
        const padding = 100;
        const availW = canvasW - sidePanelWidth - padding;
        const availH = canvasH - padding;
        
        let scaleX = availW / (treeW || 1);
        let scaleY = availH / (treeH || 1);
        
        // 1.1(원본 크기보다 아주 약간 큼)를 초과하지 않으며, 최소 MIN_ZOOM 까지만 축소 허용
        let newTargetZoom = Math.min(scaleX, scaleY, 1.1);
        newTargetZoom = Math.max(MIN_ZOOM, newTargetZoom);
        this.targetZoom = newTargetZoom;
        
        const treeCenterX = (maxX + minX) / 2;
        const treeCenterY = (maxY + minY) / 2;
        
        const desiredScreenCenterX = sidePanelWidth + availW / 2;
        const desiredScreenCenterY = canvasH / 2;
        
        this.targetOffsetX = desiredScreenCenterX - (canvasW / 2) - (treeCenterX * newTargetZoom);
        this.targetOffsetY = desiredScreenCenterY - (canvasH / 2) - (treeCenterY * newTargetZoom);
      }
    }
  }

  // ============ Render ============

  render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.canvasW = width;
    this.canvasH = height;
    this.computePositions(width, height);

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
    });
  }

  public getActiveTreeSet(): Set<string> {
    const rootId = this.activeNode?.id;
    if (!rootId) return new Set();
    return OntologyNetwork.getActiveTreeSet(rootId, this.nodeMap, this.edges);
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
      // 1. 접기/펼치기 토글(Chevron) 영역 클릭 감지
      // 노드의 우측 영역(x > renderX + 20) 클릭 시 토글 처리
      const isRightSide = mx > hit.renderX + 20;
      let hasChildren = false;
      for (const edge of this.edges) {
        if (edge.source === hit.id) {
          hasChildren = true;
          break;
        }
      }

      if (hasChildren && isRightSide) {
         if (this.collapsedNodeIds.has(hit.id)) {
             this.collapsedNodeIds.delete(hit.id);
             this.autoFitPending = true;
         } else {
             this.collapsedNodeIds.add(hit.id);
             this.autoFitPending = true;
         }
         this.needsRedraw = true;
         return; // 토글만 수행하고 선택 상태는 변경하지 않음
      }

      // 2. 일반적인 노드 선택
      if (this.activeNode?.id === hit.id) {
        this.activeNode = this.centerNode;
        this.previousActiveNodeId = this.centerNode?.id || null;
      } else {
        this.activeNode = hit;
        this.previousActiveNodeId = hit.id;
        const screenCenterX = this.canvasW / 2;
        const screenCenterY = this.canvasH / 2;
        this.targetOffsetX = screenCenterX - (hit.renderX - this.cameraOffsetX);
        this.targetOffsetY = screenCenterY - (hit.renderY - this.cameraOffsetY);
      }
    } else {
      this.activeNode = this.centerNode;
      this.previousActiveNodeId = this.centerNode?.id || null;
    }
    this.needsRedraw = true;
    this.callbacks.onActiveNodeChange?.(this.activeNode);
  }

  handleHover(mx: number, my: number): void {
    const hit = this.hitTest(mx, my);
    if (hit?.id !== this.hoveredNode?.id) {
      this.hoveredNode = hit;
      this.needsRedraw = true;
      this.callbacks.onHoveredNodeChange?.(hit);
    }
  }

  handleWheel(delta: number): void {
    const zoomFactor = delta > 0 ? 0.92 : 1.08;
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom * zoomFactor));
    this.targetZoom = this.zoom; // 유저가 수동 줌 할 경우 타겟을 덮어써서 물리 애니메이션 방해 차단
    this.needsRedraw = true;
  }

  // ── Interaction ──

  handleDragStart(nx: number, ny: number, isShiftKey: boolean = false): void {
    this.isDragging = true;
    this.hasDragged = false;
    this.dragStartX = nx;
    this.dragStartY = ny;
    this.lastDragX = nx;
    this.lastDragY = ny;
    this.draggedNode = null;
    this.draggedSubTree = [];

    let closestId = null;
    let minDist = Infinity;
    for (const node of this.nodes) {
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

  handleDragMove(nx: number, ny: number, w: number, h: number): void {
    if (!this.isDragging) return;

    if (Math.abs(nx - this.dragStartX) > 5 || Math.abs(ny - this.dragStartY) > 5) {
      this.hasDragged = true;
      this.needsRedraw = true;
    }

    if (this.draggedNode) {
      // 선택지 1: 드래그 앤 드롭 시 자동 정렬 트리를 망가뜨리는 fixedX/fixedY 위치 고정을 비활성화.
      // (TODO: 향후 Reparenting UI로 확장 가능하도록 뼈대만 유지)
      if (this.hasDragged) {
        // 드래그 중인 임시 시각화 정도만 하거나 그대로 둡니다.
        // 현재는 수동 핀 기능을 꺼버렸으므로 Drag 시 카메라 패닝이 되거나 무시되게 합니다.
        // 아무것도 하지 않아서 트리 구조가 견고하게 고정되게 유지합니다.
      }
    } else {
      // Camera Panning
      const dx = nx - this.lastDragX;
      const dy = ny - this.lastDragY;
      
      this.cameraOffsetX += dx;
      this.cameraOffsetY += dy;
      this.targetOffsetX = this.cameraOffsetX; // 수동 드래그 시 카메라 타겟 덮어쓰기
      this.targetOffsetY = this.cameraOffsetY; 
      
      this.needsRedraw = true;
    }
    this.lastDragX = nx;
    this.lastDragY = ny;
  }

  handleDragEnd(): void {
    this.isDragging = false;
    
    if (this.hasDragged && this.draggedNode) {
      // 기존 드래그 종료 시 Yjs에 fixedX/Y를 동기화하던 로직(NodePin)을 비활성화 (선택지 1 정책 반영)
      // 향후 여기에 drop 대상 노드를 찾아 Reparenting 이벤트(onNodeReparent)를 날리는 로직을 넣을 수 있습니다.
    }
    
    this.draggedNode = null;
    this.draggedSubTree = [];
    this.hasDragged = false;
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
}
