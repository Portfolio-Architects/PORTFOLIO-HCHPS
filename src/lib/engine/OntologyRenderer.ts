import { OrbitalNode, OntologyEdge, EDGE_TYPE_LABELS, EdgeType } from '../ontology.types';
import { CULL_MARGIN, OntologyLayout, ELLIPSE_RATIO } from './OntologyLayout';
import { PerformanceProfiler } from './PerformanceProfiler';

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
  centralitySortedNodes?: OrbitalNode[];
}

export interface BatchedEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cpDist?: number;
  leftY?: number;
  rightY?: number;
  arrowX?: number;
  arrowY?: number;
  arrowAngle?: number;
  arrowSize?: number;
}

export class OntologyRenderer {
  private static lastActiveNodeId: string | null = null;
  private static cachedNeighborsSet = new Set<string>();
  private static lastActiveNodeIdForDescendants: string | null = null;
  private static cachedDescendantsSet = new Set<string>();
  private static textBoxPool: Array<{x1: number, y1: number, x2: number, y2: number}> = [];
  private static drawnTextBoxesList: Array<{x1: number, y1: number, x2: number, y2: number}> = [];
  private static colorMap = new Map<string, number>();
  private static colorCounter = 0;
  private static getColorId(color: string): number {
    let id = OntologyRenderer.colorMap.get(color);
    if (id === undefined) {
      id = OntologyRenderer.colorCounter++;
      OntologyRenderer.colorMap.set(color, id);
    }
    return id;
  }
  private static edgePool: BatchedEdge[] = [];
  private static edgePoolUsed = 0;
  private static flowParticlesPool: Array<{
    x: number;
    y: number;
    color: string;
    size: number;
    alpha: number;
  }> = [];
  private static flowParticlesPoolUsed = 0;
  private static flowParticlesList: Array<{
    x: number;
    y: number;
    color: string;
    size: number;
    alpha: number;
  }> = [];
  private static textAllowedSet = new Set<string>();
  private static fontParseCache = new Map<string, { weight: string; size: number }>();
  private static labelsToDrawPool: Array<{
    edge: OntologyEdge;
    leftRightX: number;
    rightLeftX: number;
    leftNode: OrbitalNode;
    rightNode: OrbitalNode;
    cpDist: number;
    avgScale: number;
    themeColor: string;
    alpha: number;
  }> = [];
  private static labelsToDrawPoolUsed = 0;
  private static labelsToDrawList: Array<{
    edge: OntologyEdge;
    leftRightX: number;
    rightLeftX: number;
    leftNode: OrbitalNode;
    rightNode: OrbitalNode;
    cpDist: number;
    avgScale: number;
    themeColor: string;
    alpha: number;
  }> = [];

  private static currentFont = '';
  private static currentFillStyle = '';
  private static currentStrokeStyle = '';
  private static currentLineWidth = -1;

  private static setFillStyle(ctx: CanvasRenderingContext2D, style: string) {
    if (this.currentFillStyle !== style) {
      ctx.fillStyle = style;
      this.currentFillStyle = style;
    }
  }

  private static setStrokeStyle(ctx: CanvasRenderingContext2D, style: string) {
    if (this.currentStrokeStyle !== style) {
      ctx.strokeStyle = style;
      this.currentStrokeStyle = style;
    }
  }

  private static setLineWidth(ctx: CanvasRenderingContext2D, width: number) {
    if (this.currentLineWidth !== width) {
      ctx.lineWidth = width;
      this.currentLineWidth = width;
    }
  }

  private static nodeCache = new Map<string, HTMLCanvasElement>();
  private static baseTextWidthCache = new Map<string, number>();
  private static tempProj1 = { x: 0, y: 0, scale: 0 };
  private static tempProj2 = { x: 0, y: 0, scale: 0 };
  private static cornersCache: Record<number, {
    p1: { x: number; y: number; scale: number };
    p2: { x: number; y: number; scale: number };
    p3: { x: number; y: number; scale: number };
    p4: { x: number; y: number; scale: number };
  }> = {
    0: { p1: { x: 0, y: 0, scale: 0 }, p2: { x: 0, y: 0, scale: 0 }, p3: { x: 0, y: 0, scale: 0 }, p4: { x: 0, y: 0, scale: 0 } },
    1: { p1: { x: 0, y: 0, scale: 0 }, p2: { x: 0, y: 0, scale: 0 }, p3: { x: 0, y: 0, scale: 0 }, p4: { x: 0, y: 0, scale: 0 } },
    2: { p1: { x: 0, y: 0, scale: 0 }, p2: { x: 0, y: 0, scale: 0 }, p3: { x: 0, y: 0, scale: 0 }, p4: { x: 0, y: 0, scale: 0 } },
    3: { p1: { x: 0, y: 0, scale: 0 }, p2: { x: 0, y: 0, scale: 0 }, p3: { x: 0, y: 0, scale: 0 }, p4: { x: 0, y: 0, scale: 0 } }
  };

  private static projectTo(
    wx: number, wy: number, h: number, 
    cosTilt: number, sinTilt: number, cameraDist: number, 
    cx: number, cy: number, zoom: number, 
    out: { x: number, y: number, scale: number }
  ): void {
    const rotatedY = wy * cosTilt - h * sinTilt;
    const depth = -wy * sinTilt + h * cosTilt;
    const perspectiveScale = Math.max(0.05, cameraDist / Math.max(120, cameraDist + depth));
    out.x = cx + wx * zoom * perspectiveScale;
    out.y = cy + rotatedY * zoom * perspectiveScale;
    out.scale = perspectiveScale;
  }
  private static edgeBatches = new Map<number, {
    themeColor: string;
    lineWidth: number;
    alpha: number;
    isDashed: boolean;
    edgesList: BatchedEdge[];
  }>();

  private static setFont(ctx: CanvasRenderingContext2D, fontStr: string) {
    if (this.currentFont !== fontStr) {
      ctx.font = fontStr;
      this.currentFont = fontStr;
    }
  }

  private static parseFont(fontStr: string): { weight: string; size: number } {
    let cached = OntologyRenderer.fontParseCache.get(fontStr);
    if (!cached) {
      const weightMatch = fontStr.match(/^(bold|600|500)/);
      const weight = weightMatch ? weightMatch[1] : '500';
      const sizeMatch = fontStr.match(/(\d+(?:\.\d+)?)px/);
      const fontSize = sizeMatch ? parseFloat(sizeMatch[1]) : 12;
      cached = { weight, size: fontSize };
      OntologyRenderer.fontParseCache.set(fontStr, cached);
    }
    return cached;
  }

  private static getTextWidth(ctx: CanvasRenderingContext2D, text: string, fontStr: string): number {
    const parsed = OntologyRenderer.parseFont(fontStr);
    const weight = parsed.weight;
    const fontSize = parsed.size;

    const cacheKey = `${text}|||${weight}`;
    let baseW = this.baseTextWidthCache.get(cacheKey);
    if (baseW === undefined) {
      const testFont = `${weight} 12px 'Pretendard', sans-serif`;
      this.setFont(ctx, testFont);
      baseW = ctx.measureText(text).width;
      this.baseTextWidthCache.set(cacheKey, baseW);
      this.currentFont = '';
    }
    return baseW * (fontSize / 12);
  }

  private static getOrCreateNodeTemplate(color: string, isCompleted: boolean, isCluster: boolean): HTMLCanvasElement {
    const key = `${color}_${isCompleted ? 'completed' : 'active'}_${isCluster ? 'cluster' : 'normal'}`;
    if (this.nodeCache.has(key)) {
      return this.nodeCache.get(key)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const cx = 64;
    const cy = 64;
    const r = 58;

    ctx.clearRect(0, 0, 128, 128);

    // Core Flat circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // White border (Flat UI style)
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = isCluster ? 6.5 : 4.5;
    ctx.stroke();

    this.nodeCache.set(key, canvas);
    return canvas;
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
    this.currentFillStyle = '';
    this.currentStrokeStyle = '';
    this.currentLineWidth = -1;
    const { ctx, canvasW, canvasH, nodes, centerNode, nodeMap, layoutMode = 'mindmap' } = context;

    this.assignThemes(nodes, centerNode, nodeMap);

    const tBg0 = performance.now();
    this.renderBackground(ctx, canvasW, canvasH);
    
    if (layoutMode === 'orbit') {
      this.renderOrbitRings(context);
    } else if (layoutMode === 'cluster') {
      // 포도송이(Cluster) 뷰: 수직 적층 플레이트 그리기를 건너뛰어 시각적 겹침 방지
    } else {
      this.renderBackgroundLayers(context);
    }
    const tBg1 = performance.now();
    PerformanceProfiler.getInstance().recordBackground(tBg1 - tBg0);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const tEd0 = performance.now();
    this.renderEdges(context);
    const tEd1 = performance.now();
    PerformanceProfiler.getInstance().recordEdges(tEd1 - tEd0);

    const tNd0 = performance.now();
    this.renderNodes(context);
    const tNd1 = performance.now();
    PerformanceProfiler.getInstance().recordNodes(tNd1 - tNd0);
  }

  private static renderBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 캔버스 배경에 무거운 radial gradient를 그리지 않고 clearRect로 픽셀을 완전히 비웁니다.
    // 배경은 wrapper div의 CSS radial-gradient를 활용해 브라우저 하드웨어 가속(GPU)으로 렌더링되게 이관합니다.
    ctx.clearRect(0, 0, width, height);
  }

  private static renderBackgroundLayers(rc: RenderContext): void {
    const { ctx, canvasW, canvasH, zoom, cameraOffsetX = 0, cameraOffsetY = 0 } = rc;
    ctx.save();
    
    const cx = canvasW / 2 + cameraOffsetX;
    const cy = canvasH / 2 + cameraOffsetY;
    const cosTilt = Math.cos(OntologyLayout.tiltAngle);
    const sinTilt = Math.sin(OntologyLayout.tiltAngle);
    const cameraDist = 800;
    
    // 레이어 L0 ~ L3의 3D 아크릴 판 그리기 (뒤에서부터 조감도로 정렬되어 아래서부터 그림)
    const layers = [3, 2, 1, 0];
    const width = 350; // 아크릴 판 가로 반지름
    const height = 280; // 아크릴 판 세로 반지름
    
    for (const layer of layers) {
      if (OntologyLayout.filterLayers && !OntologyLayout.filterLayers.has(layer)) continue;
      
      const h = layer * OntologyLayout.LAYER_GAP;
      
      // 4개 모서리 좌표 투영
      const corners = [
        { wx: -width * ELLIPSE_RATIO, wy: -height },
        { wx: width * ELLIPSE_RATIO, wy: -height },
        { wx: width * ELLIPSE_RATIO, wy: height },
        { wx: -width * ELLIPSE_RATIO, wy: height }
      ];
      
      const projected = corners.map(c => {
        const rotatedY = c.wy * cosTilt - h * sinTilt;
        const depth = -c.wy * sinTilt + h * cosTilt;
        const pScale = Math.max(0.05, cameraDist / Math.max(120, cameraDist + depth));
        return {
          x: cx + c.wx * zoom * pScale,
          y: cy + rotatedY * zoom * pScale
        };
      });
      
      // 판 채우기 및 테두리선 그리기
      const colors = [
        { fill: 'rgba(59, 130, 246, 0.012)', stroke: 'rgba(59, 130, 246, 0.08)', label: 'L0 인물 (Agent)' },
        { fill: 'rgba(16, 185, 129, 0.012)', stroke: 'rgba(16, 185, 129, 0.08)', label: 'L1 예산 (Resource)' },
        { fill: 'rgba(245, 158, 11, 0.012)', stroke: 'rgba(245, 158, 11, 0.08)', label: 'L2 업무 (Execution)' },
        { fill: 'rgba(139, 92, 246, 0.012)', stroke: 'rgba(139, 92, 246, 0.08)', label: 'L3 위키 (Knowledge)' }
      ];
      
      const { fill, stroke, label } = colors[layer];
      
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.2;
      
      ctx.beginPath();
      ctx.moveTo(projected[0].x, projected[0].y);
      for (let i = 1; i < 4; i++) {
        ctx.lineTo(projected[i].x, projected[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // 레이어 이름 텍스트 그리기
      ctx.fillStyle = layer === 0 ? '#3B82F6' : layer === 1 ? '#10B981' : layer === 2 ? '#F59E0B' : '#8B5CF6';
      ctx.font = "bold 9px 'Pretendard', sans-serif";
      ctx.fillText(label, projected[0].x + 10, projected[0].y + 15);
    }
    
    ctx.restore();
  }

  private static renderOrbitRings(rc: RenderContext): void {
    const { ctx, canvasW, canvasH, zoom, cameraOffsetX = 0, cameraOffsetY = 0 } = rc;
    
    ctx.save();
    
    const cx = canvasW / 2 + cameraOffsetX;
    const cy = canvasH / 2 + cameraOffsetY;
    const cosTilt = Math.cos(OntologyLayout.tiltAngle);
    const sinTilt = Math.sin(OntologyLayout.tiltAngle);
    const cameraDist = 800;
    
    // 각 레이어(L0 ~ L3)마다 기울어진 궤도 링을 그려 입체 레이어 스택을 시각화
    const layers = Array.from(OntologyLayout.filterLayers).sort((a, b) => b - a);
    
    for (const layer of layers) {
      const h = layer * OntologyLayout.LAYER_GAP;
      const strokeColor = layer === 0 ? 'rgba(59, 130, 246, 0.12)' : layer === 1 ? 'rgba(16, 185, 129, 0.12)' : layer === 2 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(139, 92, 246, 0.12)';
      
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      
      // 1 ~ 4차 궤도에 대한 링 그리기
      for (let i = 1; i <= 4; i++) {
        const R = OntologyLayout.getOrbitRadius(i);
        if (R <= 0) continue;
        
        ctx.beginPath();
        const segments = 64;
        for (let j = 0; j <= segments; j++) {
          const theta = (j / segments) * Math.PI * 2;
          const wx = R * Math.cos(theta) * ELLIPSE_RATIO;
          const wy = R * Math.sin(theta);
          
          const rotatedY = wy * cosTilt - h * sinTilt;
          const depth = -wy * sinTilt + h * cosTilt;
          const pScale = Math.max(0.05, cameraDist / Math.max(120, cameraDist + depth));
          
          const rx = cx + wx * zoom * pScale;
          const ry = cy + rotatedY * zoom * pScale;
          
          if (j === 0) {
            ctx.moveTo(rx, ry);
          } else {
            ctx.lineTo(rx, ry);
          }
        }
        ctx.stroke();
      }
    }
    
    ctx.restore();
  }

  private static renderEdges(rc: RenderContext): void {
    const { ctx, edges, nodeMap, activeNodeId, activeTreeSet, canvasW, canvasH, layoutMode = 'mindmap' } = rc;
    const isFastPath = !!(rc.isInteractive || rc.isOrbiting);

    // Spanning Tree 구조 엣지를 O(1) 룩업하기 위한 캐시된 빌드셋 가져오기
    const spanningTreeEdgeSet = OntologyLayout.lastSpanningTreeEdgeSet;

    OntologyRenderer.edgePoolUsed = 0;
    OntologyRenderer.flowParticlesList.length = 0;
    OntologyRenderer.flowParticlesPoolUsed = 0;
    for (const [, b] of OntologyRenderer.edgeBatches) {
      b.edgesList.length = 0;
    }

    OntologyRenderer.labelsToDrawList.length = 0;
    OntologyRenderer.labelsToDrawPoolUsed = 0;

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
      // 줌 레벨이 극도로 낮고(zoom < 0.38) 상호작용 중일 때, Spanning Tree에 소속되지 않은 일반 교차 엣지는 continue로 드로잉을 즉각 스킵합니다.
      if (isCrossEdge && (rc.zoom < 0.38 || isFastPath)) {
         continue;
      }

      // Frustum cull
      if (src.renderX < -CULL_MARGIN && tgt.renderX < -CULL_MARGIN) continue;
      if (src.renderX > canvasW + CULL_MARGIN && tgt.renderX > canvasW + CULL_MARGIN) continue;
      if (src.renderY < -CULL_MARGIN && tgt.renderY < -CULL_MARGIN) continue;
      if (src.renderY > canvasH + CULL_MARGIN && tgt.renderY > canvasH + CULL_MARGIN) continue;

      // Smooth step bezier variables (좌에서 우로)
      // 콤팩트해진 텍스트 박스 크기에 맞춰 선의 시작점을 안쪽으로 축소
      const leftScale = leftNode.perspectiveScale ?? 1.0;
      const rightScale = rightNode.perspectiveScale ?? 1.0;
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
      
      if (srcLayer !== tgtLayer) {
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
          alpha = 0.22; // 직접 선택된 노드의 엣지 강조를 극도로 제한
          lineWidth = 0.8 * rc.zoom * avgScale;
      } else if (isConnectedToTree) {
          alpha = 0.18; // 활성 트리에 속한 엣지도 은은하게
          lineWidth = 0.6 * rc.zoom * avgScale;
      } else if (activeNodeId) {
          // 외부 엣지도 최소 0.08 이상의 alpha를 부여하여 외곽 노드 간 결속 관계 파악이 가능하게 보정
          alpha = 0.08;
          lineWidth = 0.3 * rc.zoom * avgScale;
      } else if (isCrossEdge) {
          alpha = 0.06; 
          lineWidth = 0.3 * rc.zoom * avgScale;
      }
      
      const finalAlpha = alpha * Math.max(0.3, avgScale);
      const isDashed = edge.weight < 0;

      // 3차 최적화: 스타일 키 이산 양자화 (0.2 및 0.1 단위) + 부동소수점 오차 박멸용 포맷팅
      const roundedLineWidth = Number((Math.round(lineWidth * 5) / 5).toFixed(2));
      const roundedAlpha = Number((Math.round(finalAlpha * 10) / 10).toFixed(2));

      // 16차 최적화: 문자열 키 생성 오버헤드와 가비지 컬렉션을 차단하기 위해 스타일 요소를 32비트 정수로 인코딩
      const colorId = OntologyRenderer.getColorId(themeColor);
      const lwInt = Math.round(roundedLineWidth * 5) & 0xFF; // 8비트
      const aInt = Math.round(roundedAlpha * 10) & 0xFF; // 8비트
      const dashInt = isDashed ? 1 : 0; // 1비트
      const styleKeyInt = (colorId << 17) | (lwInt << 9) | (aInt << 1) | dashInt;

      let batch = OntologyRenderer.edgeBatches.get(styleKeyInt);
      if (!batch) {
        batch = {
          themeColor,
          lineWidth: roundedLineWidth,
          alpha: roundedAlpha,
          isDashed,
          edgesList: []
        };
        OntologyRenderer.edgeBatches.set(styleKeyInt, batch);
      } else {
        batch.themeColor = themeColor;
        batch.lineWidth = roundedLineWidth;
        batch.alpha = roundedAlpha;
        batch.isDashed = isDashed;
      }

      // 17차 최적화: 매 프레임 객체 리터럴 생성을 방지하기 위한 간선 오브젝트 풀 적용
      let batchedEdge: BatchedEdge;
      if (OntologyRenderer.edgePoolUsed < OntologyRenderer.edgePool.length) {
        batchedEdge = OntologyRenderer.edgePool[OntologyRenderer.edgePoolUsed++];
      } else {
        batchedEdge = { x1: 0, y1: 0, x2: 0, y2: 0 };
        OntologyRenderer.edgePool.push(batchedEdge);
        OntologyRenderer.edgePoolUsed++;
      }
      batchedEdge.x1 = leftRightX;
      batchedEdge.y1 = leftNode.renderY;
      batchedEdge.x2 = rightLeftX;
      batchedEdge.y2 = rightNode.renderY;
      batchedEdge.cpDist = cpDist;
      batchedEdge.leftY = leftNode.renderY;
      batchedEdge.rightY = rightNode.renderY;
      batchedEdge.arrowX = undefined;
      batchedEdge.arrowY = undefined;
      batchedEdge.arrowAngle = undefined;
      batchedEdge.arrowSize = undefined;

      if (layoutMode === 'cluster') {
        const dx = tgt.renderX - src.renderX;
        const dy = tgt.renderY - src.renderY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 10) {
          const ux = dx / dist;
          const uy = dy / dist;
          
          const srcR = src.nodeRadius * rc.zoom * (src.perspectiveScale ?? 1.0);
          const tgtR = tgt.nodeRadius * rc.zoom * (tgt.perspectiveScale ?? 1.0);
          
          batchedEdge.x1 = src.renderX + ux * srcR;
          batchedEdge.y1 = src.renderY + uy * srcR;
          batchedEdge.x2 = tgt.renderX - ux * tgtR;
          batchedEdge.y2 = tgt.renderY - uy * tgtR;
          
          batchedEdge.arrowX = batchedEdge.x2;
          batchedEdge.arrowY = batchedEdge.y2;
          batchedEdge.arrowAngle = Math.atan2(dy, dx);
          batchedEdge.arrowSize = 6.5 * rc.zoom * avgScale;
        }
      }

      batch.edgesList.push(batchedEdge);

      // 펄스/흐름 파티클 효과 추가
      // 활성화된 노드와 연결되어 있거나 트리 구조 내에 속한 엣지에 대해서 시각적 흐름(Pulse)을 추가하여 동적인 관계성을 연출
      const isFlowActive = isDirectlyConnectedToActive || isConnectedToTree;
      if (isFlowActive) {
        const time = performance.now();
        const flows = [
          (time / 2000) % 1.0,
          ((time / 2000) + 0.5) % 1.0
        ];
        const isLinear = layoutMode === 'orbit' || (rc.zoom < 0.5);
        const isCluster = layoutMode === 'cluster';
        
        for (const flowT of flows) {
          let px = 0;
          let py = 0;
          
          if (isLinear || isCluster) {
            // 직선 보간
            px = batchedEdge.x1 + (batchedEdge.x2 - batchedEdge.x1) * flowT;
            py = batchedEdge.y1 + (batchedEdge.y2 - batchedEdge.y1) * flowT;
          } else {
            // 3차 베지어 곡선 보간
            const cp1x = batchedEdge.x1 + cpDist;
            const cp1y = leftNode.renderY;
            const cp2x = batchedEdge.x2 - cpDist;
            const cp2y = rightNode.renderY;
            
            const mt = 1 - flowT;
            const mt2 = mt * mt;
            const mt3 = mt2 * mt;
            const t2 = flowT * flowT;
            const t3 = t2 * flowT;
            
            px = mt3 * batchedEdge.x1 + 3 * mt2 * flowT * cp1x + 3 * mt * t2 * cp2x + t3 * batchedEdge.x2;
            py = mt3 * batchedEdge.y1 + 3 * mt2 * flowT * cp1y + 3 * mt * t2 * cp2y + t3 * rightNode.renderY;
          }
          
          let particle;
          if (OntologyRenderer.flowParticlesPoolUsed < OntologyRenderer.flowParticlesPool.length) {
            particle = OntologyRenderer.flowParticlesPool[OntologyRenderer.flowParticlesPoolUsed++];
          } else {
            particle = { x: 0, y: 0, color: '', size: 0, alpha: 0 };
            OntologyRenderer.flowParticlesPool.push(particle);
            OntologyRenderer.flowParticlesPoolUsed++;
          }
          
          particle.x = px;
          particle.y = py;
          particle.color = themeColor;
          particle.size = 2.0 * rc.zoom * Math.max(0.4, avgScale);
          const edgeAlpha = Math.sin(flowT * Math.PI) * 0.85; 
          particle.alpha = edgeAlpha * roundedAlpha;
          
          OntologyRenderer.flowParticlesList.push(particle);
        }
      }

      const isDirectlyConnectedToHover = rc.hoveredNodeId && (rc.hoveredNodeId === src.id || rc.hoveredNodeId === tgt.id);

      // 4. 활성화된 노드나 마우스가 올라간 노드에 연결된 엣지 중, 불필요한 노이즈를 방지하기 위해 
      // 기본 '의존성(DEPENDENCY)'을 제외한 특수 관계만 라벨 렌더링
      const shouldDrawLabel = (isDirectlyConnectedToActive || isDirectlyConnectedToHover) && 
                              !isCrossEdge && 
                              edge.type !== 'DEPENDENCY';

      if (shouldDrawLabel) {
        let labelItem;
        if (OntologyRenderer.labelsToDrawPoolUsed < OntologyRenderer.labelsToDrawPool.length) {
          labelItem = OntologyRenderer.labelsToDrawPool[OntologyRenderer.labelsToDrawPoolUsed++];
        } else {
          labelItem = {
            edge,
            leftRightX,
            rightLeftX,
            leftNode,
            rightNode,
            cpDist,
            avgScale,
            themeColor,
            alpha
          };
          OntologyRenderer.labelsToDrawPool.push(labelItem);
          OntologyRenderer.labelsToDrawPoolUsed++;
        }
        labelItem.edge = edge;
        labelItem.leftRightX = leftRightX;
        labelItem.rightLeftX = rightLeftX;
        labelItem.leftNode = leftNode;
        labelItem.rightNode = rightNode;
        labelItem.cpDist = cpDist;
        labelItem.avgScale = avgScale;
        labelItem.themeColor = themeColor;
        labelItem.alpha = alpha;

        OntologyRenderer.labelsToDrawList.push(labelItem);
      }
    }

    // 일괄 배치 렌더링 시작 (Draw calls 극단적 최적화)
    for (const [, batch] of OntologyRenderer.edgeBatches) {
      if (batch.edgesList.length === 0) continue;
      ctx.globalAlpha = batch.alpha;
      ctx.strokeStyle = batch.themeColor;
      ctx.lineWidth = batch.lineWidth;
      
      if (batch.isDashed) ctx.setLineDash([4, 4]);
      else ctx.setLineDash([]);

      ctx.beginPath();
      const isExtremeZoomOut = rc.zoom < 0.5;
      const isLinear = layoutMode === 'orbit' || isExtremeZoomOut;
      const isCluster = layoutMode === 'cluster';

      if (isLinear) {
        for (const e of batch.edgesList) {
          ctx.moveTo(e.x1, e.y1);
          ctx.lineTo(e.x2, e.y2);
        }
      } else if (isCluster) {
        for (const e of batch.edgesList) {
          if (e.x1 !== undefined && e.y1 !== undefined && e.x2 !== undefined && e.y2 !== undefined) {
            ctx.moveTo(e.x1, e.y1);
            ctx.lineTo(e.x2, e.y2);
          }
        }
      } else {
        for (const e of batch.edgesList) {
          ctx.moveTo(e.x1, e.y1);
          ctx.bezierCurveTo(
            e.x1 + e.cpDist!, e.leftY!,
            e.x2 - e.cpDist!, e.rightY!,
            e.x2, e.rightY!
          );
        }
      }
      ctx.stroke();

      // 포도송이 모드 화살표 머리 깃 드로잉
      if (layoutMode === 'cluster') {
        for (const e of batch.edgesList) {
          if (e.arrowX !== undefined && e.arrowY !== undefined && e.arrowAngle !== undefined) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(e.arrowX, e.arrowY);
            ctx.lineTo(
              e.arrowX - e.arrowSize! * Math.cos(e.arrowAngle - Math.PI / 6),
              e.arrowY - e.arrowSize! * Math.sin(e.arrowAngle - Math.PI / 6)
            );
            ctx.lineTo(
              e.arrowX - e.arrowSize! * Math.cos(e.arrowAngle + Math.PI / 6),
              e.arrowY - e.arrowSize! * Math.sin(e.arrowAngle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fillStyle = batch.themeColor;
            ctx.globalAlpha = batch.alpha;
            ctx.fill();
            ctx.restore();
          }
        }
      }
    }

    // flowParticlesList 에 쌓인 펄스 파티클들을 렌더링
    if (OntologyRenderer.flowParticlesList.length > 0) {
      ctx.save();
      for (const p of OntologyRenderer.flowParticlesList) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6 * rc.zoom;
        ctx.fill();
      }
      ctx.restore();
    }

    // 엣지 텍스트 라벨 일괄 드로잉
    for (const item of OntologyRenderer.labelsToDrawList) {
      const { edge, leftRightX, rightLeftX, leftNode, rightNode, avgScale, themeColor, alpha } = item;
      ctx.save();
      
      const midX = (leftRightX + rightLeftX) / 2;
      const midY = (leftNode.renderY + rightNode.renderY) / 2;

      const labelText = EDGE_TYPE_LABELS[edge.type as EdgeType] || '';
      if (labelText) {
        const fontSize = Math.round(8.5 * rc.zoom * avgScale);
        this.setFont(ctx, `600 ${fontSize}px 'Pretendard', sans-serif`);
        
        const STATIC_LABEL_WIDTHS: Record<EdgeType, number> = {
          CAUSAL_DRIVE:  36,
          DEPENDENCY:    27,
          FEEDBACK_LOOP: 54,
          BOTTLENECK:    18,
          DECOUPLING:    36,
          ASSIGNEE:      45,
          BUDGET_SOURCE: 36,
          COMPONENTS:    36,
        };
        const baseWidth = STATIC_LABEL_WIDTHS[edge.type as EdgeType] || (labelText.length * 9);
        const labelWidth = baseWidth * (fontSize / 12);
        const padX = 6 * rc.zoom * avgScale;
        const padY = 4 * rc.zoom * avgScale;
        const rectW = labelWidth + padX * 2;
        const rectH = fontSize + padY * 2;

        ctx.globalAlpha = Math.min(1.0, alpha * 1.5);
        
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

        ctx.fillStyle = '#1E293B';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, midX, midY + 0.5 * rc.zoom * avgScale);
      }
      
      ctx.restore();
    }

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
    const { ctx, sortedNodesBuffer, activeNodeId, hoveredNodeId, activeTreeSet, canvasW, canvasH, zoom, layoutMode = 'mindmap' } = rc;
    const isFastPath = !!(rc.isInteractive || rc.isOrbiting);

    // activeNodeId가 존재할 때 그의 이웃 노드들을 O(1) 조회용 Set으로 구성 (매 프레임 edges 순회 방지 캐싱)
    if (activeNodeId !== this.lastActiveNodeId) {
      this.cachedNeighborsSet.clear();
      if (activeNodeId) {
        for (const edge of rc.edges) {
          if (edge.source === activeNodeId) {
            this.cachedNeighborsSet.add(edge.target);
          } else if (edge.target === activeNodeId) {
            this.cachedNeighborsSet.add(edge.source);
          }
        }
      }
      this.lastActiveNodeId = activeNodeId;
    }
    const neighborsSet = this.cachedNeighborsSet;

    // activeNodeId가 변경되었을 때 하위 자손 노드들을 캐싱 (BFS)
    if (activeNodeId !== this.lastActiveNodeIdForDescendants) {
      this.cachedDescendantsSet.clear();
      if (activeNodeId && activeNodeId !== 'root-HCHPS') {
        const queue = [activeNodeId];
        while (queue.length > 0) {
          const currentId = queue.shift()!;
          const children = OntologyLayout.lastTreeChildrenMap.get(currentId) || [];
          for (const childId of children) {
            if (!this.cachedDescendantsSet.has(childId)) {
              this.cachedDescendantsSet.add(childId);
              queue.push(childId);
            }
          }
        }
      }
      this.lastActiveNodeIdForDescendants = activeNodeId;
    }
    const descendantsSet = this.cachedDescendantsSet;

    // 1. 전역 텍스트 겹침 방지(Text Overlap Prevention) 사전 계산 (textBoxPool 활용을 통한 GC 프리)
    this.drawnTextBoxesList.length = 0;
    let poolIdx = 0;
    const getTextBoxFromPool = (x1: number, y1: number, x2: number, y2: number) => {
      if (poolIdx >= this.textBoxPool.length) {
        this.textBoxPool.push({ x1: 0, y1: 0, x2: 0, y2: 0 });
      }
      const box = this.textBoxPool[poolIdx++];
      box.x1 = x1;
      box.y1 = y1;
      box.x2 = x2;
      box.y2 = y2;
      return box;
    };
    OntologyRenderer.textAllowedSet.clear();

    // 중요도(renderSize) 내림차순으로 정렬된 노드 리스트 복사본 생성 (캐시가 있으면 캐시 사용)
    const centralitySorted = rc.centralitySortedNodes || [...sortedNodesBuffer].sort((a, b) => {
      const sizeA = a.renderSize ?? 0.5;
      const sizeB = b.renderSize ?? 0.5;
      return sizeB - sizeA;
    });

    if (isFastPath) {
      // 상호작용(드래그, 줌, 패닝, 공전 등) 중일 때는 오버헤드가 큰 겹침 검사를 전면 생략하고
      // 오직 루트 노드, 활성 노드, 호버 노드, 핵심 노드, 그리고 활성 노드의 이웃 노드 및 활성 트리 노드에 텍스트 드로잉 허용
      for (const node of centralitySorted) {
        if (node.layoutHidden) continue;
        const isActive = node.id === activeNodeId;
        const isHovered = node.id === hoveredNodeId;
        const isCenter = node.orbitIndex === 0;
        const isHighlyCentral = (node.renderSize ?? 0.5) > 0.85;
        const isNeighbor = activeNodeId && neighborsSet.has(node.id);
        const isTreeActive = activeNodeId && activeTreeSet.has(node.id);
        const isDirectChild = !!(activeNodeId && node.parentId === activeNodeId);

        if (isCenter || isActive || isHovered || isHighlyCentral || isDirectChild || isNeighbor || isTreeActive) {
          OntologyRenderer.textAllowedSet.add(node.id);
        }
      }
    } else {
      const gridCellSize = 120;
      const spatialGrid = new Map<string, Array<{x1: number, y1: number, x2: number, y2: number}>>();

      const getGridKeys = (x1: number, y1: number, x2: number, y2: number) => {
        const keys = new Set<string>();
        const colStart = Math.floor(x1 / gridCellSize);
        const colEnd = Math.floor(x2 / gridCellSize);
        const rowStart = Math.floor(y1 / gridCellSize);
        const rowEnd = Math.floor(y2 / gridCellSize);

        for (let r = rowStart; r <= rowEnd; r++) {
          for (let c = colStart; c <= colEnd; c++) {
            keys.add(`${r},${c}`);
          }
        }
        return keys;
      };

      const addBoxToGrid = (box: {x1: number, y1: number, x2: number, y2: number}) => {
        const keys = getGridKeys(box.x1, box.y1, box.x2, box.y2);
        for (const key of keys) {
          if (!spatialGrid.has(key)) {
            spatialGrid.set(key, []);
          }
          spatialGrid.get(key)!.push(box);
        }
      };

      const checkOverlapWithGrid = (rect: {x1: number, y1: number, x2: number, y2: number}) => {
        const keys = getGridKeys(rect.x1, rect.y1, rect.x2, rect.y2);
        for (const key of keys) {
          const boxes = spatialGrid.get(key);
          if (boxes) {
            for (const box of boxes) {
              if (!(rect.x2 < box.x1 || rect.x1 > box.x2 || rect.y2 < box.y1 || rect.y1 > box.y2)) {
                return true;
              }
            }
          }
        }
        return false;
      };

      for (const node of centralitySorted) {
        if (node.layoutHidden) continue;
        
        const isActive = node.id === activeNodeId;
        const isHovered = node.id === hoveredNodeId;

        // 최상위 루트 노드, 활성 노드, 호버 노드는 무조건 텍스트 표시 허용 (자식/이웃 노드는 겹침 검사 단계로 이양)
        if (node.orbitIndex === 0 || isActive || isHovered) {
          OntologyRenderer.textAllowedSet.add(node.id);
          
          // 예상 바운딩 박스 계산 및 등록
          const nodeScale = node.perspectiveScale ?? 1.0;
          const sizeFactor = 0.8 + 0.5 * (node.renderSize ?? 0.5);
          const localZoom = zoom * nodeScale * sizeFactor;
          const dotRadius = Math.max(0.1, (4 + 6 * sizeFactor) * localZoom * (isActive || isHovered ? 1.15 : 1.0));
          const textOffsetX = dotRadius + 6 * localZoom;
          const fontSize = Math.round((12 * localZoom) / 2) * 2;
          
          let textWidth = (node.label || '').length * 7.5;
          if (node._cachedTextWidth) {
            const cache = node._cachedTextWidth;
            textWidth = cache['600'] || cache['500'] || textWidth;
          }
          
          const textH = fontSize + 4 * localZoom;
          const textW = textWidth + 8 * localZoom;
          const x1 = node.renderX + textOffsetX - 4 * localZoom - 6;
          const y1 = node.renderY - textH / 2 - 3;
          const x2 = x1 + textW + 12;
          const y2 = y1 + textH + 6;
          
          const box = getTextBoxFromPool(x1, y1, x2, y2);
          this.drawnTextBoxesList.push(box);
          addBoxToGrid(box);
          continue;
        }

        // 화면 Frustum 영역 바깥 노드는 계산 생략
        if (node.renderX < -CULL_MARGIN || node.renderX > canvasW + CULL_MARGIN ||
            node.renderY < -CULL_MARGIN || node.renderY > canvasH + CULL_MARGIN) {
          continue;
        }

        // 텍스트 라벨 최대 등록 한계 설정 (줌이 극도로 작을 때는 복잡도 방지를 위해 100개로 축소 제한)
        const maxTextLimit = zoom < 0.5 ? 100 : 220;
        if (this.drawnTextBoxesList.length >= maxTextLimit) {
          continue;
        }

        // 텍스트 바운딩 박스 계산
        const nodeScale = node.perspectiveScale ?? 1.0;
        const sizeFactor = 0.8 + 0.5 * (node.renderSize ?? 0.5);
        const localZoom = zoom * nodeScale * sizeFactor;
        const dotRadius = Math.max(0.1, (4 + 6 * sizeFactor) * localZoom);
        const textOffsetX = dotRadius + 6 * localZoom;
        // 3차 최적화: 폰트 크기를 2px 단위로 양자화하여 캐시 히트율을 올림
        const fontSize = Math.round((12 * localZoom) / 2) * 2;
        
        let textWidth = (node.label || '').length * 7.5;
        if (node._cachedTextWidth) {
          const cache = node._cachedTextWidth;
          textWidth = cache['600'] || cache['500'] || textWidth;
        }
        
        const textH = fontSize + 4 * localZoom;
        const textW = textWidth + 8 * localZoom;
        
        // 여유 마진 버퍼를 포함하여 겹침 검사 (줌 배율이 작을 시 충돌 마진 대폭 축소)
        const marginX = zoom < 0.5 ? 2 : 8;
        const marginY = zoom < 0.5 ? 1 : 4;
        const x1 = node.renderX + textOffsetX - 4 * localZoom - marginX;
        const y1 = node.renderY - textH / 2 - marginY;
        const x2 = x1 + textW + (marginX * 2);
        const y2 = y1 + textH + (marginY * 2);

        const rect = { x1, y1, x2, y2 };
        
        // 이미 그려진 텍스트 박스들과의 겹침 검사 (공간 분할 테이블 조회)
        const hasOverlap = checkOverlapWithGrid(rect);

        if (!hasOverlap) {
          OntologyRenderer.textAllowedSet.add(node.id);
          const box = getTextBoxFromPool(x1, y1, x2, y2);
          this.drawnTextBoxesList.push(box);
          addBoxToGrid(box);
        }
      }
    }

    // No-op shadow setup: shadowBlur is completely bypass-optimized to prevent frame drops

    for (const node of sortedNodesBuffer) {
      if (node.layoutHidden) continue;
      if (node.renderX < -CULL_MARGIN || node.renderX > canvasW + CULL_MARGIN) continue;
      if (node.renderY < -CULL_MARGIN || node.renderY > canvasH + CULL_MARGIN) continue;

      const isActive = node.id === activeNodeId;
      const isTreeActive = activeNodeId && activeTreeSet.has(node.id);
      const isHovered = node.id === hoveredNodeId;
      const isNeighbor = activeNodeId && neighborsSet.has(node.id);
      
      // 외곽 노드를 포함한 모든 노드는 항상 투명도 1.0으로 진하게 활성화
      const opacity = 1.0;
      const isInactiveOutsideFocus = !!(activeNodeId && !isActive && !isTreeActive && !isNeighbor && node.id !== 'root-HCHPS');

      const nodeScale = node.perspectiveScale ?? 1.0;
      const weight = node.renderSize ?? 0.5;
      const sizeFactor = 0.8 + 0.5 * weight; // 0.8배 ~ 1.3배 가중치 비례 스케일링
      const localZoom = zoom * nodeScale * sizeFactor;

      ctx.globalAlpha = opacity;

      // ─── Semantic Zooming (LOD 2.0) 최적화 및 텍스트 겹침 방지 ───
      // 전역 겹침 사전 계산 결과에 의해 라벨이 허용되지 않은 노드는 100% 도트(Dot)로 렌더링
      const isLODDot = !OntologyRenderer.textAllowedSet.has(node.id);

      if (isLODDot) {
        const themeColor = node.themeColor || '#94A3B8';
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

      const isCenter = node.orbitIndex === 0;

      let labelText = node.label || '';
      const isCategoryNode = node.orbitIndex !== undefined && node.orbitIndex <= 3;
      const isCategory1 = node.orbitIndex === 1;
      const isDirectChild = activeNodeId && node.parentId === activeNodeId;
      const isDescendant = activeNodeId && descendantsSet.has(node.id);
      // 오직 중심 노드, 클릭된 노드(isActive), 호버 중인 노드(isHovered), 1차 카테고리 노드(isCategory1), 활성 노드의 직속 자식 노드(isDirectChild) 및 자손 노드만 풀네임 노출.
      // 3차 카테고리 이하 노드(isCategoryNode)는 활성 노드가 없을 때(!activeNodeId)만 풀네임 노출 허용.
      const skipTruncate = isActive || isHovered || isCenter || isDirectChild || isDescendant || isCategory1 || (!activeNodeId && isCategoryNode);
      if (!skipTruncate && labelText.length > 7) {
        labelText = labelText.substring(0, 7) + '...';
      }
      
      // 측정 캐시 최적화
      const weightStyle = (isActive || isTreeActive) ? '600' : '500';
      const cacheKey = `${weightStyle}_${labelText}`;
      if (!node._cachedTextWidth) node._cachedTextWidth = {};
      if (!node._cachedTextWidth[cacheKey]) {
          node._cachedTextWidth[cacheKey] = this.getTextWidth(ctx, labelText, `${weightStyle} 12px 'Pretendard', sans-serif`);
      }
      const textWidth = node._cachedTextWidth[cacheKey] * localZoom;

      // NotebookLM 스타일: 콤팩트한 노드 사이즈
      // 3차 최적화: 폰트 크기를 2px 단위로 양자화하여 캐시 히트율을 올림
      const fontSize = Math.max(9.5, Math.round((12 * localZoom) / 2) * 2);
      this.setFont(ctx, `${weightStyle} ${fontSize}px 'Pretendard', sans-serif`);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const isCluster = layoutMode === 'cluster';
      const themeColor = node.themeColor || '#94A3B8';

      // 1) 리스크 노드 및 리스크 영향이 큰 노드 감지
      const risk = node.riskFactor ?? 0;
      const isRiskOrigin = node.group === 'SYSTEM_RISK';
      const isRiskAffected = risk > 0.3;
      const isRiskHigh = isRiskOrigin || isRiskAffected;

      // 1) 노드 도트(Sphere) 반지름 계산
      const baseRadius = isCluster ? (24 + weight * 26) : (4 + 6 * sizeFactor);
      const dotRadius = Math.max(0.1, baseRadius * localZoom * (isActive || isHovered ? 1.15 : 1.0));

      const needsShadow = node.isHighlighted || isActive || isHovered || isRiskHigh;
      const needsGlow = isActive || isHovered || isRiskHigh;

      // 💡 Canvas 성능을 극도로 갉아먹는 무거운 가우시안 shadowBlur 연산을 완전히 우회하고,
      // 대신 semi-transparent한 벡터 원을 덧그려 글로우 효과를 100x 빠르게 모사하여 60 FPS 성능을 사수합니다.
      // 상호작용(드래그, 줌, 패닝, 회전) 중에는 이 연산마저 완전히 우회하여 CPU를 절약합니다.
      if ((needsShadow || needsGlow) && !isFastPath) {
        ctx.beginPath();
        const glowRadius = dotRadius * (isActive || isHovered ? 1.25 : 1.15); // 사용자 피드백을 반영하여 글로우 반경 대폭 축소
        ctx.arc(node.renderX, node.renderY, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = isRiskHigh 
          ? 'rgba(239, 68, 68, 0.15)' 
          : (node.isHighlighted ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.15)'); // 글로우 농도 투명하게 제한
        ctx.fill();
      }

      // ─── 리스크 경고 펄스 링 (Warning Pulse Glow Ring) 오버레이 ───
      if (isRiskHigh && !isFastPath) {
        const pulse = 1.0 + 0.4 * Math.sin(Date.now() / 250);
        ctx.beginPath();
        ctx.arc(node.renderX, node.renderY, dotRadius * (1.2 + pulse * 0.15), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.45 - pulse * 0.15})`;
        ctx.lineWidth = 1.5 * localZoom;
        ctx.stroke();
      }

      // ─── 젤리 모핑 및 Specular 실시간 연산 제거 (성능 최적화 및 렉 스파이크 제거) ───
      // 기존에 렉을 유발하던 Math.sqrt, Matrix 변형(rotate, scale) 및 createRadialGradient 실시간 계산을 완전히 소거하여 60 FPS를 사수합니다.

      if (isFastPath && !isActive && !isHovered) {
        // 성능 최적화: 드래그/공전 등의 상호작용 중이며 비활성/비호버 상태일 때는 
        // 템플릿 드로잉 오버헤드마저 아끼기 위해 단순 단색 원으로 렌더링 (save/restore 오버헤드도 완전 배제)
        ctx.beginPath();
        ctx.arc(node.renderX, node.renderY, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = themeColor;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = (isCluster ? 2.4 : 1.5) * localZoom;
        ctx.stroke();
      } else {
        // 일반 상태나 타겟/호버 노드는 고화질 캐시 템플릿을 드로잉하여 입체감 보존 (save/restore 오버헤드 방지 및 static drawImage)
        if (typeof window !== 'undefined') {
          let templateCanvas = node._cachedTemplate;
          if (!templateCanvas || node._cachedTemplateColor !== themeColor || node._cachedTemplateCluster !== isCluster) {
            templateCanvas = this.getOrCreateNodeTemplate(themeColor, false, isCluster);
            node._cachedTemplate = templateCanvas;
            node._cachedTemplateColor = themeColor;
            node._cachedTemplateCluster = isCluster;
          }
          ctx.drawImage(
            templateCanvas,
            node.renderX - dotRadius,
            node.renderY - dotRadius,
            dotRadius * 2,
            dotRadius * 2
          );
        } else {
          ctx.beginPath();
          ctx.arc(node.renderX, node.renderY, dotRadius, 0, Math.PI * 2);
          ctx.fillStyle = themeColor;
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = (isCluster ? 2.4 : 1.5) * localZoom;
          ctx.stroke();
        }
      }

      ctx.shadowColor = 'transparent';

      // 상호작용 중에도 텍스트를 그리되, measureText와 같은 헤비한 연산을 생략하여 성능을 사수하고 깜빡임을 완벽히 차단
      if (isCluster) {
        this.drawNodeTextInside(ctx, node, dotRadius, localZoom, isActive, isTreeActive || false, isFastPath);
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
        this.setFillStyle(ctx, 'rgba(255, 255, 255, 0.88)');
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(node.renderX + textOffsetX - 4 * localZoom, textY - textH / 2, textW, textH, Math.max(0.1, 4 * localZoom));
        } else {
          ctx.rect(node.renderX + textOffsetX - 4 * localZoom, textY - textH / 2, textW, textH);
        }
        ctx.fill();
 
        // Actual label text
        this.setFillStyle(ctx, (isActive || isTreeActive) ? '#0F172A' : '#475569');
        ctx.fillText(labelText, node.renderX + textOffsetX, textY);
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
    node: OrbitalNode,
    radius: number,
    localZoom: number,
    isActive: boolean,
    isTreeActive: boolean,
    isInteractive?: boolean
  ): void {
    const label = node.label || '';
    const cx = node.renderX;
    const cy = node.renderY;

    if (!node._cachedWords) {
      node._cachedWords = label.split(/\s+/);
    }
    const words = node._cachedWords;

    if (isInteractive) {
      // 상호작용(줌, 패닝, 드래그) 중일 때는 measureText를 절대 부르지 않는 최속(Fast-path) 렌더링
      const rawFontSize = Math.max(7.5 * localZoom, 10 * localZoom * (isActive ? 1.12 : 1.0));
      const fontSize = Math.max(9.5, Math.round(rawFontSize / 2) * 2);
      this.setFont(ctx, `bold ${fontSize}px 'Pretendard', sans-serif`);
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      if (!node._cachedInteractiveText) {
        const displayStr = words[0] || '';
        node._cachedInteractiveText = displayStr.length > 5 ? displayStr.slice(0, 4) + '..' : displayStr;
      }
      const finalStr = node._cachedInteractiveText;
      ctx.fillText(finalStr, cx, cy);
      return;
    }

    if (!node._cachedLines) {
      const linesList: string[] = [];
      let currentLine = words[0] || '';

      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        if (currentLine.length + word.length > 7) {
          linesList.push(currentLine);
          currentLine = word;
        } else {
          currentLine += ' ' + word;
        }
      }
      if (currentLine) {
        linesList.push(currentLine);
      }
      node._cachedLines = linesList;
    }
    const lines = node._cachedLines;

    // 2. Determine base font size based on radius
    let fontSize = Math.max(8.0 * localZoom, 11 * localZoom * (isActive ? 1.12 : 1.0));
    
    // Fit text inside circle
    const initialFontSize = Math.max(9.5, Math.round(fontSize / 2) * 2);
    const weightStyle = (isActive || isTreeActive) ? '600' : '500';
    
    let baseMaxWidth: number | undefined;
    if (weightStyle === '600') {
      baseMaxWidth = node._cachedLinesMaxWidth600;
      if (baseMaxWidth === undefined) {
        const fontStr = `600 12px 'Pretendard', sans-serif`;
        let maxW = 0;
        for (const line of lines) {
          const w = this.getTextWidth(ctx, line, fontStr);
          if (w > maxW) maxW = w;
        }
        baseMaxWidth = maxW;
        node._cachedLinesMaxWidth600 = baseMaxWidth;
      }
    } else {
      baseMaxWidth = node._cachedLinesMaxWidth500;
      if (baseMaxWidth === undefined) {
        const fontStr = `500 12px 'Pretendard', sans-serif`;
        let maxW = 0;
        for (const line of lines) {
          const w = this.getTextWidth(ctx, line, fontStr);
          if (w > maxW) maxW = w;
        }
        baseMaxWidth = maxW;
        node._cachedLinesMaxWidth500 = baseMaxWidth;
      }
    }
    
    const maxLineWidth = baseMaxWidth * (initialFontSize / 12);
    
    const maxAllowedWidth = radius * 1.55; // 안전 마진 확보
    const totalHeight = lines.length * fontSize * 1.22;
    const maxAllowedHeight = radius * 1.55;

    if (maxLineWidth > maxAllowedWidth || totalHeight > maxAllowedHeight) {
      const scaleW = maxAllowedWidth / maxLineWidth;
      const scaleH = maxAllowedHeight / totalHeight;
      const scaleFactor = Math.min(scaleW, scaleH) * 0.93;
      fontSize = Math.max(7.2 * localZoom, fontSize * scaleFactor);
    }

    const finalFontSize = Math.max(9.5, Math.round(fontSize));
    this.setFont(ctx, `bold ${finalFontSize}px 'Pretendard', sans-serif`);
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const startY = cy - ((lines.length - 1) * finalFontSize * 1.2) / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], cx, startY + i * finalFontSize * 1.2);
    }
  }

  public static clearTextBoxPool(): void {
    OntologyRenderer.textBoxPool.length = 0;
    OntologyRenderer.drawnTextBoxesList.length = 0;
    OntologyRenderer.textAllowedSet.clear();
    OntologyRenderer.cachedNeighborsSet.clear();
    OntologyRenderer.cachedDescendantsSet.clear();
    
    // Release HTMLCanvasElement template caches (GC)
    OntologyRenderer.nodeCache.forEach((canvas) => {
      canvas.width = 0;
      canvas.height = 0;
    });
    OntologyRenderer.nodeCache.clear();
    
    OntologyRenderer.baseTextWidthCache.clear();
    OntologyRenderer.fontParseCache.clear();
    OntologyRenderer.colorMap.clear();
    OntologyRenderer.colorCounter = 0;
    OntologyRenderer.edgePool.length = 0;
    OntologyRenderer.edgePoolUsed = 0;
    OntologyRenderer.flowParticlesPool.length = 0;
    OntologyRenderer.flowParticlesPoolUsed = 0;
    OntologyRenderer.flowParticlesList.length = 0;
    OntologyRenderer.labelsToDrawPool.length = 0;
    OntologyRenderer.labelsToDrawPoolUsed = 0;
    OntologyRenderer.labelsToDrawList.length = 0;
    OntologyRenderer.lastActiveNodeId = null;
    OntologyRenderer.lastActiveNodeIdForDescendants = null;
  }
}
