import { OrbitalNode, OntologyEdge, OntologyGroup, GROUP_COLORS } from '../ontology.types';
import { CULL_MARGIN, OntologyLayout } from './OntologyLayout';

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  canvasW: number;
  canvasH: number;
  zoom: number;
  orbitRadii: number[];
  nodes: OrbitalNode[];
  edges: OntologyEdge[];
  nodeMap: Map<string, OrbitalNode>;
  activeNodeId: string | null;
  hoveredNodeId: string | null;
  activeTreeSet: Set<string>;
  centerNode: OrbitalNode | null;
  sortedNodesBuffer: OrbitalNode[];
  collapsedNodeIds: Set<string>;
}

export class OntologyRenderer {
  public static render(context: RenderContext): void {
    const { ctx, canvasW, canvasH } = context;

    this.renderBackground(ctx, canvasW, canvasH);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    this.renderEdges(context);
    this.renderNodes(context);
  }

  private static renderBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#f8fafc'; // slate-50 background
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const bgGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.8);
    bgGlow.addColorStop(0, 'rgba(255,255,255,0.8)');
    bgGlow.addColorStop(1, 'rgba(241,245,249,0)');
    ctx.fillStyle = bgGlow;
    ctx.fillRect(0, 0, width, height);
  }

  private static renderEdges(rc: RenderContext): void {
    const { ctx, edges, nodeMap, activeNodeId, activeTreeSet, canvasW, canvasH } = rc;

    // 노트북LM 스타일은 직선이나 꺾은선 대신 부드러운 베지어 곡선을 사용합니다.
    for (const edge of edges) {
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) continue;
      if (src.layoutHidden || tgt.layoutHidden) continue;

      let leftNode = src;
      let rightNode = tgt;
      if (src.renderX > tgt.renderX) {
        leftNode = tgt;
        rightNode = src;
      }

      // 접힌 노드 자식으로 가는 엣지는 그리지 않음
      if (rc.collapsedNodeIds.has(leftNode.id)) continue;
      
      const isConnected = activeNodeId && activeTreeSet.has(src.id) && activeTreeSet.has(tgt.id);

      // Frustum cull
      if (src.renderX < -CULL_MARGIN && tgt.renderX < -CULL_MARGIN) continue;
      if (src.renderX > canvasW + CULL_MARGIN && tgt.renderX > canvasW + CULL_MARGIN) continue;
      if (src.renderY < -CULL_MARGIN && tgt.renderY < -CULL_MARGIN) continue;
      if (src.renderY > canvasH + CULL_MARGIN && tgt.renderY > canvasH + CULL_MARGIN) continue;

      // Smooth step bezier variables (좌에서 우로)
      // 콤팩트해진 텍스트 박스 크기에 맞춰 선의 시작점을 안쪽으로 축소
      const leftRightX = leftNode.renderX + 30 * rc.zoom;
      const rightLeftX = rightNode.renderX - 30 * rc.zoom;
      
      const cpDist = Math.max(15, Math.abs(rightLeftX - leftRightX) / 2);
      
      // 엣지 색상 조절 (연결된 선명도와 채도 낮춤)
      const alpha = isConnected ? 0.5 : 0.2;
      ctx.strokeStyle = isConnected ? `rgba(96, 165, 250, ${alpha})` : `rgba(148, 163, 184, ${alpha})`;
      ctx.lineWidth = isConnected ? 1.5 * rc.zoom : 1 * rc.zoom;
      if (edge.weight < 0) ctx.setLineDash([4, 4]);
      else ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(leftRightX, leftNode.renderY);
      ctx.bezierCurveTo(
        leftRightX + cpDist, leftNode.renderY,
        rightLeftX - cpDist, rightNode.renderY,
        rightLeftX, rightNode.renderY
      );
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  private static getDepthColor(orbitIndex: number | undefined): { bg: string, border: string, text: string } {
    const idx = orbitIndex ?? 0;
    if (idx === 0) {
      // Root: Pastel Purple
      return { bg: '#EDE9FE', border: '#C4B5FD', text: '#5B21B6' };
    } else if (idx === 1) {
      // Depth 1: Pastel Blue
      return { bg: '#E0F2FE', border: '#BAE6FD', text: '#0369A1' };
    } else if (idx === 2) {
      // Depth 2: Pastel Green
      return { bg: '#D1FAE5', border: '#A7F3D0', text: '#047857' };
    } else {
      // Depth 3+: Pastel Gray/Slate
      return { bg: '#F1F5F9', border: '#CBD5E1', text: '#475569' };
    }
  }

  private static renderNodes(rc: RenderContext): void {
    const { ctx, sortedNodesBuffer, nodes, activeNodeId, hoveredNodeId, activeTreeSet, canvasW, canvasH, zoom } = rc;

    sortedNodesBuffer.length = 0;
    for (const n of nodes) sortedNodesBuffer.push(n);

    // Render from front to back? Flat UI has no real Z, but active nodes render on top
    sortedNodesBuffer.sort((a, b) => {
      if (a.id === activeNodeId) return 1;
      if (b.id === activeNodeId) return -1;
      return (a.orbitIndex || 0) - (b.orbitIndex || 0);
    });

    for (const node of sortedNodesBuffer) {
      if (node.layoutHidden) continue;
      if (node.renderX < -CULL_MARGIN || node.renderX > canvasW + CULL_MARGIN) continue;
      if (node.renderY < -CULL_MARGIN || node.renderY > canvasH + CULL_MARGIN) continue;

      const isActive = node.id === activeNodeId;
      const isTreeActive = activeNodeId && activeTreeSet.has(node.id);
      const isHovered = node.id === hoveredNodeId;
      const opacity = (!activeNodeId || isTreeActive || isActive) ? 1 : 0.3;

      ctx.save();
      ctx.globalAlpha = opacity;

      const labelText = node.label || '';
      
      // NotebookLM 스타일: 콤팩트한 노드 사이즈
      const fontSize = 12 * zoom;
      ctx.font = `${(isActive || isTreeActive) ? '600' : '500'} ${fontSize}px 'Pretendard', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const paddingX = 14 * zoom; // 좌우 여백 (기존 24 -> 14)
      const paddingY = 10 * zoom; // 상하 여백 (기존 16 -> 10)
      const textWidth = ctx.measureText(labelText).width;
      
      // Node Dimensions
      const boxW = Math.max(60 * zoom, textWidth + paddingX * 2); // 100 -> 60
      const boxH = Math.max(28 * zoom, fontSize + paddingY * 2);  // 40 -> 28

      
      const colors = this.getDepthColor(node.orbitIndex);

      // Shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
      ctx.shadowBlur = 8 * zoom;
      ctx.shadowOffsetY = 2 * zoom;

      // Box Draw
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(node.renderX - boxW / 2, node.renderY - boxH / 2, boxW, boxH, 6 * zoom);
      } else {
        ctx.rect(node.renderX - boxW / 2, node.renderY - boxH / 2, boxW, boxH);
      }
      
      ctx.fillStyle = colors.bg;
      ctx.fill();

      // Border
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = (isActive || isTreeActive || isHovered) ? 2 * zoom : 1.5 * zoom;
      // 테두리 채도/명도 완화: 3B82F6 -> 60A5FA
      ctx.strokeStyle = (isActive || isTreeActive) ? '#60A5FA' : (isHovered ? '#94A3B8' : colors.border);
      ctx.stroke();

      // Text
      // 텍스트 활성 색상 완화: 1D4ED8 -> 3B82F6
      ctx.fillStyle = (isActive || isTreeActive) ? '#3B82F6' : colors.text;
      ctx.fillText(labelText, node.renderX, node.renderY);

      // NotebookLM Style: Expand/Collapse Arrow Badge
      const children = OntologyLayout.lastTreeChildrenMap.get(node.id) || [];
      const hasChildren = children.length > 0;
      if (hasChildren) {
        const isCollapsed = rc.collapsedNodeIds.has(node.id);
        const badgeRadius = 8 * zoom; // 11 -> 8
        // Position it entirely outside the right edge of the box (with gap)
        const badgeX = node.renderX + boxW / 2 + badgeRadius + (4 * zoom); // 8 -> 4
        const badgeY = node.renderY;
        
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
        ctx.fillStyle = isCollapsed ? colors.bg : '#ffffff'; 
        ctx.fill();
        ctx.lineWidth = 1.5 * zoom;
        ctx.strokeStyle = colors.border;
        ctx.stroke();

        ctx.fillStyle = colors.text;
        // Use a sans-serif font for arrows to match standard NotebookLM aesthetic
        ctx.font = `bold ${9 * zoom}px sans-serif`;
        // Draw > if collapsed (can expand), < if expanded (can collapse)
        ctx.fillText(isCollapsed ? '>' : '<', badgeX, badgeY + Math.max(1, 1 * zoom));
      }

      node.nodeRadius = (boxW / 2) / zoom;

      ctx.restore();
    }
  }
}
