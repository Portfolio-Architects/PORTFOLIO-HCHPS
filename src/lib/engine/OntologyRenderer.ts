import { OrbitalNode, OntologyEdge, OntologyGroup, GROUP_COLORS } from '../ontology.types';
import { CULL_MARGIN } from './OntologyLayout';

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

    // 자식 보유 여부 맵 계산 (토글 렌더링 용도) - 렌더링 X축 기준 좌에서 우로 계산하여 백엔드 데이터에 독립적
    const childrenCount = new Map<string, number>();
    for (const edge of context.edges) {
      const src = context.nodeMap.get(edge.source);
      const tgt = context.nodeMap.get(edge.target);
      if (src && tgt) {
        const parentId = src.renderX < tgt.renderX ? src.id : tgt.id;
        childrenCount.set(parentId, (childrenCount.get(parentId) || 0) + 1);
      }
    }

    this.renderEdges(context);
    this.renderNodes(context, childrenCount);
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
      const leftRightX = leftNode.renderX + 60 * rc.zoom;
      const rightLeftX = rightNode.renderX - 60 * rc.zoom;
      
      const cpDist = Math.max(20, Math.abs(rightLeftX - leftRightX) / 2);
      
      const alpha = isConnected ? 0.8 : 0.3;
      
      ctx.strokeStyle = isConnected ? `rgba(59,130,246,${alpha})` : `rgba(148, 163, 184, ${alpha})`;
      ctx.lineWidth = isConnected ? 2.5 * rc.zoom : 1.5 * rc.zoom;
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

  private static renderNodes(rc: RenderContext, childrenCount: Map<string, number>): void {
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
      const isHovered = node.id === hoveredNodeId;
      const opacity = (!activeNodeId || activeTreeSet.has(node.id) || isActive) ? 1 : 0.3;

      ctx.save();
      ctx.globalAlpha = opacity;

      const labelText = node.label || '';
      
      const fontSize = Math.max(10, Math.min(14, 12 * zoom));
      ctx.font = `${isActive ? '600' : '500'} ${fontSize}px 'Pretendard', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const paddingX = 16 * zoom;
      const paddingY = 12 * zoom;
      const textWidth = ctx.measureText(labelText).width;
      
      // Node Dimensions
      const boxW = Math.max(80 * zoom, textWidth + paddingX * 2);
      const boxH = Math.max(30 * zoom, fontSize + paddingY * 2);
      
      const colors = this.getDepthColor(node.orbitIndex);

      // Shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
      ctx.shadowBlur = 8 * zoom;
      ctx.shadowOffsetY = 2 * zoom;

      // Box Draw
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(node.renderX - boxW / 2, node.renderY - boxH / 2, boxW, boxH, 8 * zoom);
      } else {
        ctx.rect(node.renderX - boxW / 2, node.renderY - boxH / 2, boxW, boxH);
      }
      
      ctx.fillStyle = colors.bg;
      ctx.fill();

      // Border
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = (isActive || isHovered) ? 2 * zoom : 1.5 * zoom;
      ctx.strokeStyle = isActive ? '#3B82F6' : (isHovered ? '#94A3B8' : colors.border);
      ctx.stroke();

      // Text
      ctx.fillStyle = colors.text;
      ctx.fillText(labelText, node.renderX, node.renderY);

      // 접기/펼치기 토글 (Chevron) 그리기
      const count = childrenCount.get(node.id) || 0;
      if (count > 0) {
        const isCollapsed = rc.collapsedNodeIds.has(node.id);
        const chevronRadius = 10 * zoom;
        const cx = node.renderX + boxW / 2 + chevronRadius; // 박스 우측에 배치
        
        ctx.beginPath();
        // 원형 배경
        ctx.arc(cx, node.renderY, chevronRadius, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? '#E2E8F0' : '#F1F5F9';
        ctx.fill();
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1 * zoom;
        ctx.stroke();

        ctx.fillStyle = '#64748B';
        ctx.font = `bold ${10 * zoom}px sans-serif`;
        // + / - 로 간단히 렌더링
        ctx.fillText(isCollapsed ? '+' : '-', cx, node.renderY + 1);

        // 상호작용 감지를 위해 node_radius/크기에 chevron 영역을 임시로 포함시켜주는 것이 엔진 히트박스에서 유리
        // 엔진이 hit test할 때 x오프셋을 확인해야 하지만, 기본적으로 nodeRadius를 박스 절반 길이로 올려주면 드래그/클릭 범주에 포함됨
        node.nodeRadius = (boxW / 2 + chevronRadius * 2) / zoom;
      } else {
        node.nodeRadius = (boxW / 2) / zoom;
      }

      ctx.restore();
    }
  }
}
