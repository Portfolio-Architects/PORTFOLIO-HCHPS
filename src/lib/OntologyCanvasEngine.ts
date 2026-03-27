/**
 * Ontology Canvas Engine — Layer 3
 * Pure Canvas 2D Orbital Rendering (No React dependency)
 */

import {
  OntologyNode, OntologyEdge, OntologyGraph, OrbitalNode,
  GROUP_COLORS, OntologyGroup, EDGE_TYPE_DASH, EdgeType,
} from './ontology.types';

// ============ Constants ============

const NUM_ORBITS = 8;
const ELLIPSE_RATIO = 1.3;  // tilted 2D ellipse
const MIN_NODE_R = 3;
const MAX_NODE_R = 24;
const ORBIT_SPEED_BASE = 0.0004;  // slow gentle orbit
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
  onNodeDragged?: (nodeId: string, fixedX: number, fixedY: number) => void;
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
  private targetOffsetX = 0;
  private targetOffsetY = 0;

  // Physics / Interaction
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartTilt = 0;
  private draggedNode: OrbitalNode | null = null;

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

  init(graph: OntologyGraph, callbacks?: EngineCallbacks): void {
    this.callbacks = callbacks || {};
    this.edges = graph.edges;
    this.nodeCount = graph.nodes.length;
    this.edgeCount = graph.edges.length;

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

    // Non-center nodes sorted by connection to center
    const otherNodes = sorted.slice(1).sort(
      (a, b) => (connectionMap.get(b.id) ?? 0) - (connectionMap.get(a.id) ?? 0)
    );

    const nodesPerOrbit = Math.max(1, Math.ceil(otherNodes.length / NUM_ORBITS));

    // Build orbital nodes
    this.nodes = [];
    this.nodeMap.clear();

    // Center node
    const centerOrbital = this.makeOrbitalNode(sorted[0], 0, 0, centerId, connectionMap);
    this.nodes.push(centerOrbital);
    this.centerNode = centerOrbital;
    this.nodeMap.set(centerOrbital.id, centerOrbital);
    // Categories (Orbit 1) and Leaves (Orbit 2+)
    const categoryNodes = otherNodes.filter(n => !n.parentId);
    const leafNodes = otherNodes.filter(n => n.parentId);

    const categoryCount = categoryNodes.length;
    
    // 1. Place Categories on Orbit 1 radially evenly
    categoryNodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i / categoryCount);
      const orbital = this.makeOrbitalNode(node, 1, angle, centerId, connectionMap);
      this.nodes.push(orbital);
      this.nodeMap.set(orbital.id, orbital);
    });

    // 2. Place Leaves on Orbit 2, 3, 4 aligned with Parent
    const leavesByParent = new Map<string, OntologyNode[]>();
    leafNodes.forEach(node => {
      if (!node.parentId) return;
      if (!leavesByParent.has(node.parentId)) leavesByParent.set(node.parentId, []);
      leavesByParent.get(node.parentId)!.push(node);
    });

    leavesByParent.forEach((leaves, parentId) => {
      const parent = this.nodeMap.get(parentId);
      if (!parent) return; 

      // Leaves are already sorted by centrality/frequency
      leaves.forEach((node, idx) => {
        // Distribute outwards: Orbit 2, 3, 4, 5...
        const orbitIndex = Math.min(NUM_ORBITS, 2 + Math.floor(idx * 0.5));
        
        // Exact same angle and speed as parent category to form a straight ray
        const orbital = this.makeOrbitalNode(node, orbitIndex, parent.orbitAngle, centerId, connectionMap);
        orbital.orbitSpeed = parent.orbitSpeed; 
        
        this.nodes.push(orbital);
        this.nodeMap.set(orbital.id, orbital);
      });
    });

    // Set active to center
    this.activeNode = this.centerNode;
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
    // Inner orbits rotate faster
    const speedFactor = orbitIndex === 0 ? 0 : (1 - (orbitIndex - 1) / NUM_ORBITS) * 0.6 + 0.4;
    // Small random variation
    const speedVariation = 0.85 + Math.random() * 0.3;

    return {
      ...node,
      orbitIndex,
      orbitAngle: angle,
      orbitSpeed: orbitIndex === 0 ? 0 : ORBIT_SPEED_BASE * speedFactor * speedVariation,
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

    // Update orbital angles
    for (const node of this.nodes) {
      if (node.orbitIndex === 0) continue;
      node.orbitAngle += node.orbitSpeed;
    }

    // ── Radial Tech Tree Mode: Disable Force Relaxation ──
    // Because we specifically want the nodes to align perfectly in clock-hands (rays)
    // we skip the spring physics to maintain pure geometric alignment.
    /* 
    if (this.forceTickCount < FORCE_WARMUP_TICKS) {
      this.forceTickCount++;
      const progress = this.forceTickCount / FORCE_WARMUP_TICKS;
      const alpha = FORCE_ALPHA * (1 - progress); 
      this.applyForces(alpha);
    } 
    */
  }

  private applyForces(alpha: number): void {
    const n = this.nodes.length;
    // Temporary force accumulators
    const fx = new Float64Array(n);
    const fy = new Float64Array(n);

    // Build index map for O(1) lookup (avoids O(n) indexOf in loop)
    const idxMap = new Map<string, number>();
    for (let i = 0; i < n; i++) idxMap.set(this.nodes[i].id, i);

    // 1. Charge repulsion (all pairs)
    for (let i = 0; i < n; i++) {
      const a = this.nodes[i];
      if (a.orbitIndex === 0) continue; // skip center
      const ax = a.renderX;
      const ay = a.renderY;

      for (let j = i + 1; j < n; j++) {
        const b = this.nodes[j];
        if (b.orbitIndex === 0) continue;

        const dx = ax - b.renderX;
        const dy = ay - b.renderY;
        const distSq = dx * dx + dy * dy + 1; // +1 to avoid zero
        const dist = Math.sqrt(distSq);

        // Coulomb force: F = charge / dist²
        const force = CHARGE_STRENGTH * alpha / distSq;
        const forceX = (dx / dist) * force;
        const forceY = (dy / dist) * force;

        fx[i] -= forceX;
        fy[i] -= forceY;
        fx[j] += forceX;
        fy[j] += forceY;
      }
    }

    // 2. Link attraction (edges only)
    for (const edge of this.edges) {
      const src = this.nodeMap.get(edge.source);
      const tgt = this.nodeMap.get(edge.target);
      if (!src || !tgt) continue;
      if (src.orbitIndex === 0 || tgt.orbitIndex === 0) continue;

      const srcIdx = idxMap.get(edge.source) ?? -1;
      const tgtIdx = idxMap.get(edge.target) ?? -1;
      if (srcIdx < 0 || tgtIdx < 0) continue;

      const dx = tgt.renderX - src.renderX;
      const dy = tgt.renderY - src.renderY;
      const dist = Math.sqrt(dx * dx + dy * dy + 1);
      const strength = LINK_STRENGTH * Math.abs(edge.weight) * alpha;

      fx[srcIdx] += dx * strength;
      fy[srcIdx] += dy * strength;
      fx[tgtIdx] -= dx * strength;
      fy[tgtIdx] -= dy * strength;
    }

    // 3. Apply forces → velocity → offset
    for (let i = 0; i < n; i++) {
      const node = this.nodes[i];
      if (node.orbitIndex === 0) continue; // center is pinned

      let vx = (this.velocityX.get(node.id) || 0) + fx[i];
      let vy = (this.velocityY.get(node.id) || 0) + fy[i];

      // Damping
      vx *= DAMPING;
      vy *= DAMPING;

      // Clamp velocity
      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed > MAX_VELOCITY) {
        vx = (vx / speed) * MAX_VELOCITY;
        vy = (vy / speed) * MAX_VELOCITY;
      }

      this.velocityX.set(node.id, vx);
      this.velocityY.set(node.id, vy);

      // Update offset from orbital base position
      const ox = (this.forceOffsetX.get(node.id) || 0) + vx;
      const oy = (this.forceOffsetY.get(node.id) || 0) + vy;

      // Restoring spring: keep offsets small (nodes stay on orbits)
      const maxOffset = 40;
      this.forceOffsetX.set(node.id, ox * 0.99);
      this.forceOffsetY.set(node.id, oy * 0.99);

      // Clamp max offset
      if (Math.abs(ox) > maxOffset) this.forceOffsetX.set(node.id, Math.sign(ox) * maxOffset);
      if (Math.abs(oy) > maxOffset) this.forceOffsetY.set(node.id, Math.sign(oy) * maxOffset);
    }
  }

  // ============ Compute Positions ============

  private computePositions(canvasW: number, canvasH: number): void {
    const cx = canvasW / 2 + this.cameraOffsetX;
    const cy = canvasH / 2 + this.cameraOffsetY;
    const cosTilt = Math.cos(this.cameraTilt);
    const sinTilt = Math.sin(this.cameraTilt);

    // Orbit radii — wide spread for 100-node readability
    const baseRadius = Math.min(canvasW, canvasH) * 0.58;
    this.orbitRadii = Array.from({ length: NUM_ORBITS + 1 }, (_, i) =>
      i === 0 ? 0 : baseRadius * (0.18 + (i / NUM_ORBITS) * 0.82)
    );

    for (const node of this.nodes) {
      // 1. Orbital position
      let worldX = 0;
      let worldY = 0;

      if (node.fixedX !== undefined && node.fixedY !== undefined) {
        worldX = node.fixedX;
        worldY = node.fixedY;
      } else {
        const orbR = this.orbitRadii[node.orbitIndex];
        const orbitX = Math.cos(node.orbitAngle) * orbR * ELLIPSE_RATIO;
        const orbitY = Math.sin(node.orbitAngle) * orbR;
        // Apply offset forces (if any)
        worldX = orbitX + (this.forceOffsetX.get(node.id) ?? 0);
        worldY = orbitY + (this.forceOffsetY.get(node.id) ?? 0);
      }

      // Map to isometric/tilted 3D space
      // Apply camera tilt
      const tiltedY = worldY * Math.cos(this.cameraTilt);
      const renderZ = worldY * Math.sin(this.cameraTilt) / 500; 

      node.renderX = cx + worldX * this.zoom;
      node.renderY = cy + tiltedY * this.zoom;
      node.renderZ = renderZ;
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

    ctx.strokeStyle = 'rgba(170,180,200,0.10)';
    ctx.lineWidth = 1;

    for (let i = 1; i <= NUM_ORBITS; i++) {
      const rx = this.orbitRadii[i] * ELLIPSE_RATIO * this.zoom;
      const ry = this.orbitRadii[i] * cosTilt * this.zoom;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, rx, ry, 0, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }

  private renderEdges(ctx: CanvasRenderingContext2D): void {
    const activeId = this.activeNode?.id ?? null;
    const w = this.canvasW;
    const h = this.canvasH;

    // When a node is selected, only draw connected edges + faint others
    // This dramatically reduces draw calls from 200 to ~20
    for (const edge of this.edges) {
      const src = this.nodeMap.get(edge.source);
      const tgt = this.nodeMap.get(edge.target);
      if (!src || !tgt) continue;

      const isConnected = activeId && (edge.source === activeId || edge.target === activeId);

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

      let lineWidth = 0.5 + absWeight * 2;
      if (isNegative) lineWidth *= 1.5;
      if (isConnected) lineWidth *= 1.3;

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
      ctx.setLineDash(isNegative ? [4, 3] : EDGE_TYPE_DASH[edge.type] || []);
      ctx.beginPath();
      ctx.moveTo(src.renderX, src.renderY);
      ctx.lineTo(tgt.renderX, tgt.renderY);
      ctx.stroke();

      if (edge.type === 'CAUSAL_DRIVE' && isConnected) {
        this.drawArrow(ctx, src, tgt, lineWidth, ctx.strokeStyle);
      }
    }

    // If active node selected, draw remaining edges as ultra-faint batch
    if (activeId) {
      ctx.strokeStyle = 'rgba(200,200,210,0.04)';
      ctx.lineWidth = 0.5;
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

  private renderNodes(ctx: CanvasRenderingContext2D): void {
    // Reuse sorted buffer (avoid allocation)
    this.sortedNodes.length = 0;
    for (const n of this.nodes) this.sortedNodes.push(n);
    this.sortedNodes.sort((a, b) => a.renderZ - b.renderZ);
    const sorted = this.sortedNodes;
    const activeId = this.activeNode?.id;
    const hoveredId = this.hoveredNode?.id;
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
      // O(1) connection check via pre-built Set
      const isConnectedToActive = activeId ? this.connectionSet.has(node.id + '|||' + activeId) : false;
      const hasActiveSelection = !!activeId && activeId !== this.centerNode?.id;

      const depthAlpha = 0.4 + (node.renderZ + 1) * 0.3;
      const baseColor = GROUP_COLORS[node.group as OntologyGroup] || GROUP_COLORS.OTHER;

      // Determine opacity
      let opacity = hasActiveSelection
        ? (isActive || isConnectedToActive ? 1 : 0.12)
        : depthAlpha;

      if (isHovered && !isActive) opacity = Math.max(opacity, 0.9);

      ctx.save();
      ctx.globalAlpha = opacity;

      // ── Center Sun ──
      if (isCenter) {
        // Large glow
        const glow = ctx.createRadialGradient(
          node.renderX, node.renderY, r * 0.5,
          node.renderX, node.renderY, r * 6,
        );
        glow.addColorStop(0, this.colorWithAlpha(baseColor, 0.12));
        glow.addColorStop(0.5, this.colorWithAlpha(baseColor, 0.04));
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(node.renderX, node.renderY, r * 6, 0, 2 * Math.PI);
        ctx.fill();

        // Corona
        const corona = ctx.createRadialGradient(
          node.renderX, node.renderY, r * 0.8,
          node.renderX, node.renderY, r * 2.5,
        );
        corona.addColorStop(0, this.colorWithAlpha(baseColor, 0.25));
        corona.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = corona;
        ctx.beginPath();
        ctx.arc(node.renderX, node.renderY, r * 2.5, 0, 2 * Math.PI);
        ctx.fill();

        // 3D Highlight Layer
        const baseR = node.nodeRadius * this.zoom;
        const x = node.renderX;
        const y = node.renderY;
        const sizeOverride = (this.activeNode && this.activeNode.id === node.id) ? baseR * 1.5 : (isHovered ? baseR * 1.2 : baseR);

        // Check if there is a custom color set
        const nodeColor = node.customColor || GROUP_COLORS[node.group as OntologyGroup];

        const gradient = ctx.createRadialGradient(
          x - sizeOverride * 0.3, y - sizeOverride * 0.3, 0,
          x, y, sizeOverride
        );
        gradient.addColorStop(0, '#ffffff'); // bright spot
        gradient.addColorStop(0.3, nodeColor);
        gradient.addColorStop(1, '#000000'); // shadow edge
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.renderX, node.renderY, r, 0, 2 * Math.PI);
        ctx.fill();

        // White border
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();

      // ── Active Node ──
      } else if (isActive) {
        // Glow
        const glow = ctx.createRadialGradient(
          node.renderX, node.renderY, r * 0.5,
          node.renderX, node.renderY, r * 3,
        );
        glow.addColorStop(0, this.colorWithAlpha(baseColor, 0.15));
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(node.renderX, node.renderY, r * 3, 0, 2 * Math.PI);
        ctx.fill();

        // Core with gradient
        const coreGrad = ctx.createRadialGradient(
          node.renderX - r * 0.15, node.renderY - r * 0.15, 0,
          node.renderX, node.renderY, r,
        );
        coreGrad.addColorStop(0, '#ffffff');
        coreGrad.addColorStop(0.5, this.lightenColor(baseColor, 0.5));
        coreGrad.addColorStop(1, baseColor);
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(node.renderX, node.renderY, r, 0, 2 * Math.PI);
        ctx.fill();

        // Border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(node.renderX, node.renderY, r + 3, 0, 2 * Math.PI);
        ctx.stroke();

      // ── Normal / Hovered / Connected ──
      } else {
        // Hover glow
        if (isHovered) {
          const glow = ctx.createRadialGradient(
            node.renderX, node.renderY, r * 0.5,
            node.renderX, node.renderY, r * 2,
          );
          glow.addColorStop(0, this.colorWithAlpha(baseColor, 0.12));
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(node.renderX, node.renderY, r * 2, 0, 2 * Math.PI);
          ctx.fill();
        }

        // Core
        const coreGrad = ctx.createRadialGradient(
          node.renderX - r * 0.15, node.renderY - r * 0.15, 0,
          node.renderX, node.renderY, r,
        );
        coreGrad.addColorStop(0, this.lightenColor(baseColor, 0.4));
        coreGrad.addColorStop(1, baseColor);
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(node.renderX, node.renderY, r, 0, 2 * Math.PI);
        ctx.fill();

        // Connected highlight ring
        if (isConnectedToActive) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
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

      // ── Label — Always Visible Full Text ──
      const isActiveOrHovered = isActive || isHovered;
      const fontSize = Math.max(8, Math.min(12, 9 * this.zoom));
      const fontWeight = (isCenter || isActive) ? 'bold' : 'normal';
      
      ctx.font = `${fontWeight} ${fontSize}px 'Pretendard', 'Inter', system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // No truncation: show full label
      const label = node.label;

      const labelY = node.renderY + r + 3;

      // Always show label regardless of occlusion or zoom
      ctx.fillStyle = isCenter || isActiveOrHovered
        ? '#1e293b'
        : `rgba(30,41,59,${Math.max(0.6, opacity)})`;
        
      ctx.fillText(label, node.renderX, labelY);

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
    const hit = this.hitTest(mx, my);
    if (hit) {
      if (this.activeNode?.id === hit.id) {
        // Toggle off → back to center
        this.activeNode = this.centerNode;
        this.targetOffsetX = 0;
        this.targetOffsetY = 0;
      } else {
        this.activeNode = hit;
        // Center clicked node on screen
        const screenCenterX = this.canvasW / 2;
        const screenCenterY = this.canvasH / 2;
        this.targetOffsetX = screenCenterX - (hit.renderX - this.cameraOffsetX);
        this.targetOffsetY = screenCenterY - (hit.renderY - this.cameraOffsetY);
      }
    } else {
      // Click empty space → reset
      this.activeNode = this.centerNode;
      this.targetOffsetX = 0;
      this.targetOffsetY = 0;
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
    this.dragStartX = nx;
    this.dragStartY = ny;
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

    if (this.draggedNode) {
      // Inverse projection to find World X, Y
      const cx = w / 2 + this.cameraOffsetX;
      const cy = h / 2 + this.cameraOffsetY;
      const worldX = (nx - cx) / this.zoom;
      const worldY = (ny - cy) / this.zoom / Math.cos(this.cameraTilt);
      
      this.draggedNode.fixedX = worldX;
      this.draggedNode.fixedY = worldY;
    } else {
      // Camera Tilt
      const dy = ny - this.dragStartY;
      const tiltSensitivity = 0.005;
      this.cameraTilt = this.dragStartTilt + dy * tiltSensitivity;
      this.cameraTilt = Math.max(0, Math.min(Math.PI / 2.5, this.cameraTilt));
    }
  }

  handleDragEnd(): void {
    if (this.draggedNode) {
      // Fire callback to save the pinned position
      this.callbacks.onNodeDragged?.(this.draggedNode.id, this.draggedNode.fixedX!, this.draggedNode.fixedY!);
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
