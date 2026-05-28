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

      const isConnectedToTree = activeNodeId && activeTreeSet.has(src.id) && activeTreeSet.has(tgt.id);

      // 1. 순수 계층 트리(Spanning Tree) 연결 여부 판별
      const childrenOfSrc = OntologyLayout.lastTreeChildrenMap.get(src.id) || [];
      const childrenOfTgt = OntologyLayout.lastTreeChildrenMap.get(tgt.id) || [];
      const isSpanningTreeEdge = childrenOfSrc.includes(tgt.id) || childrenOfTgt.includes(src.id);

      // 2. 현재 선택된 노드에 '직접' 닿아있는 간선인지 판별
      const isDirectlyConnectedToActive = activeNodeId && (activeNodeId === src.id || activeNodeId === tgt.id);

      // 3. 네트워크 토폴로지 교차 간선 (Cross-edge) 렌더링 지원 (이전에는 강제 차단됨)
      // 트리 구조가 아닌 엣지는 기본적으로 매우 투명하고 얇은 점선으로 렌더링하여 트리를 어지럽히지 않게 설계합니다.
      let isCrossEdge = false;
      if (!isSpanningTreeEdge && !isDirectlyConnectedToActive) {
         isCrossEdge = true;
         // 교차 간선을 무조건 삭제(continue)하지 않고 렌더링하도록 변경합니다!
      }

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
      
      // 엣지 투명도 및 두께 조절
      const themeColor = tgt.themeColor || '#94A3B8';
      let alpha = 0.15;
      let lineWidth = 0.5 * rc.zoom;

      if (isDirectlyConnectedToActive) {
          alpha = 0.7; // 직접 선택된 노드의 엣지는 가장 선명하게
          lineWidth = 1.8 * rc.zoom;
      } else if (isConnectedToTree) {
          alpha = 0.4; // 활성 트리에 속한 엣지는 약간 선명하게
          lineWidth = 1.0 * rc.zoom;
      } else if (isCrossEdge) {
          // [네트워크 토폴로지] 활성화되지 않은 비계층적 간선은 은은한 배경 거미줄로 배치
          alpha = 0.08; 
          lineWidth = 0.4 * rc.zoom;
      }
      
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = themeColor;
      ctx.lineWidth = lineWidth;
      
      // 사용자 지정 가중치(음수)이거나 교차 간선일 경우 점선(Dashed) 처리
      if (edge.weight < 0 || isCrossEdge) ctx.setLineDash([4, 4]);
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
      
      // 측정 캐시 최적화
      const weightStyle = (isActive || isTreeActive) ? '600' : '500';
      const cacheKey = weightStyle;
      if (!node._cachedTextWidth) node._cachedTextWidth = {};
      if (!node._cachedTextWidth[cacheKey]) {
          ctx.font = `${weightStyle} 12px 'Pretendard', sans-serif`;
          node._cachedTextWidth[cacheKey] = ctx.measureText(labelText).width;
      }
      const textWidth = node._cachedTextWidth[cacheKey] * zoom;

      // NotebookLM 스타일: 콤팩트한 노드 사이즈
      const fontSize = 12 * zoom;
      ctx.font = `${weightStyle} ${fontSize}px 'Pretendard', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const paddingX = 14 * zoom; // 좌우 여백 (기존 24 -> 14)
      const paddingY = 10 * zoom; // 상하 여백 (기존 16 -> 10)
      
      // Node Dimensions
      const boxW = Math.max(60 * zoom, textWidth + paddingX * 2); // 100 -> 60
      const boxH = Math.max(28 * zoom, fontSize + paddingY * 2);  // 40 -> 28

      const themeColor = node.isCompleted ? '#CBD5E1' : (node.themeColor || '#94A3B8'); // 완료된 노드는 회색 처리

      // Shadow and Glow setup (버퍼링 최적화 2: 캔버스 성능을 갉아먹는 무의미한 미세 그림자 연산 제거)
      if (node.isHighlighted) {
        ctx.shadowColor = 'rgba(245, 158, 11, 0.6)'; // Amber-500 glow 
        ctx.shadowBlur = 8 * zoom;
        ctx.shadowOffsetY = 0;
      } else if (isActive || isHovered) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
        ctx.shadowBlur = 8 * zoom;
        ctx.shadowOffsetY = 3 * zoom;
      } else {
        // 일반 평상시 노드의 그림자는 가장 무거운 렌더링 부하를 일으키므로 생략 (Flat UI 강화)
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
      }

      // Box Draw (Clean White Background)
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(node.renderX - boxW / 2, node.renderY - boxH / 2, boxW, boxH, 6 * zoom);
      } else {
        ctx.rect(node.renderX - boxW / 2, node.renderY - boxH / 2, boxW, boxH);
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // Border Outline
      if (node.isHighlighted) {
        ctx.lineWidth = 2 * zoom;
        ctx.strokeStyle = '#F59E0B'; // Amber-500
        ctx.stroke();
      } else if (isActive) {
        ctx.lineWidth = 2 * zoom;
        ctx.strokeStyle = themeColor;
        ctx.stroke();
      } else if (isTreeActive) {
        // Subtle outline for nodes in the same branch
        ctx.lineWidth = 1.5 * zoom;
        ctx.strokeStyle = themeColor;
        ctx.globalAlpha = 0.4;
        ctx.stroke();
        ctx.globalAlpha = opacity;
      } else {
        // Very faint outline for rest
        ctx.lineWidth = 1 * zoom;
        ctx.strokeStyle = '#F8FAFC'; // slate-50
        ctx.stroke();
      }

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

      // Text rendering
      if (node.isCompleted) {
        ctx.fillStyle = '#94A3B8'; // Slate-400 for completed
      } else {
        ctx.fillStyle = (isActive || isTreeActive) ? '#1E293B' : '#64748B';
      }
      // 텍스트 쏠림 보정 (엑센트 바 피하기)
      const textOffsetX = isLeftSide ? -2 * zoom : 2 * zoom;
      ctx.fillText(labelText, node.renderX + textOffsetX, node.renderY); 

      // Strikethrough for completed nodes
      if (node.isCompleted) {
        ctx.beginPath();
        const textHalfWidth = textWidth / 2;
        ctx.moveTo(node.renderX + textOffsetX - textHalfWidth, node.renderY);
        ctx.lineTo(node.renderX + textOffsetX + textHalfWidth, node.renderY);
        ctx.lineWidth = 1.5 * zoom;
        ctx.strokeStyle = '#64748B'; // Slightly darker line for visibility
        ctx.stroke();
      } 


      // 마감 기한 (Deadline) 표시 (활성화된 노드만 표기)
      if (isActive && node.dueDate) {
        const parts = node.dueDate.split('-');
        if (parts.length === 3) {
          const targetZero = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          const today = new Date();
          const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          
          const diffTime = targetZero.getTime() - todayZero.getTime();
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          const dDayStr = diffDays > 0 ? `D-${diffDays}` : diffDays === 0 ? 'D-Day' : `D+${Math.abs(diffDays)}`;
          
          const dateText = `⏰ ${dDayStr} (${parts[1]}/${parts[2]})`;
          ctx.font = `bold ${10 * zoom}px 'Pretendard', sans-serif`;
          const dateWidth = ctx.measureText(dateText).width;
          const dbW = dateWidth + 12 * zoom;
          const dbH = 18 * zoom;

          // 박스 아래쪽에 렌더링
          const dbX = node.renderX;
          const dbY = node.renderY + boxH / 2 + dbH / 2 + 5 * zoom;

          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(dbX - dbW / 2, dbY - dbH / 2, dbW, dbH, 10 * zoom);
          } else {
            ctx.rect(dbX - dbW / 2, dbY - dbH / 2, dbW, dbH);
          }
          
          ctx.fillStyle = diffDays <= 3 ? '#FEF2F2' : '#F8FAFC'; 
          ctx.fill();
          ctx.strokeStyle = diffDays <= 3 ? '#FCA5A5' : '#E2E8F0';
          ctx.lineWidth = 1 * zoom;
          ctx.stroke();

          ctx.fillStyle = diffDays <= 3 ? '#EF4444' : '#64748B'; 
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(dateText, dbX, dbY + Math.max(1, 1 * zoom));
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
