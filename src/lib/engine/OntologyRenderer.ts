import { OrbitalNode, OntologyEdge, EDGE_TYPE_LABELS, EdgeType } from '../ontology.types';
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
  cameraOffsetX?: number;
  cameraOffsetY?: number;
  activeLayers?: Set<number>;
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
    const { ctx, canvasW, canvasH, nodes, centerNode, cameraOffsetX = 0, cameraOffsetY = 0, zoom, activeLayers, nodeMap } = context;

    this.assignThemes(nodes, centerNode, nodeMap);

    this.renderBackground(ctx, canvasW, canvasH);
    this.renderBackgroundLayers(ctx, canvasW, canvasH, cameraOffsetX, cameraOffsetY, zoom, activeLayers);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    this.renderEdges(context);
    this.renderNodes(context);
  }

  private static renderBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 캔버스 배경에 무거운 radial gradient를 그리지 않고 clearRect로 픽셀을 완전히 비웁니다.
    // 배경은 wrapper div의 CSS radial-gradient를 활용해 브라우저 하드웨어 가속(GPU)으로 렌더링되게 이관합니다.
    ctx.clearRect(0, 0, width, height);
  }

  private static renderBackgroundLayers(
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    cameraOffsetX: number,
    cameraOffsetY: number,
    zoom: number,
    activeLayers?: Set<number>
  ): void {
    const cx = canvasW / 2 + cameraOffsetX;
    const cy = canvasH / 2 + cameraOffsetY;
    const tiltAngle = 42 * Math.PI / 180; // 42도 경사각
    const cosTilt = Math.cos(tiltAngle);
    const sinTilt = Math.sin(tiltAngle);
    const cameraDist = 1000;
    const LAYER_GAP = 190;                // 레이어 간 수직 격차 확대 (가독성/입체감 대폭 향상)
    const X_LIMIT = 850;
    const Y_LIMIT = 450;

    const layerLabels: Record<number, string> = {
      0: '인물 레이어 (Agent)',
      1: '예산/비품 레이어 (Resource)',
      2: '업무/회의 레이어 (Execution)',
      3: '위키/문서 레이어 (Knowledge)'
    };

    const layerColors: Record<number, string> = {
      0: 'rgba(59, 130, 246, 0.025)',  // Blue-500 2.5%
      1: 'rgba(16, 185, 129, 0.025)',  // Emerald-500 2.5%
      2: 'rgba(139, 92, 246, 0.025)',  // Violet-500 2.5%
      3: 'rgba(245, 158, 11, 0.025)'   // Amber-500 2.5%
    };

    const strokeColors: Record<number, string> = {
      0: 'rgba(59, 130, 246, 0.32)',   // 테두리 32%로 가독성 강화
      1: 'rgba(16, 185, 129, 0.32)',
      2: 'rgba(139, 92, 246, 0.32)',
      3: 'rgba(245, 158, 11, 0.32)'
    };

    // 1. Precompute corner points for all layers
    const corners: Record<number, { p1: any; p2: any; p3: any; p4: any }> = {};
    for (let layer = 0; layer < 4; layer++) {
      const h = layer * LAYER_GAP;
      const project = (wx: number, wy: number) => {
        const rotatedY = wy * cosTilt - h * sinTilt;
        const depth = -wy * sinTilt + h * cosTilt;
        const perspectiveScale = cameraDist / (cameraDist + depth);
        return {
          x: cx + wx * zoom * perspectiveScale,
          y: cy + rotatedY * zoom * perspectiveScale,
          scale: perspectiveScale
        };
      };
      corners[layer] = {
        p1: project(-X_LIMIT, -Y_LIMIT),
        p2: project(X_LIMIT, -Y_LIMIT),
        p3: project(X_LIMIT, Y_LIMIT),
        p4: project(-X_LIMIT, Y_LIMIT)
      };
    }

    // 2. Draw vertical dashed corner columns (connecting L0 -> L3 corners to visualize structure)
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)'; // slate-400 28%
    ctx.lineWidth = 1.2 * zoom;
    ctx.setLineDash([4, 8]);

    for (let cornerIndex = 1; cornerIndex <= 4; cornerIndex++) {
      const prop = `p${cornerIndex}` as 'p1'|'p2'|'p3'|'p4';
      ctx.beginPath();
      ctx.moveTo(corners[0][prop].x, corners[0][prop].y);
      for (let l = 1; l < 4; l++) {
        ctx.lineTo(corners[l][prop].x, corners[l][prop].y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // 3. Render flat transparent grid plates and headers (먼 레이어부터 순서대로 렌더링)
    ctx.save();
    for (let layer = 3; layer >= 0; layer--) {
      const isActive = !activeLayers || activeLayers.has(layer);
      if (!isActive) continue;

      const h = layer * LAYER_GAP;
      const depthH = layer * LAYER_GAP;
      const project = (wx: number, wy: number) => {
        const rotatedY = wy * cosTilt - h * sinTilt;
        const depth = -wy * sinTilt + depthH * cosTilt;
        const perspectiveScale = cameraDist / (cameraDist + depth);
        return {
          x: cx + wx * zoom * perspectiveScale,
          y: cy + rotatedY * zoom * perspectiveScale,
          scale: perspectiveScale
        };
      };

      const p1 = project(-X_LIMIT, -Y_LIMIT);
      const p2 = project(X_LIMIT, -Y_LIMIT);
      const p3 = project(X_LIMIT, Y_LIMIT);
      const p4 = project(-X_LIMIT, Y_LIMIT);

      // Draw the flat transparent layer grid plate
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.closePath();

      ctx.fillStyle = layerColors[layer];
      ctx.fill();

      ctx.strokeStyle = strokeColors[layer];
      ctx.lineWidth = 1.5 * zoom * ((p1.scale + p3.scale) / 2);
      ctx.setLineDash([8, 6]);
      ctx.stroke();



      // Draw the layer index text on top-right corners
      ctx.setLineDash([]);
      ctx.fillStyle = strokeColors[layer].replace('0.32', '0.75'); // 텍스트 라벨 투명도 상향
      const fontSize = 10.5 * zoom * p2.scale;
      ctx.font = `bold ${fontSize}px 'Pretendard', sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(layerLabels[layer], p2.x - 15 * zoom * p2.scale, p2.y + 25 * zoom * p2.scale);
    }

    ctx.restore();
  }

  private static renderEdges(rc: RenderContext): void {
    const { ctx, edges, nodeMap, activeNodeId, activeTreeSet, canvasW, canvasH } = rc;

    // Spanning Tree 구조 엣지를 O(1) 룩업하기 위한 캐시된 빌드셋 가져오기
    const spanningTreeEdgeSet = OntologyLayout.lastSpanningTreeEdgeSet;

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

      // 1. 순수 계층 트리(Spanning Tree) 연결 여부 판별 (O(1) 룩업으로 극단적 최적화)
      const isSpanningTreeEdge = spanningTreeEdgeSet.has(`${src.id}|||${tgt.id}`);

      // 2. 현재 선택된 노드에 '직접' 닿아있는 간선인지 판별
      const isDirectlyConnectedToActive = activeNodeId && (activeNodeId === src.id || activeNodeId === tgt.id);

      // 3. 네트워크 토폴로지 교차 간선 (Cross-edge) 렌더링 지원
      let isCrossEdge = false;
      if (!isSpanningTreeEdge && !isDirectlyConnectedToActive) {
         isCrossEdge = true;
      }

      // Frustum cull
      if (src.renderX < -CULL_MARGIN && tgt.renderX < -CULL_MARGIN) continue;
      if (src.renderX > canvasW + CULL_MARGIN && tgt.renderX > canvasW + CULL_MARGIN) continue;
      if (src.renderY < -CULL_MARGIN && tgt.renderY < -CULL_MARGIN) continue;
      if (src.renderY > canvasH + CULL_MARGIN && tgt.renderY > canvasH + CULL_MARGIN) continue;

      // Smooth step bezier variables (좌에서 우로)
      // 콤팩트해진 텍스트 박스 크기에 맞춰 선의 시작점을 안쪽으로 축소
      const leftScale = (leftNode as any).perspectiveScale ?? 1.0;
      const rightScale = (rightNode as any).perspectiveScale ?? 1.0;
      const avgScale = (leftScale + rightScale) / 2;

      // 콤팩트해진 텍스트 박스 크기에 맞춰 선의 시작점을 안쪽으로 축소 (원근 스케일 적용)
      const leftRightX = leftNode.renderX + 30 * rc.zoom * leftScale;
      const rightLeftX = rightNode.renderX - 30 * rc.zoom * rightScale;
      
      const cpDist = Math.max(15, Math.abs(rightLeftX - leftRightX) / 2);
      
      // 엣지 투명도 및 두께 조절
      let themeColor = tgt.themeColor || '#94A3B8';

      // 레이어 교차 간선 (Layer-Crossing Edge)에 대한 특수 시맨틱 색상 매핑
      const srcLayer = src.effectiveLayer ?? 3;
      const tgtLayer = tgt.effectiveLayer ?? 3;
      
      if (src.isCompleted || tgt.isCompleted) {
        themeColor = '#CBD5E1'; // 완료/아카이브된 간선은 회색 처리
      } else if (srcLayer !== tgtLayer) {
        const lMin = Math.min(srcLayer, tgtLayer);
        const lMax = Math.max(srcLayer, tgtLayer);
        
        if (lMin === 0 && lMax === 2) {
          // 인물 (L0) <-> 업무 (L2) = Indigo (중첩적 관계성 표현)
          themeColor = '#6366F1'; 
        } else if (lMin === 1 && lMax === 2) {
          // 예산 (L1) <-> 업무 (L2) = Teal (지출 집행 흐름)
          themeColor = '#0D9488';
        } else if (lMin === 2 && lMax === 3) {
          // 업무 (L2) <-> 위키 (L3) = Orange (업무 산출물/지식 자산화)
          themeColor = '#F97316';
        } else if (lMin === 0 && lMax === 3) {
          // 인물 (L0) <-> 위키 (L3) = Pink (인물 이력/위키)
          themeColor = '#EC4899';
        } else {
          themeColor = '#8E9CB2';
        }
      }

      let alpha = 0.15;
      let lineWidth = 0.5 * rc.zoom * avgScale;

      const isConnectedToTree = activeNodeId && activeTreeSet.has(src.id) && activeTreeSet.has(tgt.id);

      if (isDirectlyConnectedToActive) {
          alpha = 0.7; // 직접 선택된 노드의 엣지는 가장 선명하게
          lineWidth = 1.8 * rc.zoom * avgScale;
      } else if (isConnectedToTree) {
          alpha = 0.4; // 활성 트리에 속한 엣지는 약간 선명하게
          lineWidth = 1.0 * rc.zoom * avgScale;
      } else if (isCrossEdge) {
          // [네트워크 토폴로지] 교차 간선은 성능 향상을 위해 실선화하고 투명도/두께를 극소화하여 거미줄로 배치
          alpha = 0.04; 
          lineWidth = 0.2 * rc.zoom * avgScale;
      }
      
      ctx.globalAlpha = alpha * Math.max(0.3, avgScale);
      ctx.strokeStyle = themeColor;
      ctx.lineWidth = lineWidth;
      
      // 중요: 대량의 점선 그리기(dash computation)가 유발하는 극심한 캔버스 병목을 예방하기 위해, 
      // 일반적인 교차 엣지는 점선이 아닌 얇은 실선으로 그리며 오직 가중치가 음수인 경우에만 점선을 적용합니다.
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

      const isDirectlyConnectedToHover = rc.hoveredNodeId && (rc.hoveredNodeId === src.id || rc.hoveredNodeId === tgt.id);

      // 4. 활성화된 노드나 마우스가 올라간 노드에 연결된 엣지에만 관계 텍스트(Edge Label) 렌더링
      const shouldDrawLabel = (isDirectlyConnectedToActive || isDirectlyConnectedToHover) && !isCrossEdge;

      if (shouldDrawLabel) {
        ctx.save();
        
        // 3차 베지어 곡선의 중간 지점 (t = 0.5) 연산
        const t = 0.5;
        const mt = 1 - t;
        const mt3 = mt * mt * mt;
        const t3 = t * t * t;
        const mt2t = 3 * mt * mt * t;
        const mtt2 = 3 * mt * t * t;

        const midX = mt3 * leftRightX + mt2t * (leftRightX + cpDist) + mtt2 * (rightLeftX - cpDist) + t3 * rightLeftX;
        const midY = mt3 * leftNode.renderY + mt2t * leftNode.renderY + mtt2 * rightNode.renderY + t3 * rightNode.renderY;

        const labelText = EDGE_TYPE_LABELS[edge.type as EdgeType] || '';
        if (labelText) {
          const fontSize = 8.5 * rc.zoom * avgScale;
          ctx.font = `600 ${fontSize}px 'Pretendard', sans-serif`;
          
          // 12px 기준 엣지 텍스트 고정 너비 매핑 테이블 (measureText 호출 병목 완전 우회)
          const STATIC_LABEL_WIDTHS: Record<EdgeType, number> = {
            CAUSAL_DRIVE:  36, // '인과 구동'
            DEPENDENCY:    27, // '의존성'
            FEEDBACK_LOOP: 54, // '피드백 루프'
            BOTTLENECK:    18, // '병목'
            DECOUPLING:    36, // '디커플링'
            ASSIGNEE:      45, // '담당자 지정'
            BUDGET_SOURCE: 36, // '예산 배정'
            COMPONENTS:    36, // '구성 요소'
          };
          const baseWidth = STATIC_LABEL_WIDTHS[edge.type as EdgeType] || (labelText.length * 9);
          const labelWidth = baseWidth * (fontSize / 12);
          const padX = 6 * rc.zoom * avgScale;
          const padY = 4 * rc.zoom * avgScale;
          const rectW = labelWidth + padX * 2;
          const rectH = fontSize + padY * 2;

          ctx.globalAlpha = Math.min(1.0, alpha * 1.5);
          
          // 배경 둥근 사각 박스
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(midX - rectW / 2, midY - rectH / 2, rectW, rectH, 4 * rc.zoom * avgScale);
          } else {
            ctx.rect(midX - rectW / 2, midY - rectH / 2, rectW, rectH);
          }
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.strokeStyle = themeColor;
          ctx.lineWidth = 1 * rc.zoom * avgScale;
          ctx.stroke();

          // 관계 텍스트
          ctx.fillStyle = '#1E293B';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, midX, midY + 0.5 * rc.zoom * avgScale);
        }
        
        ctx.restore();
      }
    }

    // 펄스 일괄 렌더링 루프 제거됨

    ctx.globalAlpha = 1.0;
    ctx.setLineDash([]);
  }

  private static assignThemes(nodes: OrbitalNode[], centerNode: OrbitalNode | null, nodeMap: Map<string, OrbitalNode>) {
      if (!centerNode) return;
      centerNode.themeColor = '#475569'; // Slate-600 for Root

      const children = OntologyLayout.lastTreeChildrenMap.get(centerNode.id) || [];
      let paletteIdx = 0;
      
      for (const childId of children) {
          const childNode = nodeMap.get(childId);
          if (childNode) {
              childNode.themeColor = this.THEME_PALETTES[paletteIdx % this.THEME_PALETTES.length];
              paletteIdx++;
              this.cascadeTheme(childNode.id, childNode.themeColor, nodeMap);
          }
      }
  }

  private static cascadeTheme(parentId: string, color: string, nodeMap: Map<string, OrbitalNode>) {
      const children = OntologyLayout.lastTreeChildrenMap.get(parentId) || [];
      for (const childId of children) {
          const childNode = nodeMap.get(childId);
          if (childNode) {
              childNode.themeColor = color;
              this.cascadeTheme(childId, color, nodeMap);
          }
      }
  }

  // Legacy getColorPalette removed -> We use Flat Design and themeColor inheritance

  private static renderNodes(rc: RenderContext): void {
    const { ctx, sortedNodesBuffer, nodes, activeNodeId, hoveredNodeId, activeTreeSet, canvasW, canvasH, zoom } = rc;

    sortedNodesBuffer.length = 0;
    for (const n of nodes) sortedNodesBuffer.push(n);

    // 3D 수직 적층 원근 정렬: 카메라로부터 멀리 있는 노드(renderZ가 큰 노드)를 먼저 렌더링
    sortedNodesBuffer.sort((a, b) => {
      if (a.id === activeNodeId) return 1;
      if (b.id === activeNodeId) return -1;

      const depthA = a.renderZ || 0;
      const depthB = b.renderZ || 0;
      if (Math.abs(depthB - depthA) > 1) {
        return depthB - depthA; // 내림차순 정렬 (renderZ가 큰 것부터 렌더링)
      }
      return (a.orbitIndex || 0) - (b.orbitIndex || 0);
    });

    let shadowEnabled = false;

    for (const node of sortedNodesBuffer) {
      if (node.layoutHidden) continue;
      if (node.renderX < -CULL_MARGIN || node.renderX > canvasW + CULL_MARGIN) continue;
      if (node.renderY < -CULL_MARGIN || node.renderY > canvasH + CULL_MARGIN) continue;

      const isActive = node.id === activeNodeId;
      const isTreeActive = activeNodeId && activeTreeSet.has(node.id);
      const isHovered = node.id === hoveredNodeId;
      const opacity = (!activeNodeId || isTreeActive || isActive) ? 1 : 0.3;

      const nodeScale = (node as any).perspectiveScale ?? 1.0;
      const weight = node.renderSize ?? 0.5;
      const sizeFactor = 0.8 + 0.5 * weight; // 0.8배 ~ 1.3배 가중치 비례 스케일링
      const localZoom = zoom * nodeScale * sizeFactor;

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
      const textWidth = node._cachedTextWidth[cacheKey] * localZoom;

      // NotebookLM 스타일: 콤팩트한 노드 사이즈
      const fontSize = 12 * localZoom;
      ctx.font = `${weightStyle} ${fontSize}px 'Pretendard', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const paddingX = 14 * localZoom; // 좌우 여백 (기존 24 -> 14)
      const paddingY = 10 * localZoom; // 상하 여백 (기존 16 -> 10)
      
      // Node Dimensions
      const boxW = Math.max(60 * localZoom, textWidth + paddingX * 2); // 100 -> 60
      const boxH = Math.max(28 * localZoom, fontSize + paddingY * 2);  // 40 -> 28

      const themeColor = node.isCompleted ? '#CBD5E1' : (node.themeColor || '#94A3B8'); // 완료된 노드는 회색 처리

      // 1) 리스크 노드 및 리스크 영향이 큰 노드 감지
      const risk = (node as any).riskFactor ?? 0;
      const isRiskOrigin = node.group === 'SYSTEM_RISK';
      const isRiskAffected = risk > 0.3;
      const isRiskHigh = isRiskOrigin || isRiskAffected;

      // Shadow and Glow setup (버퍼링 최적화 2: 캔버스 성능을 갉아먹는 무의미한 미세 그림자 연산 제거)
      const needsShadow = node.isHighlighted || isActive || isHovered || isRiskHigh;
      if (needsShadow) {
        if (node.isHighlighted) {
          ctx.shadowColor = 'rgba(245, 158, 11, 0.6)'; // Amber-500 glow 
          ctx.shadowBlur = 8 * localZoom;
          ctx.shadowOffsetY = 0;
        } else if (isRiskHigh) {
          // 리스크 수준에 비례해 붉은빛 글로우가 진해지고, 시간에 따라 은은하게 펄싱
          const pulseIntensity = 0.5 + 0.3 * Math.sin(Date.now() / 250);
          const riskWeight = isRiskOrigin ? 1.0 : risk;
          ctx.shadowColor = `rgba(239, 68, 68, ${0.4 * riskWeight * pulseIntensity})`; // Red-500 pulse glow
          ctx.shadowBlur = (6 + 8 * riskWeight * pulseIntensity) * localZoom;
          ctx.shadowOffsetY = 0;
        } else {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
          ctx.shadowBlur = 8 * localZoom;
          ctx.shadowOffsetY = 3 * localZoom;
        }
        shadowEnabled = true;
      } else if (shadowEnabled) {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        shadowEnabled = false;
      }

      // Box Draw (Clean White Background)
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(node.renderX - boxW / 2, node.renderY - boxH / 2, boxW, boxH, 6 * localZoom);
      } else {
        ctx.rect(node.renderX - boxW / 2, node.renderY - boxH / 2, boxW, boxH);
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // Border Outline
      if (node.isHighlighted) {
        ctx.lineWidth = 2 * localZoom;
        ctx.strokeStyle = '#F59E0B'; // Amber-500
        ctx.stroke();
      } else if (isActive) {
        ctx.lineWidth = 2 * localZoom;
        ctx.strokeStyle = themeColor;
        ctx.stroke();
      } else if (isRiskHigh) {
        // 리스크 노드는 테두리를 리스크 가중에 따라 조금 더 두껍게 붉은색으로 강조
        const riskWeight = isRiskOrigin ? 1.0 : risk;
        ctx.lineWidth = (1.5 + 1.0 * riskWeight) * localZoom;
        ctx.strokeStyle = '#EF4444'; // Red-500
        ctx.stroke();
      } else if (isTreeActive) {
        // Subtle outline for nodes in the same branch
        ctx.lineWidth = 1.5 * localZoom;
        ctx.strokeStyle = themeColor;
        ctx.globalAlpha = 0.4;
        ctx.stroke();
        ctx.globalAlpha = opacity;
      } else {
        // Very faint outline for rest
        ctx.lineWidth = 1 * localZoom;
        ctx.strokeStyle = '#F8FAFC'; // slate-50
        ctx.stroke();
      }

      // Shadow clear
      ctx.shadowColor = 'transparent';

      // Hemisphere Check (좌/우 방향 식별)
      const isLeftSide = (node.worldX || 0) < 0;

      // Color Accent Bar (방향에 따라 좌측 또는 우측 끝에 예쁘게 그려줌)
      ctx.beginPath();
      if (ctx.roundRect) {
        if (isLeftSide) {
          ctx.roundRect(node.renderX + boxW / 2 - 6 * localZoom, node.renderY - boxH / 2, 6 * localZoom, boxH, [
            0,
            6 * localZoom,
            6 * localZoom,
            0
          ]);
        } else {
          ctx.roundRect(node.renderX - boxW / 2, node.renderY - boxH / 2, 6 * localZoom, boxH, [
            6 * localZoom,
            0,
            0,
            6 * localZoom
          ]);
        }
      } else {
        const ax = isLeftSide ? (node.renderX + boxW / 2 - 6 * localZoom) : (node.renderX - boxW / 2);
        ctx.rect(ax, node.renderY - boxH / 2, 6 * localZoom, boxH);
      }
      ctx.fillStyle = themeColor;
      ctx.fill();

      // 리스크 도트 인디케이터 (리스크 노드이거나 영향을 강하게 받는 경우)
      if (isRiskHigh) {
        ctx.beginPath();
        const dotRadius = 3.5 * localZoom;
        const dotX = isLeftSide
          ? (node.renderX - boxW / 2 + 12 * localZoom)
          : (node.renderX + boxW / 2 - 12 * localZoom);
        const dotY = node.renderY;
        ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
        
        const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 200);
        ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`; // Red-500
        ctx.fill();
      }

      // Text rendering
      if (node.isCompleted) {
        ctx.fillStyle = '#94A3B8'; // Slate-400 for completed
      } else {
        ctx.fillStyle = (isActive || isTreeActive) ? '#1E293B' : '#64748B';
      }
      // 텍스트 쏠림 보정 (엑센트 바 피하기)
      const textOffsetX = isLeftSide ? -2 * localZoom : 2 * localZoom;
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
    }

    // save/restore 호출을 소거한 대신 사용했던 캔버스 2D 속성 복원 초기화
    ctx.globalAlpha = 1.0;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
}
