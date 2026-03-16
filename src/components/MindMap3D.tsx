'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { OntologyCanvasEngine } from '@/lib/OntologyCanvasEngine';
import { fetchOntologyFromSheets, getSampleGraph } from '@/lib/ontology.fetch';
import {
  OrbitalNode, OntologyEdge,
  GROUP_COLORS, GROUP_LABELS, OntologyGroup,
  EDGE_TYPE_LABELS, EdgeType,
} from '@/lib/ontology.types';
import {
  Brain, Loader2, RefreshCw, AlertTriangle,
  Circle, Link2, X, ChevronRight, Zap, Maximize2, Minimize2,
} from 'lucide-react';

// ============ Component ============

export function MindMap3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<OntologyCanvasEngine | null>(null);
  const animationRef = useRef<number>(0);
  const dprRef = useRef(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingSample, setUsingSample] = useState(false);
  const [activeNode, setActiveNode] = useState<OrbitalNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<OrbitalNode | null>(null);
  const [connectedEdges, setConnectedEdges] = useState<Array<{ edge: OntologyEdge; otherNode: OrbitalNode }>>([]);
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Init Engine ──
  const initEngine = useCallback(async (useSample = false) => {
    setLoading(true);
    setError(null);

    try {
      let graph;
      if (useSample) {
        graph = getSampleGraph();
        setUsingSample(true);
      } else {
        try {
          graph = await fetchOntologyFromSheets();
          setUsingSample(false);
        } catch {
          graph = getSampleGraph();
          setUsingSample(true);
        }
      }

      const engine = new OntologyCanvasEngine();
      engine.init(graph, {
        onActiveNodeChange: (node) => {
          setActiveNode(node ?? null);
          if (node && engine) {
            setConnectedEdges(engine.getConnectedEdges(node.id));
          } else {
            setConnectedEdges([]);
          }
        },
        onHoveredNodeChange: (node) => setHoveredNode(node ?? null),
      });

      engineRef.current = engine;
      setStats({ nodes: engine.nodeCount, edges: engine.edgeCount });

      // Set initial active
      if (engine.centerNode) {
        setActiveNode(engine.centerNode);
        setConnectedEdges(engine.getConnectedEdges(engine.centerNode.id));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '초기화 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Animation Loop ──
  useEffect(() => {
    initEngine();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [initEngine]);

  useEffect(() => {
    if (loading || error) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize handler
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Animation
    const loop = () => {
      const engine = engineRef.current;
      if (!engine || !ctx) return;

      const dpr = dprRef.current;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);

      engine.tick();
      engine.render(ctx, w, h);

      ctx.restore();
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    // Native wheel handler (non-passive to allow preventDefault)
    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const engine = engineRef.current;
      if (engine) engine.handleWheel(e.deltaY);
    };
    canvas.addEventListener('wheel', wheelHandler, { passive: false });

    return () => {
      ro.disconnect();
      canvas.removeEventListener('wheel', wheelHandler);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [loading, error]);

  // ── Mouse/Touch Events ──
  const getCanvasPos = useCallback((e: React.MouseEvent | MouseEvent | TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : (e as MouseEvent).clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const engine = engineRef.current;
    if (!engine) return;
    const { x, y } = getCanvasPos(e.nativeEvent);
    engine.handleHover(x, y);

    // Drag
    if (e.buttons === 1) {
      engine.handleDragMove(y);
    }
  }, [getCanvasPos]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const engine = engineRef.current;
    if (!engine) return;
    const { y } = getCanvasPos(e.nativeEvent);
    engine.handleDragStart(y);
  }, [getCanvasPos]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.handleDragEnd();
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const engine = engineRef.current;
    if (!engine) return;
    const { x, y } = getCanvasPos(e.nativeEvent);
    engine.handleClick(x, y);
  }, [getCanvasPos]);

  // handleWheel is now native (see useEffect above)

  const handleNodeClickInPanel = useCallback((nodeId: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    const node = engine.getNodeById(nodeId);
    if (node) {
      engine.activeNode = node;
      // Camera follow
      engine.handleClick(node.renderX, node.renderY);
    }
  }, []);

  // ── Loading / Error States ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] gap-4">
        <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
        <p className="text-sm text-[var(--color-text-secondary)]">온톨로지 데이터 로딩 중...</p>
      </div>
    );
  }

  if (error && !engineRef.current) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] gap-4">
        <AlertTriangle size={32} className="text-[var(--color-danger)]" />
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
        <button
          onClick={() => initEngine(true)}
          className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm hover:opacity-90 cursor-pointer"
        >
          샘플 데이터로 시작
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Brain size={22} className="text-[var(--color-primary)]" />
          온톨로지 그래프
        </h2>
        <div className="flex items-center gap-2">
          {usingSample && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">
              샘플 데이터
            </span>
          )}
          <button
            onClick={() => initEngine(false)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:bg-gray-100 cursor-pointer transition-colors"
          >
            <RefreshCw size={12} /> 새로고침
          </button>
        </div>
      </div>

      {/* Main: Side Panel (left) + Canvas (right) */}
      <div className={isFullscreen ? '' : 'grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4'}>

        {/* ── Side Panel (left on desktop, below canvas on mobile) ── */}
        {!isFullscreen && (
          <div className="space-y-3 order-2 lg:order-none">
            {/* Node Detail */}
            <div className="bg-white rounded-xl border border-[var(--color-border-light)] shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--color-border-light)] bg-gray-50/50">
                <h3 className="text-xs font-semibold text-[var(--color-text-secondary)]">노드 상세</h3>
              </div>
              <div className="p-4">
                {activeNode ? (
                  <div>
                    {/* Header */}
                    <div className="flex items-start gap-2 mb-3">
                      <span
                        className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center mt-0.5"
                        style={{ backgroundColor: GROUP_COLORS[activeNode.group as OntologyGroup] }}
                      >
                        {activeNode.orbitIndex === 0
                          ? <Zap size={10} className="text-white" />
                          : <Circle size={8} className="text-white" fill="white" />
                        }
                      </span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm leading-tight">{activeNode.label}</h4>
                        <span className="text-[10px] text-[var(--color-text-tertiary)]">
                          {GROUP_LABELS[activeNode.group as OntologyGroup]}
                        </span>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600">
                        중요도 {activeNode.baseValue}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-600">
                        중심성 {((activeNode.centralityScore ?? 0) * 100).toFixed(0)}%
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-600">
                        연결 {connectedEdges.length}개
                      </span>
                      {activeNode.isHedge && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-600">
                          🚧 병목 노드
                        </span>
                      )}
                    </div>

                    {/* Metrics bar */}
                    <div className="flex gap-2 mb-4">
                      <div className="flex-1 bg-gray-50 rounded-lg px-2.5 py-1.5 text-center">
                        <div className="text-[10px] text-[var(--color-text-tertiary)]">순가중치</div>
                        <div className={`text-xs font-bold ${(activeNode.netWeight ?? 0) < 0 ? 'text-red-500' : 'text-blue-500'}`}>
                          {(activeNode.netWeight ?? 0) >= 0 ? '+' : ''}{(activeNode.netWeight ?? 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-lg px-2.5 py-1.5 text-center">
                        <div className="text-[10px] text-[var(--color-text-tertiary)]">궤도</div>
                        <div className="text-xs font-bold text-[var(--color-text-primary)]">
                          {activeNode.orbitIndex === 0 ? '중심' : `${activeNode.orbitIndex}궤도`}
                        </div>
                      </div>
                    </div>

                    {/* Connected edges */}
                    {connectedEdges.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-[var(--color-text-tertiary)] mb-2">
                          <Link2 size={10} />
                          연결된 항목 ({connectedEdges.length}개)
                        </div>
                        <div className="space-y-1 max-h-[280px] overflow-y-auto custom-scrollbar">
                          {connectedEdges.map(({ edge, otherNode }) => (
                            <button
                              key={otherNode.id}
                              onClick={() => handleNodeClickInPanel(otherNode.id)}
                              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors text-left"
                            >
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: GROUP_COLORS[otherNode.group as OntologyGroup] }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-medium text-[var(--color-text-primary)] truncate">
                                  {otherNode.label}
                                </div>
                                <div className="text-[9px] text-[var(--color-text-tertiary)]">
                                  {EDGE_TYPE_LABELS[edge.type as EdgeType] || edge.type}
                                </div>
                              </div>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                                edge.weight < 0
                                  ? 'bg-red-50 text-red-500'
                                  : edge.weight >= 0.7
                                    ? 'bg-blue-50 text-blue-600'
                                    : 'bg-gray-100 text-[var(--color-text-secondary)]'
                              }`}>
                                {edge.weight > 0 ? '+' : ''}{edge.weight.toFixed(2)}
                              </span>
                              <ChevronRight size={10} className="text-[var(--color-text-tertiary)] shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Brain size={28} className="mx-auto mb-3 text-[var(--color-text-tertiary)] opacity-30" />
                    <div className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">
                      노드를 선택해보세요<br />
                      그래프의 점을 클릭하면<br />
                      연결된 관계를 확인할 수 있어요
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Domain Stats */}
            <div className="bg-white rounded-xl border border-[var(--color-border-light)] shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[var(--color-border-light)] bg-gray-50/50">
                <h3 className="text-xs font-semibold text-[var(--color-text-secondary)]">도메인 분포</h3>
              </div>
              <div className="p-3">
                <DomainStats nodes={engineRef.current?.nodes ?? []} />
              </div>
            </div>
          </div>
        )}

        {/* ── Canvas Container ── */}
        <div
          ref={containerRef}
          className="relative rounded-xl overflow-hidden border border-[var(--color-border-light)] order-1 lg:order-none"
          style={{ height: isFullscreen ? '85vh' : '600px', backgroundColor: '#f8f9fc' }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ cursor: hoveredNode ? 'pointer' : 'grab' }}
            onClick={handleClick}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />

          {/* Stats overlay (top-right) */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="bg-white/90 backdrop-blur rounded-lg p-1.5 shadow-sm border border-[var(--color-border-light)] hover:bg-gray-100 transition-colors cursor-pointer"
              title={isFullscreen ? '패널 보기' : '전체화면'}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <div className="bg-white/90 backdrop-blur rounded-lg px-3 py-1.5 shadow-sm border border-[var(--color-border-light)] inline-flex gap-4">
              <div>
                <div className="text-[10px] text-[var(--color-text-tertiary)]">노드</div>
                <div className="text-sm font-bold text-[var(--color-primary)]">{stats.nodes}개</div>
              </div>
              <div>
                <div className="text-[10px] text-[var(--color-text-tertiary)]">연결</div>
                <div className="text-sm font-bold text-[var(--color-success)]">{stats.edges}개</div>
              </div>
            </div>
          </div>

          {/* Domain legend (top-left) */}
          <div className="absolute top-3 left-3 z-10">
            <div className="bg-white/90 backdrop-blur rounded-lg px-3 py-2 shadow-sm border border-[var(--color-border-light)]">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {(Object.entries(GROUP_LABELS) as [OntologyGroup, string][])
                  .filter(([k]) => k !== 'OTHER')
                  .map(([group, label]) => (
                    <span key={group} className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-secondary)]">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: GROUP_COLORS[group] }} />
                      {label}
                    </span>
                  ))
                }
              </div>
            </div>
          </div>

          {/* Hover tooltip */}
          {hoveredNode && hoveredNode.id !== activeNode?.id && (
            <div
              className="absolute z-20 pointer-events-none bg-white/95 backdrop-blur rounded-lg px-3 py-2 shadow-md border border-[var(--color-border-light)]"
              style={{
                left: Math.min(
                  (containerRef.current?.getBoundingClientRect().width ?? 400) - 180,
                  hoveredNode.renderX + 20
                ),
                top: hoveredNode.renderY - 10,
              }}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GROUP_COLORS[hoveredNode.group as OntologyGroup] }} />
                <span className="text-xs font-semibold">{hoveredNode.label}</span>
              </div>
              <div className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                {GROUP_LABELS[hoveredNode.group as OntologyGroup]} · 중요도 {hoveredNode.baseValue}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="absolute bottom-3 left-3 z-10 bg-white/80 backdrop-blur rounded-lg px-3 py-1.5 text-[10px] text-[var(--color-text-tertiary)]">
            🖱️ 클릭: 노드 선택 · 드래그: 틸트 · 스크롤: 줌
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Domain Stats Sub-Component ============

function DomainStats({ nodes }: { nodes: OrbitalNode[] }) {
  const domainCounts = new Map<OntologyGroup, number>();

  for (const node of nodes) {
    const group = node.group as OntologyGroup;
    domainCounts.set(group, (domainCounts.get(group) || 0) + 1);
  }

  const total = nodes.length || 1;
  const sorted = [...domainCounts.entries()]
    .filter(([k]) => k !== 'OTHER')
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-2">
      {sorted.map(([group, count]) => {
        const pct = Math.round((count / total) * 100);
        return (
          <div key={group} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: GROUP_COLORS[group] }} />
            <span className="flex-1 text-[10px] text-[var(--color-text-secondary)] truncate">
              {GROUP_LABELS[group]}
            </span>
            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: GROUP_COLORS[group] }}
              />
            </div>
            <span className="text-[10px] font-medium text-[var(--color-text-tertiary)] w-5 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}
