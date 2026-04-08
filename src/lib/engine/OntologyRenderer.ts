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
  private static THEME_PALETTES = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#F43F5E', // Rose
    '#84CC16', // Lime
  ];

  public static render(context: RenderContext): void {
    const { ctx, canvasW, canvasH, nodes, centerNode } = context;

    this.assignThemes(nodes, centerNode);

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

      // 양방향 패치 이후 leftNode가 항상 부모인 것이 아니므로 삭제
      // (자식을 가리는 처리는 이미 55번째 줄 layoutHidden 속성에서 방어됨)

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
      
      // 엣지 색상 조절: 자식 노드의 테마 컬러를 따라갑니다.
      const themeColor = tgt.themeColor || '#94A3B8';
      const alpha = isConnected ? 0.6 : 0.15; // 0.2 -> 0.15 로 낮춤
      
      // convert Hex to RGBA easily by trusting context alpha, or use string manipulation
      // To keep it simple, we set globalAlpha
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = themeColor;
      
      // 연결 활성화 시 두께 1.5배 강조
      ctx.lineWidth = isConnected ? 1.5 * rc.zoom : 0.5 * rc.zoom;
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
    ctx.globalAlpha = 1.0;
    ctx.setLineDash([]);
  }

  private static assignThemes(nodes: OrbitalNode[], centerNode: OrbitalNode | null) {
      if (!centerNode) return;
      centerNode.themeColor = '#475569'; // Slate-600 for Root

      const children = OntologyLayout.lastTreeChildrenMap.get(centerNode.id) || [];
      let paletteIdx = 0;
      
      for (const childId of children) {
          const childNode = nodes.find(n => n.id === childId);
          if (childNode) {
              childNode.themeColor = this.THEME_PALETTES[paletteIdx % this.THEME_PALETTES.length];
              paletteIdx++;
              this.cascadeTheme(childNode.id, childNode.themeColor, nodes);
          }
      }
  }

  private static cascadeTheme(parentId: string, color: string, nodes: OrbitalNode[]) {
      const children = OntologyLayout.lastTreeChildrenMap.get(parentId) || [];
      for (const childId of children) {
          const childNode = nodes.find(n => n.id === childId);
          if (childNode) {
              childNode.themeColor = color;
              this.cascadeTheme(childId, color, nodes);
          }
      }
  }

  // Legacy getColorPalette removed -> We use Flat Design and themeColor inheritance

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

      
      const themeColor = node.themeColor || '#94A3B8';

      // Shadow (Slightly softer for flat design)
      ctx.shadowColor = 'rgba(0, 0, 0, 0.04)';
      ctx.shadowBlur = 6 * zoom;
      ctx.shadowOffsetY = 2 * zoom;

      // Box Draw (Clean White Background)
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(node.renderX - boxW / 2, node.renderY - boxH / 2, boxW, boxH, 6 * zoom);
      } else {
        ctx.rect(node.renderX - boxW / 2, node.renderY - boxH / 2, boxW, boxH);
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // Shadow clear
      ctx.shadowColor = 'transparent';

      // Hemisphere Check (좌/우 방향 식별)
      // root 노드 자체(worldX === 0)는 오른쪽 규칙을 따르게 하거나 별도 처리 (여기서는 기본적으로 오른쪽)
      const isLeftSide = (node.worldX || 0) < 0;

      // Color Accent Bar (방향에 따라 좌측 또는 우측 끝에 예쁘게 그려줌)
      ctx.beginPath();
      if (ctx.roundRect) {
        if (isLeftSide) {
          // 좌측 노드: 우측 모서리에 엑센트 (tl, tr, br, bl)
          ctx.roundRect(node.renderX + boxW / 2 - 6 * zoom, node.renderY - boxH / 2, 6 * zoom, boxH, [
            0,
            6 * zoom,
            6 * zoom,
            0
          ]);
        } else {
          // 우측 노드: 좌측 모서리에 엑센트 (tl, tr, br, bl)
          ctx.roundRect(node.renderX - boxW / 2, node.renderY - boxH / 2, 6 * zoom, boxH, [
            6 * zoom,
            0,
            0,
            6 * zoom
          ]);
        }
      } else {
        const ax = isLeftSide ? (node.renderX + boxW / 2 - 6 * zoom) : (node.renderX - boxW / 2);
        ctx.rect(ax, node.renderY - boxH / 2, 6 * zoom, boxH);
      }
      ctx.fillStyle = themeColor;
      ctx.fill();

      // Text (Slate-800 / Slate-500)
      // 활성화된 텍스트는 좀 더 진하고 볼드하게, 비활성화된 노드는 살짝 연하게
      ctx.fillStyle = (isActive || isTreeActive) ? '#1E293B' : '#64748B';
      // 텍스트 쏠림 보정 (엑센트 바 피하기)
      const textOffsetX = isLeftSide ? -2 * zoom : 2 * zoom;
      ctx.fillText(labelText, node.renderX + textOffsetX, node.renderY); 

      // Personal CRM: Mood Badge (결재 기상도)
      if (node.currentMood) {
        const moodIcons: Record<string, string> = {
          'SUNNY': '☀️',
          'CLOUDY': '☁️',
          'RAINY': '☔️',
          'STORM': '⚡️'
        };
        const moodIcon = moodIcons[node.currentMood];
        if (moodIcon) {
          ctx.font = `${10 * zoom}px sans-serif`;
          // Draw badge on the top edge (slightly offset from the center)
          const moodBadgeX = node.renderX + (isLeftSide ? -boxW/2 + 10*zoom : boxW/2 - 10*zoom);
          const moodBadgeY = node.renderY - boxH / 2;
          
          ctx.beginPath();
          ctx.arc(moodBadgeX, moodBadgeY, 8 * zoom, 0, 2 * Math.PI);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.strokeStyle = '#E2E8F0';
          ctx.lineWidth = 1 * zoom;
          ctx.stroke();
          
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(moodIcon, moodBadgeX, moodBadgeY + 1 * zoom);
        }
      }
      // NotebookLM Style: Expand/Collapse Arrow Badge
      const children = OntologyLayout.lastTreeChildrenMap.get(node.id) || [];
      const hasChildren = children.length > 0;
      if (hasChildren) {
        const isCollapsed = rc.collapsedNodeIds.has(node.id);
        const badgeRadius = 8 * zoom;
        
        // 뱃지 위치: 좌측 노드는 왼쪽에, 우측 노드는 오른쪽에 배치
        const badgeSpacing = badgeRadius + 4 * zoom;
        const badgeX = isLeftSide 
            ? node.renderX - boxW / 2 - badgeSpacing 
            : node.renderX + boxW / 2 + badgeSpacing;
        const badgeY = node.renderY;
        
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
        
        // 접혀 있으면 테마색으로 완전히 칠해서 시선 유도, 펴져 있으면 연하게
        ctx.fillStyle = isCollapsed ? themeColor : '#F1F5F9'; 
        ctx.fill();

        ctx.fillStyle = isCollapsed ? '#FFFFFF' : '#94A3B8';
        ctx.font = `bold ${9 * zoom}px sans-serif`;
        
        // 화살표 방향 로직 (좌/우 데칼코마니 반영)
        // 오른쪽 브랜치: 펼침(<) 접힘(>)
        // 왼쪽 브랜치:   펼침(>) 접힘(<)
        let arrowChar = '';
        if (isLeftSide) {
           arrowChar = isCollapsed ? '<' : '>';
        } else {
           arrowChar = isCollapsed ? '>' : '<';
        }
        ctx.fillText(arrowChar, badgeX, badgeY + Math.max(1, 1 * zoom));
      }

      node.nodeRadius = (boxW / 2) / zoom;

      ctx.restore();
    }
  }
}
