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
const ELLIPSE_RATIO = 1.3;
const MIN_NODE_R = 4;
const MAX_NODE_R = 36;
const ORBIT_SPEED_BASE = 0.0012;
const LERP_SPEED = 0.08;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3.0;
const MIN_TILT = 0.26;
const MAX_TILT = 1.31;

// ============ Callbacks ============

export interface EngineCallbacks {
  onActiveNodeChange?: (node: OrbitalNode | null) => void;
  onHoveredNodeChange?: (node: OrbitalNode | null) => void;
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
  cameraTilt = 0.6;
  cameraOffsetX = 0;
  cameraOffsetY = 0;
  private targetOffsetX = 0;
  private targetOffsetY = 0;

  // Drag state
  private isDragging = false;
  private dragStartY = 0;
  private dragStartTilt = 0;

  // Stats
  nodeCount = 0;
  edgeCount = 0;

  // Callbacks
  private callbacks: EngineCallbacks = {};

  // Precomputed
  private orbitRadii: number[] = [];
  private nodeMap = new Map<string, OrbitalNode>();

  // ============ Init ============

  init(graph: OntologyGraph, callbacks?: EngineCallbacks): void {
    this.callbacks = callbacks || {};
    this.edges = graph.edges;
    this.nodeCount = graph.nodes.length;
    this.edgeCount = graph.edges.length;

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

    // Orbit nodes
    otherNodes.forEach((node, i) => {
      const orbitIndex = Math.min(NUM_ORBITS, Math.floor(i / nodesPerOrbit) + 1);
      const posInOrbit = i % nodesPerOrbit;
      const countInOrbit = Math.min(nodesPerOrbit, otherNodes.length - Math.floor(i / nodesPerOrbit) * nodesPerOrbit);
      const angle = (2 * Math.PI * posInOrbit / countInOrbit) + (orbitIndex * 0.5);

      const orbital = this.makeOrbitalNode(node, orbitIndex, angle, centerId, connectionMap);
      this.nodes.push(orbital);
      this.nodeMap.set(orbital.id, orbital);
    });

    // Set active to center
    this.activeNode = this.centerNode;
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
  }

  // ============ Compute Positions ============

  private computePositions(canvasW: number, canvasH: number): void {
    const centerX = canvasW / 2 + this.cameraOffsetX;
    const centerY = canvasH / 2 + this.cameraOffsetY;
    const cosTilt = Math.cos(this.cameraTilt);
    const sinTilt = Math.sin(this.cameraTilt);

    // Orbit radii — wider spread for readability
    const baseRadius = Math.min(canvasW, canvasH) * 0.48;
    this.orbitRadii = Array.from({ length: NUM_ORBITS + 1 }, (_, i) =>
      i === 0 ? 0 : baseRadius * (0.12 + (i / NUM_ORBITS) * 0.88)
    );

    for (const node of this.nodes) {
      if (node.orbitIndex === 0) {
        node.renderX = centerX;
        node.renderY = centerY;
        node.renderZ = 0.5;
        continue;
      }
      const orbR = this.orbitRadii[node.orbitIndex];
      const x3d = Math.cos(node.orbitAngle) * orbR * ELLIPSE_RATIO;
      const y3d = Math.sin(node.orbitAngle) * orbR;

      node.renderX = centerX + x3d * this.zoom;
      node.renderY = centerY + y3d * cosTilt * this.zoom;
      node.renderZ = Math.sin(node.orbitAngle) * sinTilt; // -1 to 1
    }
  }

  // ============ Render ============

  render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.computePositions(width, height);

    // 1. Background
    this.renderBackground(ctx, width, height);

    // 2. Orbit tracks
    this.renderOrbitTracks(ctx, width, height);

    // 3. Edges (sorted by avg depth, back-to-front)
    this.renderEdges(ctx);

    // 4. Nodes (sorted by depth, back-to-front)
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

    // Sort by average Z of endpoints (back to front)
    const edgesWithDepth = this.edges.map(edge => {
      const src = this.nodeMap.get(edge.source);
      const tgt = this.nodeMap.get(edge.target);
      const avgZ = ((src?.renderZ ?? 0) + (tgt?.renderZ ?? 0)) / 2;
      return { edge, src, tgt, avgZ };
    }).sort((a, b) => a.avgZ - b.avgZ);

    for (const { edge, src, tgt, avgZ } of edgesWithDepth) {
      if (!src || !tgt) continue;

      const isConnected = activeId && (edge.source === activeId || edge.target === activeId);
      const isNegative = edge.weight < 0;
      const absWeight = Math.abs(edge.weight);

      // Depth-based brightness
      const depthBrightness = 0.3 + (avgZ + 1) * 0.35;

      // Base width
      let lineWidth = 0.5 + absWeight * 2;
      if (isNegative) lineWidth *= 1.5;
      if (isConnected) lineWidth *= 1.3;

      // Opacity
      let alpha = isConnected
        ? Math.max(0.4, depthBrightness * 0.8)
        : activeId
          ? 0.04
          : depthBrightness * 0.25;

      // Color
      let color: string;
      if (isNegative) {
        color = `rgba(229,56,59,${alpha})`;
      } else if (isConnected) {
        color = `rgba(59,130,246,${Math.min(1, alpha * 1.5)})`;
      } else {
        color = `rgba(204,204,204,${alpha})`;
      }

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash(isNegative ? [4, 3] : EDGE_TYPE_DASH[edge.type] || []);
      ctx.beginPath();
      ctx.moveTo(src.renderX, src.renderY);
      ctx.lineTo(tgt.renderX, tgt.renderY);
      ctx.stroke();

      // Arrow for CAUSAL_DRIVE (at 70% from source)
      if (edge.type === 'CAUSAL_DRIVE' && (isConnected || !activeId)) {
        this.drawArrow(ctx, src, tgt, lineWidth, color);
      }

      ctx.restore();
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

  private renderNodes(ctx: CanvasRenderingContext2D): void {
    // Sort back to front
    const sorted = [...this.nodes].sort((a, b) => a.renderZ - b.renderZ);
    const activeId = this.activeNode?.id;
    const hoveredId = this.hoveredNode?.id;

    for (const node of sorted) {
      const r = node.nodeRadius * this.zoom;
      const isCenter = node.orbitIndex === 0;
      const isActive = node.id === activeId;
      const isHovered = node.id === hoveredId;
      const isConnectedToActive = activeId ? this.isConnected(node.id, activeId) : false;
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

        // Core
        const coreGrad = ctx.createRadialGradient(
          node.renderX - r * 0.2, node.renderY - r * 0.2, 0,
          node.renderX, node.renderY, r,
        );
        coreGrad.addColorStop(0, '#ffffff');
        coreGrad.addColorStop(0.6, this.lightenColor(baseColor, 0.7));
        coreGrad.addColorStop(1, baseColor);
        ctx.fillStyle = coreGrad;
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

      // ── Label — Progressive visibility to prevent overlap ──
      // Tier 1: Always show (center, active, hovered)
      // Tier 2: Connected to active node
      // Tier 3: High-importance nodes (baseValue > 80) — only at zoom > 0.8
      // Tier 4: All other nodes — only at zoom > 1.8
      const tier1 = isCenter || isActive || isHovered;
      const tier2 = isConnectedToActive;
      const tier3 = node.baseValue > 80 && this.zoom > 0.8;
      const tier4 = this.zoom > 1.8;
      const showLabel = tier1 || tier2 || tier3 || tier4;

      if (showLabel) {
        const fontSize = Math.max(8, Math.min(12, 9 * this.zoom));
        const fontWeight = (isCenter || isActive) ? 'bold' : 'normal';
        ctx.font = `${fontWeight} ${fontSize}px 'Pretendard', 'Inter', system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Fade labels based on tier
        const labelAlpha = tier1 ? 1 : tier2 ? 0.85 : tier3 ? 0.6 : 0.4;
        ctx.fillStyle = isCenter || isActive
          ? '#1e293b'
          : `rgba(30,41,59,${Math.min(labelAlpha, opacity)})`;

        // Truncate long labels
        const maxChars = isCenter || isActive ? 20 : this.zoom > 1.5 ? 12 : 8;
        const label = node.label.length > maxChars
          ? node.label.slice(0, maxChars) + '..'
          : node.label;
        ctx.fillText(label, node.renderX, node.renderY + r + 3);
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
    const hit = this.hitTest(mx, my);
    if (hit) {
      if (this.activeNode?.id === hit.id) {
        // Toggle off → back to center
        this.activeNode = this.centerNode;
        this.targetOffsetX = 0;
        this.targetOffsetY = 0;
      } else {
        this.activeNode = hit;
        // Camera soft follow (40% toward node)
        const cx = 0; // canvas center offset from 0
        this.targetOffsetX = (0 - (hit.renderX - (0 + this.cameraOffsetX))) * 0.4;
        this.targetOffsetY = (0 - (hit.renderY - (0 + this.cameraOffsetY))) * 0.4;
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

  handleDragStart(my: number): void {
    this.isDragging = true;
    this.dragStartY = my;
    this.dragStartTilt = this.cameraTilt;
  }

  handleDragMove(my: number): void {
    if (!this.isDragging) return;
    const dy = my - this.dragStartY;
    this.cameraTilt = Math.max(MIN_TILT, Math.min(MAX_TILT,
      this.dragStartTilt + dy * 0.003
    ));
  }

  handleDragEnd(): void {
    this.isDragging = false;
  }

  // ============ Queries ============

  isConnected(nodeId: string, targetId: string): boolean {
    return this.edges.some(e =>
      (e.source === nodeId && e.target === targetId) ||
      (e.target === nodeId && e.source === targetId)
    );
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
