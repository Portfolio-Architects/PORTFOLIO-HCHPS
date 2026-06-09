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
  layoutMode?: 'mindmap' | 'orbit' | 'cluster';
  isInteractive?: boolean;
  isOrbiting?: boolean;
}

export class OntologyRenderer {
  private static currentFont = '';
  private static setFont(ctx: CanvasRenderingContext2D, fontStr: string) {
    if (this.currentFont !== fontStr) {
      ctx.font = fontStr;
      this.currentFont = fontStr;
    }
  }
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
    this.currentFont = '';
    const { ctx, canvasW, canvasH, nodes, centerNode, cameraOffsetX = 0, cameraOffsetY = 0, zoom, activeLayers, nodeMap, layoutMode = 'mindmap' } = context;

    this.assignThemes(nodes, centerNode, nodeMap);

    this.renderBackground(ctx, canvasW, canvasH);
    
    if (layoutMode === 'orbit') {
      this.renderOrbitRings(context);
    } else if (layoutMode === 'cluster') {
      // 포도송이(Cluster) 뷰: 궤도 링 및 4단 플레이트 모두 그리기를 건너뜁니다.
    } else {
      this.renderBackgroundLayers(ctx, canvasW, canvasH, cameraOffsetX, cameraOffsetY, zoom, activeLayers);
    }

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
        const perspectiveScale = Math.max(0.05, cameraDist / (cameraDist + depth));
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
        const perspectiveScale = Math.max(0.05, cameraDist / (cameraDist + depth));
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
      const fontSize = Math.round(10.5 * zoom * p2.scale);
      this.setFont(ctx, `bold ${fontSize}px 'Pretendard', sans-serif`);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(layerLabels[layer], p2.x - 15 * zoom * p2.scale, p2.y + 25 * zoom * p2.scale);
    }

    ctx.restore();
  }

  private static renderOrbitRings(rc: RenderContext): void {
    const { ctx, canvasW, canvasH, cameraOffsetX = 0, cameraOffsetY = 0, zoom, nodes } = rc;

    const cx = canvasW / 2 + cameraOffsetX;
    const cy = canvasH / 2 + cameraOffsetY;
    const tiltAngle = 42 * Math.PI / 180; // 42도 경사각
    const cosTilt = Math.cos(tiltAngle);
    const sinTilt = Math.sin(tiltAngle);
    const cameraDist = 1000;
    const ELLIPSE_RATIO = 1.3; // OntologyLayout.ts와 완벽하게 일치시킴

    // 1. 실제로 화면에 노출 중인 노드들의 최대 궤도 인덱스(depth) 동적 감지
    let maxOrbitIndex = 1;
    for (const node of nodes) {
      if (!node.layoutHidden && node.orbitIndex !== undefined) {
        if (node.orbitIndex > maxOrbitIndex) {
          maxOrbitIndex = node.orbitIndex;
        }
      }
    }

    ctx.save();
    ctx.lineWidth = 1.0 * zoom;
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)'; // 밤하늘의 궤도처럼 은은한 인디고 15%

    const h = 0; // 단일 평면 궤도

    // 2. 동심 궤도 링 그리기 (concentric orbits)
    for (let orbitIndex = 1; orbitIndex <= maxOrbitIndex; orbitIndex++) {
      const R = orbitIndex * 240; // 궤도 반지름

      ctx.beginPath();
      const segments = 90; // 원을 촘촘하게 엮음
      for (let i = 0; i <= segments; i++) {
        const theta = (2 * Math.PI * i) / segments;
        const wx = R * Math.cos(theta) * ELLIPSE_RATIO;
        const wy = R * Math.sin(theta);

        const rotatedY = wy * cosTilt - h * sinTilt;
        const depth = -wy * sinTilt + h * cosTilt;
        const perspectiveScale = Math.max(0.05, cameraDist / (cameraDist + depth));

        const sx = cx + wx * zoom * perspectiveScale;
        const sy = cy + rotatedY * zoom * perspectiveScale;

        if (i === 0) {
          ctx.moveTo(sx, sy);
        } else {
          ctx.lineTo(sx, sy);
        }
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  private static renderEdges(rc: RenderContext): void {
    const { ctx, edges, nodeMap, activeNodeId, activeTreeSet, canvasW, canvasH, layoutMode = 'mindmap' } = rc;

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

      // LOD (Level of Detail) 및 상호작용(Interactive) 최적화: 
      // 줌 레벨이 0.7 미만이거나 줌/패닝 조작 중일 때는 프레임 확보를 위해 교차 간선 그리기를 과감히 스킵
      if (isCrossEdge && (rc.zoom < 0.7 || rc.isInteractive)) {
         continue;
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

      // 도트 노드의 정중앙 좌표를 직선 시작/끝 영점으로 완벽 동조시킵니다 (기존 사각형 카드용 30px 오프셋 제거)
      const leftRightX = leftNode.renderX;
      const rightLeftX = rightNode.renderX;
      
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
      if (layoutMode === 'orbit') {
        // 궤도 모드에서는 복잡한 베지어 곡선을 그리지 않고 레퍼런스 스크린샷과 동일한 깔끔한 직선으로 연결하여 GPU 렌더링 성능을 3배 이상 극대화합니다.
        ctx.moveTo(leftRightX, leftNode.renderY);
        ctx.lineTo(rightLeftX, rightNode.renderY);
      } else if (layoutMode === 'cluster') {
        // 포도송이(Cluster) 모드에서는 노드의 2D 중심 경계에서 타겟 경계까지 깔끔하게 이어진 직선 화살표를 드로잉합니다.
        const dx = tgt.renderX - src.renderX;
        const dy = tgt.renderY - src.renderY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 10) {
          const ux = dx / dist;
          const uy = dy / dist;
          
          const srcR = src.nodeRadius * rc.zoom * ((src as any).perspectiveScale ?? 1.0);
          const tgtR = tgt.nodeRadius * rc.zoom * ((tgt as any).perspectiveScale ?? 1.0);
          
          const startX = src.renderX + ux * srcR;
          const startY = src.renderY + uy * srcR;
          const endX = tgt.renderX - ux * tgtR;
          const endY = tgt.renderY - uy * tgtR;
          
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          
          // 화살표 머리 깃 (Arrowhead) 드로잉
          const arrowSize = 6.5 * rc.zoom * avgScale;
          const angle = Math.atan2(dy, dx);
          
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - arrowSize * Math.cos(angle - Math.PI / 6),
            endY - arrowSize * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            endX - arrowSize * Math.cos(angle + Math.PI / 6),
            endY - arrowSize * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fillStyle = themeColor;
          ctx.globalAlpha = alpha * Math.max(0.3, avgScale);
          ctx.fill();
          ctx.restore();
        }
      } else {
        ctx.moveTo(leftRightX, leftNode.renderY);
        ctx.bezierCurveTo(
          leftRightX + cpDist, leftNode.renderY,
          rightLeftX - cpDist, rightNode.renderY,
          rightLeftX, rightNode.renderY
        );
      }
      ctx.stroke();

      const isDirectlyConnectedToHover = rc.hoveredNodeId && (rc.hoveredNodeId === src.id || rc.hoveredNodeId === tgt.id);

      // 4. 활성화된 노드나 마우스가 올라간 노드에 연결된 엣지 중, 불필요한 노이즈를 방지하기 위해 
      // 기본 '의존성(DEPENDENCY)'을 제외한 특수 관계(담당자 지정, 예산 배정 등)만 라벨 렌더링
      const shouldDrawLabel = (isDirectlyConnectedToActive || isDirectlyConnectedToHover) && 
                              !isCrossEdge && 
                              edge.type !== 'DEPENDENCY';

      if (shouldDrawLabel) {
        ctx.save();
        
        let midX = 0;
        let midY = 0;

        if (layoutMode === 'orbit') {
          midX = (leftRightX + rightLeftX) / 2;
          midY = (leftNode.renderY + rightNode.renderY) / 2;
        } else {
          // 3차 베지어 곡선의 중간 지점 (t = 0.5) 연산
          const t = 0.5;
          const mt = 1 - t;
          const mt3 = mt * mt * mt;
          const t3 = t * t * t;
          const mt2t = 3 * mt * mt * t;
          const mtt2 = 3 * mt * t * t;

          midX = mt3 * leftRightX + mt2t * (leftRightX + cpDist) + mtt2 * (rightLeftX - cpDist) + t3 * rightLeftX;
          midY = mt3 * leftNode.renderY + mt2t * leftNode.renderY + mtt2 * rightNode.renderY + t3 * rightNode.renderY;
        }

        const labelText = EDGE_TYPE_LABELS[edge.type as EdgeType] || '';
        if (labelText) {
          const fontSize = Math.round(8.5 * rc.zoom * avgScale);
          this.setFont(ctx, `600 ${fontSize}px 'Pretendard', sans-serif`);
          
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
            ctx.roundRect(midX - rectW / 2, midY - rectH / 2, rectW, rectH, Math.max(0.1, 4 * rc.zoom * avgScale));
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
    const { ctx, sortedNodesBuffer, nodes, activeNodeId, hoveredNodeId, activeTreeSet, canvasW, canvasH, zoom, layoutMode = 'mindmap' } = rc;

    // 1. 전역 텍스트 겹침 방지(Text Overlap Prevention) 사전 계산
    const drawnTextBoxes: Array<{x1: number, y1: number, x2: number, y2: number}> = [];
    const textAllowedSet = new Set<string>();

    // 중요도(renderSize) 내림차순으로 정렬된 노드 리스트 복사본 생성
    const centralitySorted = [...sortedNodesBuffer].sort((a, b) => {
      const sizeA = a.renderSize ?? 0.5;
      const sizeB = b.renderSize ?? 0.5;
      return sizeB - sizeA;
    });

    for (const node of centralitySorted) {
      if (node.layoutHidden) continue;
      
      const isActive = node.id === activeNodeId;
      const isHovered = node.id === hoveredNodeId;
      const isTreeActive = activeNodeId && activeTreeSet.has(node.id);
      
      // 최상위 루트 노드, 활성 노드, 호버 노드는 겹침과 무관하게 무조건 텍스트 표시 허용
      if (node.orbitIndex === 0 || isActive || isHovered) {
        textAllowedSet.add(node.id);
        
        // 예상 바운딩 박스 계산 및 등록
        const nodeScale = (node as any).perspectiveScale ?? 1.0;
        const sizeFactor = 0.8 + 0.5 * (node.renderSize ?? 0.5);
        const localZoom = zoom * nodeScale * sizeFactor;
        const dotRadius = Math.max(0.1, (4 + 6 * sizeFactor) * localZoom * (isActive || isHovered ? 1.15 : 1.0));
        const textOffsetX = dotRadius + 6 * localZoom;
        const fontSize = Math.round(12 * localZoom);
        
        let textWidth = (node.label || '').length * 7.5;
        if ((node as any)._cachedTextWidth) {
          const cache = (node as any)._cachedTextWidth;
          textWidth = cache['600'] || cache['500'] || textWidth;
        }
        
        const textH = fontSize + 4 * localZoom;
        const textW = textWidth + 8 * localZoom;
        const x1 = node.renderX + textOffsetX - 4 * localZoom - 6;
        const y1 = node.renderY - textH / 2 - 3;
        const x2 = x1 + textW + 12;
        const y2 = y1 + textH + 6;
        
        drawnTextBoxes.push({ x1, y1, x2, y2 });
        continue;
      }

      // 화면 Frustum 영역 바깥 노드는 계산 생략
      if (node.renderX < -CULL_MARGIN || node.renderX > canvasW + CULL_MARGIN ||
          node.renderY < -CULL_MARGIN || node.renderY > canvasH + CULL_MARGIN) {
        continue;
      }

      // 활성 포커스 집중 모드일 때 관계망 바깥의 비활성 노드는 텍스트 허용 차단
      const isInactiveOutsideFocus = activeNodeId && !isActive && !isTreeActive;
      if (isInactiveOutsideFocus) {
        continue;
      }

      // 텍스트 바운딩 박스 계산
      const nodeScale = (node as any).perspectiveScale ?? 1.0;
      const sizeFactor = 0.8 + 0.5 * (node.renderSize ?? 0.5);
      const localZoom = zoom * nodeScale * sizeFactor;
      const dotRadius = Math.max(0.1, (4 + 6 * sizeFactor) * localZoom);
      const textOffsetX = dotRadius + 6 * localZoom;
      const fontSize = Math.round(12 * localZoom);
      
      let textWidth = (node.label || '').length * 7.5;
      if ((node as any)._cachedTextWidth) {
        const cache = (node as any)._cachedTextWidth;
        textWidth = cache['600'] || cache['500'] || textWidth;
      }
      
      const textH = fontSize + 4 * localZoom;
      const textW = textWidth + 8 * localZoom;
      
      // 여유 마진 버퍼를 포함하여 겹침 검사
      const x1 = node.renderX + textOffsetX - 4 * localZoom - 8;
      const y1 = node.renderY - textH / 2 - 4;
      const x2 = x1 + textW + 16;
      const y2 = y1 + textH + 8;

      const rect = { x1, y1, x2, y2 };
      
      // 이미 그려진 텍스트 박스들과의 겹침 검사
      let hasOverlap = false;
      for (const box of drawnTextBoxes) {
        if (!(rect.x2 < box.x1 || rect.x1 > box.x2 || rect.y2 < box.y1 || rect.y1 > box.y2)) {
          hasOverlap = true;
          break;
        }
      }

      if (!hasOverlap) {
        textAllowedSet.add(node.id);
        drawnTextBoxes.push(rect);
      }
    }

    // No-op sorting: sortedNodesBuffer is pre-sorted by the layout engine.

    let shadowEnabled = false;

    for (const node of sortedNodesBuffer) {
      if (node.layoutHidden) continue;
      if (node.renderX < -CULL_MARGIN || node.renderX > canvasW + CULL_MARGIN) continue;
      if (node.renderY < -CULL_MARGIN || node.renderY > canvasH + CULL_MARGIN) continue;

      const isActive = node.id === activeNodeId;
      const isTreeActive = activeNodeId && activeTreeSet.has(node.id);
      const isHovered = node.id === hoveredNodeId;
      const opacity = (!activeNodeId || isTreeActive || isActive) ? 1 : 0.3;
      const isInactiveOutsideFocus = !!(activeNodeId && !isActive && !isTreeActive);

      const nodeScale = (node as any).perspectiveScale ?? 1.0;
      const weight = node.renderSize ?? 0.5;
      const sizeFactor = 0.8 + 0.5 * weight; // 0.8배 ~ 1.3배 가중치 비례 스케일링
      const localZoom = zoom * nodeScale * sizeFactor;

      ctx.globalAlpha = opacity;

      // ─── Semantic Zooming (LOD 2.0) 최적화 및 텍스트 겹침 방지 ───
      // 전역 겹침 사전 계산 결과에 의해 라벨이 허용되지 않은 노드는 100% 도트(Dot)로 렌더링
      const isLODDot = !textAllowedSet.has(node.id);

      if (isLODDot) {
        const themeColor = node.isCompleted ? '#CBD5E1' : (node.themeColor || '#94A3B8');
        ctx.beginPath();
        // 비활성 노드는 도트 크기도 작고 투명하게 처리하여 가시성 격차(Focus-Context Blending) 고도화
        const dotR = isInactiveOutsideFocus ? Math.max(0.1, 3.5 * localZoom) : Math.max(0.1, 5.5 * localZoom);
        ctx.arc(node.renderX, node.renderY, dotR, 0, Math.PI * 2);
        ctx.fillStyle = themeColor;
        ctx.fill();
        ctx.strokeStyle = isInactiveOutsideFocus ? 'rgba(255, 255, 255, 0.4)' : '#FFFFFF';
        ctx.lineWidth = 1 * localZoom;
        ctx.stroke();
        node.nodeRadius = dotR / zoom;
        continue;
      }

      const labelText = node.label || '';
      
      // 측정 캐시 최적화
      const weightStyle = (isActive || isTreeActive) ? '600' : '500';
      const cacheKey = weightStyle;
      if (!node._cachedTextWidth) node._cachedTextWidth = {};
      if (!node._cachedTextWidth[cacheKey]) {
          this.setFont(ctx, `${weightStyle} 12px 'Pretendard', sans-serif`);
          node._cachedTextWidth[cacheKey] = ctx.measureText(labelText).width;
      }
      const textWidth = node._cachedTextWidth[cacheKey] * localZoom;

      // NotebookLM 스타일: 콤팩트한 노드 사이즈
      const fontSize = Math.round(12 * localZoom);
      this.setFont(ctx, `${weightStyle} ${fontSize}px 'Pretendard', sans-serif`);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const paddingX = 14 * localZoom; // 좌우 여백 (기존 24 -> 14)
      const paddingY = 10 * localZoom; // 상하 여백 (기존 16 -> 10)
      
      // Node Dimensions
      const boxW = Math.max(60 * localZoom, textWidth + paddingX * 2); // 100 -> 60
      const boxH = Math.max(28 * localZoom, fontSize + paddingY * 2);  // 40 -> 28

      const isCluster = layoutMode === 'cluster';
      const themeColor = node.isCompleted 
        ? (isCluster ? '#64748B' : '#CBD5E1') 
        : (node.themeColor || '#94A3B8');

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

      // 1) 노드 도트(Sphere) 반지름 계산
      const baseRadius = isCluster ? (24 + weight * 26) : (4 + 6 * sizeFactor);
      const dotRadius = Math.max(0.1, baseRadius * localZoom * (isActive || isHovered ? 1.15 : 1.0));

      // Shadow and Glow setup for premium sphere looks
      const needsGlow = isActive || isHovered || isRiskHigh;
      if (needsGlow) {
        if (isRiskHigh) {
          const pulseIntensity = 0.5 + 0.3 * Math.sin(Date.now() / 250);
          const riskWeight = isRiskOrigin ? 1.0 : risk;
          ctx.shadowColor = `rgba(239, 68, 68, ${0.5 * riskWeight * pulseIntensity})`;
          ctx.shadowBlur = (10 + 12 * riskWeight * pulseIntensity) * localZoom;
        } else {
          ctx.shadowColor = themeColor;
          ctx.shadowBlur = 10 * localZoom;
        }
        ctx.shadowOffsetY = 0;
        shadowEnabled = true;
      } else if (shadowEnabled) {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        shadowEnabled = false;
      }

      // Draw Sphere core
      ctx.beginPath();
      ctx.arc(node.renderX, node.renderY, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = themeColor;
      ctx.fill();

      // White Sphere Border
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = (isCluster ? 2.4 : 1.5) * localZoom;
      ctx.stroke();

      // Risk flashing core indicator
      if (isRiskHigh) {
        const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 200);
        ctx.beginPath();
        ctx.arc(node.renderX, node.renderY - dotRadius * 0.4, dotRadius * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
        ctx.fill();
      }

      ctx.shadowColor = 'transparent';

      // 상호작용 중에도 텍스트를 그리되, measureText와 같은 헤비한 연산을 생략하여 성능을 사수하고 깜빡임을 완벽히 차단
      if (isCluster) {
        this.drawNodeTextInside(ctx, labelText, node.renderX, node.renderY, dotRadius, localZoom, isActive, !!rc.isInteractive);
      } else {
        // 2) Text Label drawing
        const textOffsetX = dotRadius + 6 * localZoom;
        const textY = node.renderY;

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        // Semitransparent white label backing capsule for maximum readability on orbits
        const textH = fontSize + 4 * localZoom;
        const textW = textWidth + 8 * localZoom;
        
        // 가독성 극대화를 위해 백박스 불투명도를 0.88로 상향
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(node.renderX + textOffsetX - 4 * localZoom, textY - textH / 2, textW, textH, Math.max(0.1, 4 * localZoom));
        } else {
          ctx.rect(node.renderX + textOffsetX - 4 * localZoom, textY - textH / 2, textW, textH);
        }
        ctx.fill();
        
        // 겹침 발생 시 경계 구분을 위한 미세한 테두리 드로잉
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
        ctx.lineWidth = 0.8 * localZoom;
        ctx.stroke();

        // Actual label text
        if (node.isCompleted) {
          ctx.fillStyle = '#94A3B8';
        } else {
          ctx.fillStyle = (isActive || isTreeActive) ? '#0F172A' : '#475569';
        }
        ctx.fillText(labelText, node.renderX + textOffsetX, textY);

        // 상호작용 중이 아닐 때만 취소선 및 D-Day 뱃지 렌더링하여 오버헤드 방지
        if (!rc.isInteractive) {
          // Strikethrough
          if (node.isCompleted) {
            ctx.beginPath();
            ctx.moveTo(node.renderX + textOffsetX, textY);
            ctx.lineTo(node.renderX + textOffsetX + textWidth, textY);
            ctx.lineWidth = 1.2 * zoom;
            ctx.strokeStyle = '#94A3B8';
            ctx.stroke();
          }

          // Deadline (D-Day) badge overlay
          if (isActive && node.dueDate) {
            const parts = node.dueDate.split('-');
            if (parts.length === 3) {
              const targetZero = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
              const today = new Date();
              const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
              
              const diffTime = targetZero.getTime() - todayZero.getTime();
              const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
              const dDayStr = diffDays > 0 ? `D-${diffDays}` : diffDays === 0 ? 'D-Day' : `D+${Math.abs(diffDays)}`;
              
              const dateText = `⏰ ${dDayStr}`;
              const badgeFontSize = Math.round(9 * zoom);
              this.setFont(ctx, `bold ${badgeFontSize}px 'Pretendard', sans-serif`);
              ctx.fillStyle = diffDays <= 3 ? '#EF4444' : '#64748B';
              
              ctx.textAlign = 'left';
              ctx.fillText(dateText, node.renderX + textOffsetX + textWidth + 6 * localZoom, textY);
            }
          }
        }
      }

      node.nodeRadius = dotRadius / zoom;
    }

    // save/restore 호출을 소거한 대신 사용했던 캔버스 2D 속성 복원 초기화
    ctx.globalAlpha = 1.0;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  private static drawNodeTextInside(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    cy: number,
    radius: number,
    localZoom: number,
    isActive: boolean,
    isInteractive?: boolean
  ): void {
    if (isInteractive) {
      // 상호작용(줌, 패닝, 드래그) 중일 때는 measureText를 절대 부르지 않는 최속(Fast-path) 렌더링
      const fontSize = Math.round(Math.max(7.5 * localZoom, 10 * localZoom * (isActive ? 1.12 : 1.0)));
      this.setFont(ctx, `bold ${fontSize}px 'Pretendard', sans-serif`);
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // 글자 크기가 원 반지름에 맞지 않아 삐져나가는 것을 방지하기 위해, 상호작용 중에는 첫 단어만 노출하거나 적당히 잘라 1줄로 단순 렌더링
      const words = text.split(/\s+/);
      const displayStr = words[0] || '';
      const finalStr = displayStr.length > 5 ? displayStr.slice(0, 4) + '..' : displayStr;
      ctx.fillText(finalStr, cx, cy);
      return;
    }

    // 1. Text wrapping: split by space or custom delimiters
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      if (currentLine.length + word.length > 7) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine += ' ' + word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    // 2. Determine base font size based on radius
    let fontSize = Math.max(8.0 * localZoom, 11 * localZoom * (isActive ? 1.12 : 1.0));
    
    // Fit text inside circle
    const initialFontSize = Math.round(fontSize);
    this.setFont(ctx, `600 ${initialFontSize}px 'Pretendard', sans-serif`);
    let maxLineWidth = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxLineWidth) maxLineWidth = w;
    }
    
    const maxAllowedWidth = radius * 1.55; // 1.62 -> 1.55로 안전 마진 확보
    const totalHeight = lines.length * fontSize * 1.22;
    const maxAllowedHeight = radius * 1.55; // 1.62 -> 1.55

    if (maxLineWidth > maxAllowedWidth || totalHeight > maxAllowedHeight) {
      const scaleW = maxAllowedWidth / maxLineWidth;
      const scaleH = maxAllowedHeight / totalHeight;
      const scaleFactor = Math.min(scaleW, scaleH) * 0.93;
      fontSize = Math.max(7.2 * localZoom, fontSize * scaleFactor);
    }

    const finalFontSize = Math.round(fontSize);
    this.setFont(ctx, `bold ${finalFontSize}px 'Pretendard', sans-serif`);
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const startY = cy - ((lines.length - 1) * finalFontSize * 1.2) / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], cx, startY + i * finalFontSize * 1.2);
    }
  }
}
