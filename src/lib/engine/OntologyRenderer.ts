import { OrbitalNode, OntologyEdge, EDGE_TYPE_LABELS, EdgeType, VerificationStatus } from '../ontology.types';
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
  riskNodesMap?: Map<string, { riskLevel: 'CRITICAL' | 'WARNING'; reason: string }>;
}

export interface BatchedEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  midX?: number;
  midY?: number;
  cpDist?: number;
  leftY?: number;
  rightY?: number;
  arrowX?: number;
  arrowY?: number;
  arrowAngle?: number;
  arrowSize?: number;
}

export class OntologyRenderer {
  private static ringPoints: Array<{cos: number, sin: number}> = [];
  static {
    const segments = 64;
    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2;
      OntologyRenderer.ringPoints.push({
        cos: Math.cos(theta),
        sin: Math.sin(theta)
      });
    }
  }
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

  private static spatialGrid = new Map<number, Array<{x1: number, y1: number, x2: number, y2: number}>>();
  private static cellArrayPool: Array<Array<{x1: number, y1: number, x2: number, y2: number}>> = [];
  private static cellArrayPoolUsed = 0;

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

  private static addBoxToGrid(box: {x1: number, y1: number, x2: number, y2: number}, gridCellSize: number) {
    const colStart = Math.floor(box.x1 / gridCellSize);
    const colEnd = Math.floor(box.x2 / gridCellSize);
    const rowStart = Math.floor(box.y1 / gridCellSize);
    const rowEnd = Math.floor(box.y2 / gridCellSize);

    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = colStart; c <= colEnd; c++) {
        const key = ((r + 32768) << 16) | (c + 32768);
        let arr = OntologyRenderer.spatialGrid.get(key);
        if (!arr) {
          if (OntologyRenderer.cellArrayPoolUsed < OntologyRenderer.cellArrayPool.length) {
            arr = OntologyRenderer.cellArrayPool[OntologyRenderer.cellArrayPoolUsed++];
            arr.length = 0;
          } else {
            arr = [];
            OntologyRenderer.cellArrayPool.push(arr);
            OntologyRenderer.cellArrayPoolUsed++;
          }
          OntologyRenderer.spatialGrid.set(key, arr);
        }
        arr.push(box);
      }
    }
  }

  private static checkOverlapWithGrid(rect: {x1: number, y1: number, x2: number, y2: number}, gridCellSize: number): boolean {
    const colStart = Math.floor(rect.x1 / gridCellSize);
    const colEnd = Math.floor(rect.x2 / gridCellSize);
    const rowStart = Math.floor(rect.y1 / gridCellSize);
    const rowEnd = Math.floor(rect.y2 / gridCellSize);

    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = colStart; c <= colEnd; c++) {
        const key = ((r + 32768) << 16) | (c + 32768);
        const boxes = OntologyRenderer.spatialGrid.get(key);
        if (boxes) {
          for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i];
            if (!(rect.x2 < box.x1 || rect.x1 > box.x2 || rect.y2 < box.y1 || rect.y1 > box.y2)) {
              return true;
            }
          }
        }
      }
    }
    return false;
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
    
    const isFastPath = !!(context.isInteractive || context.isOrbiting);

    if (layoutMode === 'orbit') {
      if (!isFastPath) this.renderOrbitRings(context);
    } else if (layoutMode === 'cluster') {
      // 포도송이(Cluster) 뷰: 수직 적층 플레이트 그리기를 건너뛰어 시각적 겹침 방지
    } else {
      if (!isFastPath) this.renderBackgroundLayers(context);
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

  private static cachedCorkPatternCanvas: HTMLCanvasElement | null = null;
  private static cachedCorkPattern: CanvasPattern | null = null;

  private static getCorkPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
    if (this.cachedCorkPattern) return this.cachedCorkPattern;
    if (typeof document === 'undefined') return null;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 120;
      const pCtx = canvas.getContext('2d');
      if (!pCtx) return null;

      // Base warm cork tone #c59b67
      pCtx.fillStyle = '#c59b67';
      pCtx.fillRect(0, 0, 120, 120);

      // Procedural noise & speckles
      for (let i = 0; i < 350; i++) {
        const x = Math.random() * 120;
        const y = Math.random() * 120;
        const r = 0.5 + Math.random() * 1.5;
        const alpha = 0.05 + Math.random() * 0.22;
        const isDark = Math.random() > 0.45;
        pCtx.fillStyle = isDark ? `rgba(60, 35, 15, ${alpha})` : `rgba(240, 215, 175, ${alpha})`;
        pCtx.beginPath();
        pCtx.arc(x, y, r, 0, Math.PI * 2);
        pCtx.fill();
      }

      this.cachedCorkPatternCanvas = canvas;
      this.cachedCorkPattern = ctx.createPattern(canvas, 'repeat');
      return this.cachedCorkPattern;
    } catch {
      return null;
    }
  }

  private static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private static renderBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.clearRect(0, 0, width, height);

    // 1. Modern dark slate canvas background (#090d16)
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // 2. Subtle ambient radial glow in center
    const cx = width / 2;
    const cy = height / 2;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.7);
    glow.addColorStop(0, 'rgba(30, 58, 138, 0.15)');
    glow.addColorStop(0.5, 'rgba(15, 23, 42, 0.08)');
    glow.addColorStop(1, 'rgba(9, 13, 22, 0)');

    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  private static renderBackgroundLayers(rc: RenderContext): void {
    const { ctx, canvasW, canvasH, zoom, cameraOffsetX = 0, cameraOffsetY = 0 } = rc;
    ctx.save();
    
    const cx = canvasW / 2 + cameraOffsetX;
    const cy = canvasH / 2 + cameraOffsetY;
    const cosTilt = Math.cos(OntologyLayout.tiltAngle);
    const sinTilt = Math.sin(OntologyLayout.tiltAngle);
    const cameraDist = 800;
    
    // 레이어 L0 ~ L3의 미려한 글래스모피즘 영역 블록 (Modern Layer Plates)
    const layers = [3, 2, 1, 0];
    const width = 350;
    const height = 280;
    const wE = width * ELLIPSE_RATIO;
    
    for (const layer of layers) {
      if (OntologyLayout.filterLayers && !OntologyLayout.filterLayers.has(layer)) continue;
      
      const h = layer * OntologyLayout.LAYER_GAP;
      const pCache = OntologyRenderer.cornersCache[layer];
      
      OntologyRenderer.projectTo(-wE, -height, h, cosTilt, sinTilt, cameraDist, cx, cy, zoom, pCache.p1);
      OntologyRenderer.projectTo(wE, -height, h, cosTilt, sinTilt, cameraDist, cx, cy, zoom, pCache.p2);
      OntologyRenderer.projectTo(wE, height, h, cosTilt, sinTilt, cameraDist, cx, cy, zoom, pCache.p3);
      OntologyRenderer.projectTo(-wE, height, h, cosTilt, sinTilt, cameraDist, cx, cy, zoom, pCache.p4);
      
      const minX = Math.min(pCache.p1.x, pCache.p2.x, pCache.p3.x, pCache.p4.x);
      const maxX = Math.max(pCache.p1.x, pCache.p2.x, pCache.p3.x, pCache.p4.x);
      const minY = Math.min(pCache.p1.y, pCache.p2.y, pCache.p3.y, pCache.p4.y);
      const maxY = Math.max(pCache.p1.y, pCache.p2.y, pCache.p3.y, pCache.p4.y);
      
      if (maxX < -CULL_MARGIN || minX > canvasW + CULL_MARGIN || maxY < -CULL_MARGIN || minY > canvasH + CULL_MARGIN) {
        continue;
      }
      
      // Modern Glassmorphism Section Plates with clean labels
      const dossiers = [
        { fill: 'rgba(15, 23, 42, 0.45)', stroke: 'rgba(51, 65, 85, 0.5)', label: '🌐 LAYER 0: DOMAIN HUBS & CORE NODES' },
        { fill: 'rgba(15, 23, 42, 0.45)', stroke: 'rgba(51, 65, 85, 0.5)', label: '📂 LAYER 1: BUDGET & STAGE INFRASTRUCTURE' },
        { fill: 'rgba(15, 23, 42, 0.45)', stroke: 'rgba(51, 65, 85, 0.5)', label: '📋 LAYER 2: EXECUTION & TASKS' },
        { fill: 'rgba(15, 23, 42, 0.45)', stroke: 'rgba(51, 65, 85, 0.5)', label: '📚 LAYER 3: KNOWLEDGE & CONTRACTS' }
      ];
      
      const { fill, stroke, label } = dossiers[layer];
      
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.2;
      
      ctx.beginPath();
      ctx.moveTo(pCache.p1.x, pCache.p1.y);
      ctx.lineTo(pCache.p2.x, pCache.p2.y);
      ctx.lineTo(pCache.p3.x, pCache.p3.y);
      ctx.lineTo(pCache.p4.x, pCache.p4.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Section Plate Label
      ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
      ctx.font = "bold 10px 'Pretendard', sans-serif";
      ctx.fillText(label, pCache.p1.x + 12, pCache.p1.y + 18);
    }
    
    ctx.restore();
  }

  private static renderOrbitRings(rc: RenderContext): void {
    const { ctx, canvasW, canvasH, zoom, cameraOffsetX = 0, cameraOffsetY = 0 } = rc;
    
    ctx.save();
    
    const cx = canvasW / 2 + cameraOffsetX;
    const cy = canvasH / 2 + cameraOffsetY;
    const cosTilt = OntologyLayout.cosTilt;
    const sinTilt = OntologyLayout.sinTilt;
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
        
        // Bounding circle culling check:
        const depthCenter = h * cosTilt;
        const pScaleCenter = Math.max(0.05, cameraDist / Math.max(120, cameraDist + depthCenter));
        const centerY = cy - h * sinTilt * zoom * pScaleCenter;
        
        const radiusProjected = R * ELLIPSE_RATIO * zoom * pScaleCenter;
        if (radiusProjected < 2.0) {
          continue; // Too small, cull!
        }
        
        if (
          cx + radiusProjected < -CULL_MARGIN ||
          cx - radiusProjected > canvasW + CULL_MARGIN ||
          centerY + radiusProjected < -CULL_MARGIN ||
          centerY - radiusProjected > canvasH + CULL_MARGIN
        ) {
          continue; // Entirely offscreen, cull!
        }
        
        ctx.beginPath();
        let isFirst = true;
        for (const p of OntologyRenderer.ringPoints) {
          const wx = R * p.cos * ELLIPSE_RATIO;
          const wy = R * p.sin;
          
          const rotatedY = wy * cosTilt - h * sinTilt;
          const depth = -wy * sinTilt + h * cosTilt;
          const pScale = Math.max(0.05, cameraDist / Math.max(120, cameraDist + depth));
          
          const rx = cx + wx * zoom * pScale;
          const ry = cy + rotatedY * zoom * pScale;
          
          if (isFirst) {
            ctx.moveTo(rx, ry);
            isFirst = false;
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
      // 상호작용(드래그, 줌, 회전 등) 중일 때는 모든 교차 간선 드로잉을 스킵하여 극도로 쾌적한 드래깅 확보
      if (isCrossEdge && isFastPath) {
         continue;
      }

      // Frustum cull
      if (src.renderX < -CULL_MARGIN && tgt.renderX < -CULL_MARGIN) continue;
      if (src.renderX > canvasW + CULL_MARGIN && tgt.renderX > canvasW + CULL_MARGIN) continue;
      if (src.renderY < -CULL_MARGIN && tgt.renderY < -CULL_MARGIN) continue;
      if (src.renderY > canvasH + CULL_MARGIN && tgt.renderY > canvasH + CULL_MARGIN) continue;

      // Crimson Red Strings attached to Push Pin heads at top center of Post-it cards
      const leftZoom = leftNode._localZoom || (rc.zoom * (leftNode.perspectiveScale ?? 1.0) * (0.8 + 0.5 * (leftNode.renderSize ?? 0.5)));
      const rightZoom = rightNode._localZoom || (rc.zoom * (rightNode.perspectiveScale ?? 1.0) * (0.8 + 0.5 * (rightNode.renderSize ?? 0.5)));
      const avgScale = (leftZoom + rightZoom) / 2;

      // Push Pin Head Attachment Coordinates: (x, y - cardH/2 + 2)
      // Modern MindMap Connecting Line Coordinates (Node Centers)
      const p1x = leftNode.renderX;
      const p1y = leftNode.renderY;
      const p2x = rightNode.renderX;
      const p2y = rightNode.renderY;

      const midX = (p1x + p2x) / 2;
      const midY = (p1y + p2y) / 2;
      const sagAmount = 0;
      
      // Modern MindMap Connecting Lines Color Palette
      let themeColor = '#3b82f6'; // Clean Blue
      const nodeLayer = leftNode.effectiveLayer ?? (leftNode.layerId ?? 0);
      if (isDirectlyConnectedToActive) {
        themeColor = '#38bdf8'; // Sky Blue
      } else if (nodeLayer === 1) {
        themeColor = '#10b981'; // Emerald
      } else if (nodeLayer === 2) {
        themeColor = '#f59e0b'; // Amber
      } else if (nodeLayer === 3) {
        themeColor = '#8b5cf6'; // Purple
      } else if (src.group === 'SYSTEM_RISK' || tgt.group === 'SYSTEM_RISK' || (src.riskFactor && src.riskFactor > 0.3)) {
        themeColor = '#ef4444'; // Red
      }

      let alpha = 0.75;
      let lineWidth = 2.2 * rc.zoom * (avgScale / rc.zoom);

      const isConnectedToTree = activeNodeId && activeTreeSet.has(src.id) && activeTreeSet.has(tgt.id);

      if (isDirectlyConnectedToActive) {
        alpha = 0.95;
        lineWidth = 2.8 * rc.zoom;
      } else if (isConnectedToTree) {
        alpha = 0.85;
        lineWidth = 2.4 * rc.zoom;
      } else if (activeNodeId) {
        alpha = 0.35;
        lineWidth = 1.6 * rc.zoom;
      } else if (isCrossEdge) {
        alpha = 0.5;
        lineWidth = 1.8 * rc.zoom;
      }
      
      const finalAlpha = Math.min(1.0, alpha);
      const isDashed = edge.weight < 0;

      const roundedLineWidth = Number((Math.round(lineWidth * 5) / 5).toFixed(2));
      const roundedAlpha = Number((Math.round(finalAlpha * 10) / 10).toFixed(2));

      let colorId: number;
      if (themeColor === tgt.themeColor && tgt._themeColorId !== undefined) {
        colorId = tgt._themeColorId;
      } else {
        colorId = OntologyRenderer.getColorId(themeColor);
      }
      const lwInt = Math.round(roundedLineWidth * 5) & 0xFF;
      const aInt = Math.round(roundedAlpha * 10) & 0xFF;
      const dashInt = isDashed ? 1 : 0;
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

      let batchedEdge: BatchedEdge;
      if (OntologyRenderer.edgePoolUsed < OntologyRenderer.edgePool.length) {
        batchedEdge = OntologyRenderer.edgePool[OntologyRenderer.edgePoolUsed++];
      } else {
        batchedEdge = { x1: 0, y1: 0, x2: 0, y2: 0 };
        OntologyRenderer.edgePool.push(batchedEdge);
        OntologyRenderer.edgePoolUsed++;
      }
      batchedEdge.x1 = p1x;
      batchedEdge.y1 = p1y;
      batchedEdge.x2 = p2x;
      batchedEdge.y2 = p2y;
      batchedEdge.midX = midX;
      batchedEdge.midY = midY;
      batchedEdge.cpDist = sagAmount;
      batchedEdge.leftY = p1y;
      batchedEdge.rightY = p2y;
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
          
          const srcR = (src.nodeRadius || 35) * rc.zoom * (src.perspectiveScale ?? 1.0);
          const tgtR = (tgt.nodeRadius || 35) * rc.zoom * (tgt.perspectiveScale ?? 1.0);
          
          batchedEdge.x1 = src.renderX + ux * srcR;
          batchedEdge.y1 = src.renderY + uy * srcR;
          batchedEdge.x2 = tgt.renderX - ux * tgtR;
          batchedEdge.y2 = tgt.renderY - uy * tgtR;
          
          batchedEdge.arrowX = batchedEdge.x2;
          batchedEdge.arrowY = batchedEdge.y2;
          batchedEdge.arrowAngle = Math.atan2(dy, dx);
          batchedEdge.arrowSize = 6.5 * rc.zoom;
        }
      }

      batch.edgesList.push(batchedEdge);

      const isDirectlyConnectedToHover = rc.hoveredNodeId && (rc.hoveredNodeId === src.id || rc.hoveredNodeId === tgt.id);

      const shouldDrawLabel = (isDirectlyConnectedToActive || isDirectlyConnectedToHover) && 
                              !isCrossEdge && 
                              edge.type !== 'DEPENDENCY';

      if (shouldDrawLabel) {
        if (midX >= -CULL_MARGIN && midX <= canvasW + CULL_MARGIN &&
            midY >= -CULL_MARGIN && midY <= canvasH + CULL_MARGIN) {
          let labelItem;
          if (OntologyRenderer.labelsToDrawPoolUsed < OntologyRenderer.labelsToDrawPool.length) {
            labelItem = OntologyRenderer.labelsToDrawPool[OntologyRenderer.labelsToDrawPoolUsed++];
          } else {
            labelItem = {
              edge,
              leftRightX: p1x,
              rightLeftX: p2x,
              leftNode,
              rightNode,
              cpDist: sagAmount,
              avgScale,
              themeColor,
              alpha
            };
            OntologyRenderer.labelsToDrawPool.push(labelItem);
            OntologyRenderer.labelsToDrawPoolUsed++;
          }
          labelItem.edge = edge;
          labelItem.leftRightX = p1x;
          labelItem.rightLeftX = p2x;
          labelItem.leftNode = leftNode;
          labelItem.rightNode = rightNode;
          labelItem.cpDist = sagAmount;
          labelItem.avgScale = avgScale;
          labelItem.themeColor = themeColor;
          labelItem.alpha = alpha;

          OntologyRenderer.labelsToDrawList.push(labelItem);
        }
      }
    }

    // Crimson Red String Batch Drawing Pass
    for (const [, batch] of OntologyRenderer.edgeBatches) {
      if (batch.edgesList.length === 0) continue;

      // 1. Thread Shadow Pass
      ctx.globalAlpha = batch.alpha * 0.4;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = Math.max(1.0, batch.lineWidth * 0.75);
      if (batch.isDashed) ctx.setLineDash([6, 4]);
      else ctx.setLineDash([]);

      ctx.beginPath();
      for (const e of batch.edgesList) {
        ctx.moveTo(e.x1 + 1.5, e.y1 + 2.5);
        if (e.midX !== undefined && e.midY !== undefined) {
          ctx.quadraticCurveTo(e.midX + 1.5, e.midY + 2.5, e.x2 + 1.5, e.y2 + 2.5);
        } else {
          ctx.lineTo(e.x2 + 1.5, e.y2 + 2.5);
        }
      }
      ctx.stroke();

      // 2. Crimson Red String Main Pass
      ctx.globalAlpha = batch.alpha;
      ctx.strokeStyle = batch.themeColor;
      ctx.lineWidth = Math.max(1.6, batch.lineWidth);

      ctx.beginPath();
      for (const e of batch.edgesList) {
        ctx.moveTo(e.x1, e.y1);
        if (e.midX !== undefined && e.midY !== undefined) {
          ctx.quadraticCurveTo(e.midX, e.midY, e.x2, e.y2);
        } else {
          ctx.lineTo(e.x2, e.y2);
        }
      }
      ctx.stroke();
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
      centerNode._themeColorId = this.getColorId(centerNode.themeColor);

      const children = OntologyLayout.lastTreeChildrenMap.get(centerNode.id) || [];
      let paletteIdx = 0;
      
      for (const childId of children) {
          const childNode = nodeMap.get(childId);
          if (childNode) {
              childNode.themeColor = this.THEME_PALETTES[paletteIdx % this.THEME_PALETTES.length];
              childNode._themeColorId = this.getColorId(childNode.themeColor);
              paletteIdx++;
              this.cascadeTheme(childNode.id, childNode.themeColor, nodeMap);
          }
      }
  }

  private static cascadeTheme(parentId: string, color: string, nodeMap: Map<string, OrbitalNode>) {
      const children = OntologyLayout.lastTreeChildrenMap.get(parentId) || [];
      const colorId = this.getColorId(color);
      for (const childId of children) {
          const childNode = nodeMap.get(childId);
          if (childNode) {
              childNode.themeColor = color;
              childNode._themeColorId = colorId;
              this.cascadeTheme(childId, color, nodeMap);
          }
      }
  }

  // Legacy getColorPalette removed -> We use Flat Design and themeColor inheritance

  private static renderNodes(rc: RenderContext): void {
    const { ctx, sortedNodesBuffer, activeNodeId, hoveredNodeId, canvasW, canvasH, zoom } = rc;
    const isFastPath = !!(rc.isInteractive || rc.isOrbiting);

    for (const node of sortedNodesBuffer) {
      if (node.layoutHidden) continue;
      if (node.renderX < -CULL_MARGIN || node.renderX > canvasW + CULL_MARGIN) continue;
      if (node.renderY < -CULL_MARGIN || node.renderY > canvasH + CULL_MARGIN) continue;

      const isActive = node.id === activeNodeId;
      const isHovered = node.id === hoveredNodeId;

      const nodeScale = node.perspectiveScale ?? 1.0;
      const weight = node.renderSize ?? 0.5;
      const sizeFactor = 0.8 + 0.5 * weight;
      const localZoom = Math.max(0.2, zoom * nodeScale * sizeFactor);
      node._localZoom = localZoom;

      const cardW = 115 * localZoom;
      const cardH = 75 * localZoom;
      node.nodeRadius = Math.max(cardW, cardH) / (2 * Math.max(0.1, zoom));

      // Modern MindMap Node Card Styling
      const layer = node.effectiveLayer ?? (node.layerId ?? 0);
      let cardBgColor = '#1e293b'; // Slate-800
      let accentColor = '#3b82f6'; // Blue for L0

      if (layer === 1 || node.group === 'MACRO_RESEARCH') {
        accentColor = '#10b981'; // Emerald for L1
      } else if (layer === 2 || node.group === 'DCF_MODELING' || node.group === 'DATA_PIPELINE') {
        accentColor = '#f59e0b'; // Amber for L2
      } else if (layer === 3 || node.group === 'INFRASTRUCTURE' || node.group === 'OTHER') {
        accentColor = '#8b5cf6'; // Purple for L3
      }

      if (node.customColor) {
        accentColor = node.customColor;
      }

      // Straight 0° alignment (no tilt)
      const tiltAngle = 0;

      ctx.save();
      ctx.translate(node.renderX, node.renderY);
      ctx.rotate(tiltAngle);

      // 1. Subtle Node Drop Shadow
      if (!isFastPath) {
        ctx.shadowColor = (isActive || isHovered) ? 'rgba(56, 189, 248, 0.45)' : 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = (isActive || isHovered ? 12 : 6) * localZoom;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 3 * localZoom;
      }

      // 2. Node Rect Body
      const halfW = cardW / 2;
      const halfH = cardH / 2;
      const cornerR = Math.max(4, 6 * localZoom);

      // Crimson Pulsating Aura Glow Ring (#FF0044) for risk nodes
      const isRiskNode = (rc.riskNodesMap && rc.riskNodesMap.has(node.id)) || (node as any).verificationStatus === 'risk-warning';
      if (isRiskNode) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.005);
        ctx.save();
        ctx.shadowColor = '#FF0044';
        ctx.shadowBlur = (18 + 12 * pulse) * localZoom;
        ctx.strokeStyle = `rgba(255, 0, 68, ${0.75 + 0.25 * pulse})`;
        ctx.lineWidth = (3.5 + 1.5 * pulse) * localZoom;

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(-halfW - 4 * localZoom, -halfH - 4 * localZoom, cardW + 8 * localZoom, cardH + 8 * localZoom, cornerR + 2 * localZoom);
        } else {
          ctx.rect(-halfW - 4 * localZoom, -halfH - 4 * localZoom, cardW + 8 * localZoom, cardH + 8 * localZoom);
        }
        ctx.stroke();
        ctx.restore();
      }

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(-halfW, -halfH, cardW, cardH, cornerR);
      } else {
        ctx.rect(-halfW, -halfH, cardW, cardH);
      }

      ctx.fillStyle = cardBgColor;
      ctx.fill();

      // Reset shadow for crisp inner details
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // 3. Modern Card Border
      ctx.strokeStyle = (isActive || isHovered) ? '#38bdf8' : 'rgba(71, 85, 105, 0.6)';
      ctx.lineWidth = (isActive || isHovered ? 2.0 : 1.0) * localZoom;
      ctx.stroke();

      // 4. Left Accent Indicator Bar
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(-halfW, -halfH, 4 * localZoom, cardH, [cornerR, 0, 0, cornerR]);
      } else {
        ctx.rect(-halfW, -halfH, 4 * localZoom, cardH);
      }
      ctx.fill();

      // 5. Verification Status Pill Badges at Top Right Corner
      const vStatus: VerificationStatus = (node as any).verificationStatus || 'uncompleted';

      if (vStatus === 'verified') {
        const badgeX = halfW - 8 * localZoom;
        const badgeY = -halfH + 8 * localZoom;
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, 5.5 * localZoom, 0, Math.PI * 2);
        ctx.fillStyle = '#16a34a';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(5, 6 * localZoom)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✓', badgeX, badgeY);
      } else if (vStatus === 'in-progress') {
        const badgeX = halfW - 8 * localZoom;
        const badgeY = -halfH + 8 * localZoom;
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, 5.5 * localZoom, 0, Math.PI * 2);
        ctx.fillStyle = '#2563eb';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(5, 6 * localZoom)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔍', badgeX, badgeY);
      } else if (vStatus === 'risk-warning') {
        const badgeX = halfW - 8 * localZoom;
        const badgeY = -halfH + 8 * localZoom;
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, 6 * localZoom, 0, Math.PI * 2);
        ctx.fillStyle = '#dc2626';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(5.5, 6.5 * localZoom)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', badgeX, badgeY);
      }

      // 6. Node Label Text inside Card
      let labelText = node.label || '';
      if (labelText.length > 14) {
        labelText = labelText.substring(0, 13) + '...';
      }

      const fontSize = Math.max(8.5, 10.5 * localZoom);
      ctx.font = `bold ${fontSize}px 'Pretendard', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f8fafc'; // Crisp White
      ctx.fillText(labelText, 2 * localZoom, 0);

      ctx.restore();
    }
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
      const rawFontSize = Math.max(6.5 * localZoom, 8.5 * localZoom * (isActive ? 1.08 : 1.0));
      const fontSize = Math.max(8.0, Math.round(rawFontSize / 2) * 2);
      this.setFont(ctx, `500 ${fontSize}px 'Pretendard', sans-serif`);
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
    let fontSize = Math.max(6.5 * localZoom, 9.0 * localZoom * (isActive ? 1.08 : 1.0));
    
    // Fit text inside circle
    const initialFontSize = Math.max(8.0, Math.round(fontSize / 2) * 2);
    const weightStyle = (isActive || isTreeActive) ? '500' : '400';
    
    let baseMaxWidth: number | undefined;
    if (weightStyle === '500') {
      baseMaxWidth = node._cachedLinesMaxWidth600;
      if (baseMaxWidth === undefined) {
        const fontStr = `500 10px 'Pretendard', sans-serif`;
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
        const fontStr = `400 10px 'Pretendard', sans-serif`;
        let maxW = 0;
        for (const line of lines) {
          const w = this.getTextWidth(ctx, line, fontStr);
          if (w > maxW) maxW = w;
        }
        baseMaxWidth = maxW;
        node._cachedLinesMaxWidth500 = baseMaxWidth;
      }
    }
    
    const maxLineWidth = baseMaxWidth * (initialFontSize / 10);
    
    const maxAllowedWidth = radius * 1.55; // 안전 마진 확보
    const totalHeight = lines.length * fontSize * 1.22;
    const maxAllowedHeight = radius * 1.55;

    if (maxLineWidth > maxAllowedWidth || totalHeight > maxAllowedHeight) {
      const scaleW = maxAllowedWidth / maxLineWidth;
      const scaleH = maxAllowedHeight / totalHeight;
      const scaleFactor = Math.min(scaleW, scaleH) * 0.93;
      fontSize = Math.max(6.5 * localZoom, fontSize * scaleFactor);
    }

    const finalFontSize = Math.max(8.0, Math.round(fontSize));
    this.setFont(ctx, `${weightStyle} ${finalFontSize}px 'Pretendard', sans-serif`);
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const startY = cy - ((lines.length - 1) * finalFontSize * 1.2) / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], cx, startY + i * finalFontSize * 1.2);
    }
  }

  public static clearTextBoxPool(): void {
    OntologyRenderer.spatialGrid.clear();
    OntologyRenderer.cellArrayPool.length = 0;
    OntologyRenderer.cellArrayPoolUsed = 0;
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
