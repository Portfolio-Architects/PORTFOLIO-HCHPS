'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { OntologyCanvasEngine } from '@/lib/OntologyCanvasEngine';
import { buildSignalGraph } from '@/lib/signal-graph';
import { SignalEntry } from '@/hooks/useSignal';
import {
  OrbitalNode, OntologyEdge,
  GROUP_COLORS, GROUP_LABELS, OntologyGroup,
  EDGE_TYPE_LABELS, EdgeType,
} from '@/lib/ontology.types';
import {
  Radio, Loader2, RefreshCw, AlertTriangle,
  Circle, Link2, X, ChevronRight, ChevronUp, ChevronDown, Zap, Maximize2, Minimize2,
  Trash2, FileText, Edit2, Plus, Palette, PinOff, PlusSquare, Waypoints, Eraser, Play, Pause,
  CheckCircle
} from 'lucide-react';
import { useGraphCustomization } from '@/hooks/useGraphCustomization';

// ============ Props ============

interface MindMap3DProps {
  signalKeywords: Record<string, number>;
  signalEntries: SignalEntry[];
  onAddSignal: (text: string) => void;
  onDeleteSignal?: (id: string) => void;
  onUpdateKeywords?: (id: string, keywords: string[]) => void;
  onRenameCategory?: (oldName: string, newName: string) => void;
  onDeleteCategory?: (name: string) => void;
}

// ============ Component ============

export function MindMap3D({ signalKeywords, signalEntries, onAddSignal, onDeleteSignal, onUpdateKeywords, onRenameCategory, onDeleteCategory }: MindMap3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<OntologyCanvasEngine | null>(null);
  const animationRef = useRef<number>(0);
  const dprRef = useRef(1);

  // Use refs for props to avoid re-creating initEngine on every data change
  const signalKeywordsRef = useRef(signalKeywords);
  const signalEntriesRef = useRef(signalEntries);
  signalKeywordsRef.current = signalKeywords;
  signalEntriesRef.current = signalEntries;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingSample, setUsingSample] = useState(false);
  const [activeNode, setActiveNode] = useState<OrbitalNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<OrbitalNode | null>(null);
  const [connectedEdges, setConnectedEdges] = useState<Array<{ edge: OntologyEdge; otherNode: OrbitalNode }>>([]);
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });
  const { overrides, customNodes, customEdges, undo, redo, setNodeOverride, clearNodeOverride, addCustomNode, deleteCustomNode, updateCustomNodeText, addCustomEdge, clearOverrides, clearAll } = useGraphCustomization();
  
  // ── Keyboard Shortcuts (Undo/Redo) ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent running if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);
  
  const overridesRef = useRef(overrides);
  const customNodesRef = useRef(customNodes);
  const customEdgesRef = useRef(customEdges);
  overridesRef.current = overrides;
  customNodesRef.current = customNodes;
  customEdgesRef.current = customEdges;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState('');
  const [edgeModeSource, setEdgeModeSource] = useState<string | null>(null);
  const [show5W1H, setShow5W1H] = useState(false);
  const show5W1HRef = useRef(false);
  useEffect(() => { show5W1HRef.current = show5W1H; }, [show5W1H]);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const edgeModeSourceRef = useRef(edgeModeSource);
  useEffect(() => { edgeModeSourceRef.current = edgeModeSource; }, [edgeModeSource]);

  // 직관적이고 구분이 또렷한 원색(Vivid/Primary) 컬러 팔레트 배정
  const PRESET_COLORS = ['#FF2222', '#FF8800', '#FFDD00', '#00CC44', '#00BBDD', '#0055FF', '#8800FF', '#FF00AA', '#111111', '#FFFFFF'];

  // ── Init Engine (stable — deferred callbacks) ──
  const initEngine = useCallback(() => {
    setLoading(true);
    setError(null);

    try {
      const graph = buildSignalGraph(signalKeywordsRef.current, signalEntriesRef.current, {
        overrides: overridesRef.current,
        customNodes: customNodesRef.current,
        customEdges: customEdgesRef.current,
      });
      setUsingSample(Object.keys(signalKeywordsRef.current).length === 0);

      const engine = new OntologyCanvasEngine();
      // Init WITHOUT callbacks to avoid triggering setState during init
      // 기존 노드들의 현재 위치(orbitAngle)를 백업(전달)하여 색상 변경 시의 카메라 급발진/순간이동 현상을 막습니다.
      engine.init(graph, undefined, engineRef.current ? engineRef.current.nodes : undefined);
      engine.isOrbiting = true;

      // ----- 카메라 및 선택 상태 유지 (깜빡임/리셋 방지) -----
      if (engineRef.current) {
        engine.cameraOffsetX = engineRef.current.cameraOffsetX;
        engine.cameraOffsetY = engineRef.current.cameraOffsetY;
        engine.targetOffsetX = engineRef.current.targetOffsetX;
        engine.targetOffsetY = engineRef.current.targetOffsetY;
        engine.zoom = engineRef.current.zoom;
        
        if (engineRef.current.activeNode) {
          const stillExists = engine.nodes.find(n => n.id === engineRef.current!.activeNode!.id);
          if (stillExists) {
            engine.activeNode = stillExists;
            engine.previousActiveNodeId = stillExists.id;
          }
        }
      }

      engineRef.current = engine;

      // Set state AFTER engine is fully initialized (no callbacks during init)
      const initialNode = engine.activeNode || engine.centerNode;
      const initialEdges = initialNode ? engine.getConnectedEdges(initialNode.id) : [];
      const initialStats = { nodes: engine.nodeCount, edges: engine.edgeCount };

      // Attach callbacks AFTER init for user interaction
      engine.callbacks = {
        onActiveNodeChange: (node) => {
          // 대상 노드 찍기 (선분 연결 모드) 동작 처리
          if (edgeModeSourceRef.current && node && node.id !== edgeModeSourceRef.current) {
             const parentId = edgeModeSourceRef.current;
             // 타겟 노드의 부모를 edgeModeSource로 설정 (의존성 생성)
             setNodeOverride(node.id, { customParent: parentId, fixedX: undefined, fixedY: undefined });
             setEdgeModeSource(null);
             setTimeout(() => initEngine(), 30);
             return;
          }
          if (node?.id === edgeModeSourceRef.current) {
             setEdgeModeSource(null); // 자기자신을 한 번 더 누르면 취소
          }

          setActiveNode(node ?? null);
          if (node) setShow5W1H(true);
          if (node && engineRef.current) {
            setConnectedEdges(engineRef.current.getConnectedEdges(node.id));
          } else {
            setConnectedEdges([]);
          }
        },
        onHoveredNodeChange: (node) => setHoveredNode(node ?? null),
        onNodeReparent: (id, newParentId, newOrbit) => {
          // Changed categorical parent, set target orbit, and clean up any physical pins
          setNodeOverride(id, { customParent: newParentId, customOrbitIndex: newOrbit, fixedX: undefined, fixedY: undefined });
          // Defer initEngine so React state batching processes first
          setTimeout(() => initEngine(), 30);
        }
      };

      // Batch state updates
      setStats(initialStats);
      setActiveNode(initialNode);
      setConnectedEdges(initialEdges);
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

      // 툴팁이 캔버스 하단에 고정되므로 동적 transform 로직 삭제

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
    const canvas = canvasRef.current;
    if (!engine || !canvas) return;
    const { x, y } = getCanvasPos(e.nativeEvent);
    engine.handleHover(x, y);

    // Drag
    if (e.buttons === 1) {
      const dpr = dprRef.current;
      engine.handleDragMove(x, y, canvas.width / dpr, canvas.height / dpr);
    }
  }, [getCanvasPos]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const engine = engineRef.current;
    if (!engine) return;
    const { x, y } = getCanvasPos(e.nativeEvent);
    engine.handleDragStart(x, y);
  }, [getCanvasPos]);

  const handleMouseUp = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.handleDragEnd();
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const engine = engineRef.current;
    if (!engine) return;
    const { x, y } = getCanvasPos(e.nativeEvent);
    engine.handleClick(x, y);

    // If edge connecting mode is active, handle it
    if (edgeModeSource && engine.activeNode && engine.activeNode.id !== edgeModeSource) {
      addCustomEdge(edgeModeSource, engine.activeNode.id);
      setEdgeModeSource(null);
      // Timeout needed to let React update state before re-initializing engine
      setTimeout(() => initEngine(), 50);
    }
  }, [getCanvasPos, edgeModeSource, addCustomEdge, initEngine]);

  // ── Touch Events for Mobile ──
  const touchStartRef = useRef<{ x: number; y: number; time: number; pinchDist?: number }>({ x: 0, y: 0, time: 0 });
  const isTouchDragging = useRef(false);

  const getTouchDist = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return 0;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const engine = engineRef.current;
    if (!engine) return;
    e.preventDefault();

    if (e.touches.length === 2) {
      // Pinch start
      touchStartRef.current.pinchDist = getTouchDist(e);
      return;
    }

    const { x, y } = getCanvasPos(e.nativeEvent as unknown as TouchEvent);
    touchStartRef.current = { x, y, time: Date.now() };
    isTouchDragging.current = false;
    engine.handleDragStart(x, y);
  }, [getCanvasPos]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine || !canvas) return;
    e.preventDefault();

    // Pinch zoom
    if (e.touches.length === 2 && touchStartRef.current.pinchDist) {
      const newDist = getTouchDist(e);
      const delta = touchStartRef.current.pinchDist - newDist;
      engine.handleWheel(delta * 2);
      touchStartRef.current.pinchDist = newDist;
      return;
    }

    const { x, y } = getCanvasPos(e.nativeEvent as unknown as TouchEvent);
    const dx = Math.abs(x - touchStartRef.current.x);
    const dy = Math.abs(y - touchStartRef.current.y);
    if (dx > 5 || dy > 5) isTouchDragging.current = true;

    engine.handleHover(x, y);
    const dpr = dprRef.current;
    engine.handleDragMove(x, y, canvas.width / dpr, canvas.height / dpr);
  }, [getCanvasPos]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const engine = engineRef.current;
    if (!engine) return;
    e.preventDefault();

    if (touchStartRef.current.pinchDist) {
      touchStartRef.current.pinchDist = undefined;
      return;
    }

    engine.handleDragEnd();

    // Tap detection (short duration + small movement)
    const elapsed = Date.now() - touchStartRef.current.time;
    if (!isTouchDragging.current && elapsed < 300) {
      engine.handleClick(touchStartRef.current.x, touchStartRef.current.y);
    }
  }, []);

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
          onClick={() => initEngine()}
          className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm hover:opacity-90 cursor-pointer"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">


      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Radio size={22} className="text-emerald-500" />
          시그널
        </h2>
        <div className="flex items-center gap-2">
          {usingSample && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">
              시그널을 입력해주세요
            </span>
          )}

          <button
            onClick={() => {
              const label = prompt('추가할 노드 이름을 입력하세요:');
              if (label) {
                // 1번 궤도(기둥 카테고리) 목록 추출
                const engine = engineRef.current;
                const categories = engine ? engine.nodes.filter(n => n.orbitIndex === 1) : [];
                
                // 엔진 중앙에서 생성되도록 살짝 랜덤 좌표값 부여
                const x = (Math.random() - 0.5) * 50;
                const y = (Math.random() - 0.5) * 50;
                const newNode = addCustomNode(label, x, y);

                if (activeNode) {
                  // 현재 클릭(선택)된 노드가 있다면, 새 노드를 그 노드의 직속 파생 자식으로 자동 배정
                  setNodeOverride(newNode.id, { 
                    customParent: activeNode.id,
                    customOrbitIndex: activeNode.orbitIndex + 1,
                    fixedX: undefined,
                    fixedY: undefined
                  });
                } else if (categories.length > 0) {
                  // 선택된 노드가 없으면 무작위 기둥 카테고리 하나를 골라 부모로 배정
                  const randomCat = categories[Math.floor(Math.random() * categories.length)];
                  setNodeOverride(newNode.id, { 
                    customParent: randomCat.id,
                    fixedX: undefined, 
                    fixedY: undefined
                  });
                } else {
                  // 등록된 카테고리가 아예 없다면 본인이 1번 궤도 기둥 카테고리로 승격
                  setNodeOverride(newNode.id, { customGroup: 'MACRO_RESEARCH' });
                }
                setTimeout(() => initEngine(), 10);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-xs font-semibold hover:opacity-90 shadow-sm border border-emerald-600 cursor-pointer transition-colors"
          >
            <PlusSquare size={14} /> 노드 추가
          </button>
        </div>
      </div>

      {/* Main: Side Panel (left) + Canvas (right) */}
      <div className={isFullscreen ? '' : 'grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4'}>

        {/* ── Side Panel (left on desktop, below canvas on mobile) ── */}
        <div 
          className={
            isFullscreen 
              ? 'hidden md:block fixed top-4 right-auto bottom-4 left-4 z-[110] w-[280px] lg:w-[320px] shadow-2xl rounded-xl custom-scrollbar'
              : 'order-2 lg:order-none lg:self-start w-full'
          }
          style={{ 
            maxHeight: isFullscreen ? 'calc(100vh - 32px)' : 'min(600px, 70vh)', 
            overflowY: 'auto' 
          }}
        >
          {/* Node Detail */}
            <div className="bg-white rounded-xl border border-[var(--color-border-light)] shadow-sm overflow-hidden h-full">
              <div className="px-4 py-3 border-b border-[var(--color-border-light)] bg-gray-50/50">
                <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">노드 상세</h3>
              </div>
              <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(min(600px, 70vh) - 44px)' }}>
                {activeNode ? (
                  <div className="p-4">
                    {/* Group color + label */}
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white text-base font-bold"
                        style={{ backgroundColor: GROUP_COLORS[activeNode.group as OntologyGroup] }}
                      >
                        {activeNode.label.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-base text-[var(--color-text-primary)] leading-snug flex items-center justify-between">
                          <span className="truncate pr-2">{activeNode.label}</span>
                          <button
                            onClick={() => {
                              const newName = prompt('새 이름을 입력하세요:', activeNode.label);
                              if (newName && newName.trim() !== activeNode.label) {
                                // Migrating auto-generated category node overrides to their new ID
                                let targetId = activeNode.id;
                                const rawOld = activeNode.label.startsWith('#') ? activeNode.label.slice(1) : activeNode.label;
                                const rawNew = newName.trim().startsWith('#') ? newName.trim().slice(1) : newName.trim();
                                const isUncategorized = activeNode.id === 'tag-💭 미분류';
                                
                                if (activeNode.id.startsWith('tag-') && !isUncategorized) {
                                  targetId = `tag-${rawNew}`;
                                  // Transfer existing overrides to the new anticipated ID
                                  const existingOverride = overrides[activeNode.id] || {};
                                  setNodeOverride(targetId, { ...existingOverride, customLabel: newName.trim() });
                                  clearNodeOverride(activeNode.id);
                                } else {
                                  // Custom nodes OR '미분류' retain their original ID
                                  const existingOverride = overrides[targetId] || {};
                                  setNodeOverride(targetId, { ...existingOverride, customLabel: newName.trim() });
                                  if (targetId.startsWith('custom-')) {
                                    updateCustomNodeText(targetId, newName.trim());
                                  }
                                }
                                
                                // Mutate engine immediately for fluid UI
                                if (engineRef.current) {
                                  const engineNode = engineRef.current.nodes.find((n: OrbitalNode) => n.id === activeNode.id);
                                  if (engineNode) {
                                    engineNode.label = newName.trim();
                                    // Make sure we update ID for category migration, BUT don't break custom or uncategorized nodes
                                    if (activeNode.id.startsWith('tag-') && !isUncategorized) {
                                      engineNode.id = targetId; 
                                    }
                                  }
                                  setActiveNode({ ...activeNode, id: targetId, label: newName.trim() });
                                }

                                // Call global sync if it's a category node
                                if ((activeNode.orbitIndex === 1 || activeNode.group === 'MACRO_RESEARCH') && onRenameCategory) {
                                  onRenameCategory(activeNode.label, newName.trim());
                                }
                              }
                            }}
                            className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 hover:text-gray-700 transition-colors cursor-pointer shrink-0"
                            title="이름 수정"
                          >
                            <Edit2 size={12} />
                          </button>
                        </div>
                        <span className="text-xs text-[var(--color-text-tertiary)]">
                          {GROUP_LABELS[activeNode.group as OntologyGroup]}
                        </span>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                        중요도 {activeNode.baseValue}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600">
                        연결 {connectedEdges.length}개
                      </span>
                      {activeNode.isHedge && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                          🚧 병목 노드
                        </span>
                      )}
                    </div>

                    {/* Metrics bar */}
                    <div className="flex gap-2 mb-4">
                      <div className="flex-1 bg-gray-50 rounded-lg px-2.5 py-1.5 text-center">
                        <div className="text-xs text-[var(--color-text-tertiary)]">순가중치</div>
                        <div className={`text-sm font-bold ${(activeNode.netWeight ?? 0) < 0 ? 'text-red-500' : 'text-blue-500'}`}>
                          {(activeNode.netWeight ?? 0) >= 0 ? '+' : ''}{(activeNode.netWeight ?? 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-lg px-2.5 py-1.5 text-center">
                        <div className="text-xs text-[var(--color-text-tertiary)]">궤도</div>
                        <div className="text-sm font-bold text-[var(--color-text-primary)]">
                          {activeNode.orbitIndex === 0 ? '중심' : `${activeNode.orbitIndex}궤도`}
                        </div>
                      </div>
                    </div>

                    {/* Node Controls (Whiteboard) */}
                    <div className="mb-4 bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="text-xs font-semibold text-[var(--color-text-tertiary)] mb-2 flex items-center gap-1">
                        <Palette size={10} /> 색상 변경
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {PRESET_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => {
                              setNodeOverride(activeNode.id, { customColor: c });
                              if (engineRef.current) {
                                const engineNode = engineRef.current.nodes.find((n: OrbitalNode) => n.id === activeNode.id);
                                if (engineNode) engineNode.customColor = c;
                                setActiveNode({ ...activeNode, customColor: c });
                              }
                              // 전체 재계산을 통해 자식 노드들에게도 색상 동기화를 트리거합니다
                              setTimeout(() => initEngine(), 50);
                            }}
                            className="w-5 h-5 rounded-full shadow-sm hover:scale-110 transition-transform cursor-pointer border border-black/10"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                        <button
                          onClick={() => {
                            setNodeOverride(activeNode.id, { customColor: undefined });
                            if (engineRef.current) {
                              const engineNode = engineRef.current.nodes.find((n: OrbitalNode) => n.id === activeNode.id);
                              if (engineNode) delete engineNode.customColor;
                              const newNode = { ...activeNode };
                              delete newNode.customColor;
                              setActiveNode(newNode);
                            }
                            // 전체 재계산을 통해 자식 노드 탈색(복구) 처리 동기화
                            setTimeout(() => initEngine(), 50);
                          }}
                          className="w-5 h-5 rounded-full flex items-center justify-center border border-gray-300 bg-white text-gray-500 hover:bg-gray-100 cursor-pointer text-[9px]"
                          title="색칠 지우기"
                        >
                          <X size={10} />
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {activeNode.fixedX !== undefined && (
                          <button
                            onClick={() => {
                              setNodeOverride(activeNode.id, { fixedX: undefined, fixedY: undefined });
                              if (engineRef.current) {
                                const engineNode = engineRef.current.nodes.find((n: OrbitalNode) => n.id === activeNode.id);
                                if (engineNode) {
                                  delete engineNode.fixedX;
                                  delete engineNode.fixedY;
                                }
                                const newNode = { ...activeNode };
                                delete newNode.fixedX;
                                delete newNode.fixedY;
                                setActiveNode(newNode);
                              }
                            }}
                            className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-xs font-medium text-gray-600 hover:bg-gray-50 cursor-pointer"
                          >
                            <PinOff size={12} /> 궤도 고정 해제
                          </button>
                        )}
                        <button
                          onClick={() => setEdgeModeSource(activeNode.id)}
                          className={`flex items-center gap-1 px-2 py-1 border rounded text-xs font-medium cursor-pointer transition-colors ${
                            edgeModeSource === activeNode.id
                              ? 'bg-blue-50 border-blue-200 text-blue-600'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <Waypoints size={12} /> {edgeModeSource === activeNode.id ? '대상 노드 찍기...' : '이 노드에서 선분 연결'}
                        </button>
                        
                        {activeNode.orbitIndex > 0 && (
                          <div className="flex bg-indigo-50 border border-indigo-200 rounded text-xs font-medium text-indigo-600 shadow-sm overflow-hidden shrink-0">
                            <button
                              onClick={() => {
                                if (activeNode.orbitIndex === 1) {
                                  if (confirm(`'${activeNode.label}' 노드를 시스템 전체의 중앙 뿌리(태양) 노드로 승격시킬까요?\n\n기존 중앙 노드가 있다면 1번 궤도로 밀려납니다.`)) {
                                    // 기존에 중앙 노드(Orbit 0) 권한을 가진 노드들을 모두 1번 궤도로 강등
                                    Object.entries(overrides).forEach(([nodeId, override]) => {
                                      if (override?.customOrbitIndex === 0) {
                                        setNodeOverride(nodeId, { customOrbitIndex: 1, customParent: 'root-HCHPS' });
                                      }
                                    });
                                    setNodeOverride(activeNode.id, { customParent: undefined, customOrbitIndex: 0, fixedX: undefined, fixedY: undefined });
                                    setTimeout(() => initEngine(), 50);
                                  }
                                } else if (activeNode.orbitIndex === 2) {
                                  if (confirm(`'${activeNode.label}' 노드를 1차 카테고리로 승격시킬까요?\n\n이 노드는 현재 부모에게서 분리되어 독립적인 중심축(방사형 뿌리)을 형성합니다.`)) {
                                    setNodeOverride(activeNode.id, { customParent: 'root-HCHPS', customOrbitIndex: 1, fixedX: undefined, fixedY: undefined });
                                    setTimeout(() => initEngine(), 30);
                                  }
                                } else if (activeNode.orbitIndex > 2) {
                                  setNodeOverride(activeNode.id, { customOrbitIndex: activeNode.orbitIndex - 1, fixedX: undefined, fixedY: undefined });
                                  setTimeout(() => initEngine(), 30);
                                }
                              }}
                              disabled={activeNode.orbitIndex <= 0}
                              className="flex items-center gap-1 px-2 py-1 hover:bg-indigo-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border-r border-indigo-200"
                              title="안쪽 궤도로 당기기 (승격)"
                            >
                              <ChevronUp size={12} /> 승격
                            </button>
                            <button
                              onClick={() => {
                                if (activeNode.orbitIndex === 0 && activeNode.id !== 'root-HCHPS') {
                                  if (confirm(`'${activeNode.label}' 노드를 중앙 태양 자리에서 내려놓고 일반 파벌로 되돌리시겠습니까?`)) {
                                    setNodeOverride(activeNode.id, { customOrbitIndex: 1, customParent: 'root-HCHPS' });
                                    setTimeout(() => initEngine(), 50);
                                  }
                                } else {
                                  setNodeOverride(activeNode.id, { customOrbitIndex: activeNode.orbitIndex + 1, fixedX: undefined, fixedY: undefined });
                                  setTimeout(() => initEngine(), 30);
                                }
                              }}
                              className="flex items-center gap-1 px-2 py-1 hover:bg-indigo-100 transition-colors cursor-pointer"
                              title="바깥 궤도로 밀어내기 (하락)"
                            >
                              하락 <ChevronDown size={12} />
                            </button>
                          </div>
                        )}

                        <div className="flex-1 min-w-[20px]" /> {/* Spacer to push actions entirely right */}
                        
                        <button
                          onClick={() => {
                            if (confirm(`'${activeNode.label}' 처리를 완료하고 지도에서 숨기시겠습니까?`)) {
                              setNodeOverride(activeNode.id, { hidden: true });
                              if (engineRef.current) {
                                engineRef.current.nodes = engineRef.current.nodes.filter((n: OrbitalNode) => n.id !== activeNode.id);
                                engineRef.current.edges = engineRef.current.edges.filter((e: OntologyEdge) => e.source !== activeNode.id && e.target !== activeNode.id);
                                setActiveNode(null);
                              }
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors shadow-sm cursor-pointer"
                          title="일정/업무 완료 처리 및 맵에서 숨기기"
                        >
                          <CheckCircle size={14} /> 완료 (숨기기)
                        </button>

                        <button
                          onClick={() => {
                            const isDeepDelete = activeNode.id.startsWith('custom-') || activeNode.orbitIndex === 1;
                            const msg = isDeepDelete 
                              ? '이 카테고리(또는 노드)를 완전히 삭제할까요?\n\n※ 연관된 태그나 데이터 연동이 해제될 수 있습니다.'
                              : '이 노드를 맵에서 삭제할까요?\n\n※ 원본 데이터(업무/지식 등)는 보존되며 맵 화면에서만 지워집니다.';
                            
                            if (confirm(msg)) {
                              if (isDeepDelete) {
                                // Global sync for category deletion
                                if ((activeNode.orbitIndex === 1 || activeNode.group === 'MACRO_RESEARCH') && onDeleteCategory) {
                                  onDeleteCategory(activeNode.label);
                                }
                                if (activeNode.id.startsWith('custom-')) {
                                  deleteCustomNode(activeNode.id);
                                }
                              }
                              
                              // 맵 화면에서는 항상 히든 처리합니다. (특히 '미분류' 같은 자동 생성 카테고리나, 서버 삭제 딜레이 시 빠른 UI 반영을 위함)
                              setNodeOverride(activeNode.id, { hidden: true });
                              
                              if (engineRef.current) {
                                engineRef.current.nodes = engineRef.current.nodes.filter(n => n.id !== activeNode.id);
                                engineRef.current.edges = engineRef.current.edges.filter(e => e.source !== activeNode.id && e.target !== activeNode.id);
                                setActiveNode(null);
                              }
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-600 hover:bg-red-100 hover:text-red-700 transition-colors shadow-sm cursor-pointer"
                          title="삭제하기"
                        >
                          <Trash2 size={14} /> 삭제
                        </button>
                      </div>
                    </div>

                    {/* Connected edges */}
                    {connectedEdges.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1 text-xs font-semibold text-[var(--color-text-tertiary)] mb-2">
                          <Link2 size={12} />
                          연결된 항목 ({connectedEdges.length}개)
                        </div>
                        <div className="space-y-1 max-h-[280px] overflow-y-auto custom-scrollbar">
                          {connectedEdges.map(({ edge, otherNode }, idx) => (
                            <button
                              key={`${otherNode.id}-${idx}`}
                              onClick={() => handleNodeClickInPanel(otherNode.id)}
                              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors text-left"
                            >
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: GROUP_COLORS[otherNode.group as OntologyGroup] }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                                  {otherNode.label}
                                </div>
                                <div className="text-xs text-[var(--color-text-tertiary)]">
                                  {EDGE_TYPE_LABELS[edge.type as EdgeType] || edge.type}
                                </div>
                              </div>
                              <span className={`px-1.5 py-0.5 rounded text-xs font-bold shrink-0 ${
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
                    <Radio size={28} className="mx-auto mb-3 text-[var(--color-text-tertiary)] opacity-30" />
                    <div className="text-sm text-[var(--color-text-tertiary)] leading-relaxed">
                      노드를 선택해보세요<br />
                      그래프의 점을 클릭하면<br />
                      연결된 관계를 확인할 수 있어요
                    </div>
                  </div>
                )}
              </div>
            </div>
        </div>

        {/* ── Canvas Container ── */}
        <div
          ref={containerRef}
          className={
            isFullscreen 
              ? 'fixed inset-0 z-[100] bg-[#f8f9fc]' 
              : 'relative rounded-xl overflow-hidden border border-[var(--color-border-light)] order-1 lg:order-none'
          }
          style={{ height: isFullscreen ? '100vh' : 'min(600px, 70vh)', backgroundColor: '#f8f9fc' }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ cursor: hoveredNode ? 'pointer' : 'grab', touchAction: 'none' }}
            onClick={handleClick}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />

          {/* Whiteboard Toolbar (top-left) - Moved specific tools here if any, or remove */}
          {edgeModeSource && (
            <div className="absolute top-16 left-3 z-10 flex flex-col gap-2">
              <div className="bg-blue-50/90 backdrop-blur rounded-lg px-3 py-2 shadow-sm border border-blue-200 text-xs font-semibold text-blue-700 animate-pulse">
                대상을 클릭해 선을 연결하세요...
                <button 
                  onClick={() => setEdgeModeSource(null)}
                  className="ml-2 underline text-blue-500 hover:text-blue-800 cursor-pointer"
                >취소</button>
              </div>
            </div>
          )}

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

          {/* Edge Legend (Removed as requested by user) */}

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

          {/* 5W1H Active Node Bottom Panel */}
          {activeNode && show5W1H && (
            <div
              className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-[95%] max-w-3xl bg-white/95 backdrop-blur-xl rounded-xl p-5 shadow-2xl border border-emerald-100 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300"
            >
              <div className="flex items-center justify-between border-b border-emerald-50/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: GROUP_COLORS[activeNode.group as OntologyGroup] }} />
                  <span className="text-[15px] font-bold text-slate-800">{activeNode.label} 인적 자원 및 세부 내역</span>
                </div>
                <button 
                  onClick={() => setShow5W1H(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="패널 닫기"
                >
                  <X size={16} />
                </button>
              </div>

              {/* 5W1H Inputs (3 column grid) */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4">
                {[
                  { key: 'department', label: '소속' },
                  { key: 'title', label: '직함' },
                  { key: 'contact', label: '연락처' },
                  { key: 'when', label: '언제' },
                  { key: 'where', label: '어디서' },
                  { key: 'what', label: '무엇을' }
                ].map(({ key, label }) => {
                  const typedKey = key as 'department' | 'title' | 'contact' | 'when' | 'where' | 'what';
                  const rawVal = overrides[activeNode.id]?.story5W1H?.[typedKey] || '';

                  let displayVal = rawVal;
                  if (key === 'when' && !rawVal) {
                    const d = new Date();
                    const pad = (n: number) => n.toString().padStart(2, '0');
                    displayVal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00`;
                  }

                  return (
                    <div key={key} className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-500 tracking-wide pl-1">{label}</label>
                      <input
                        type={key === 'when' ? 'datetime-local' : 'text'}
                        value={key === 'when' ? displayVal : rawVal}
                        onChange={(e) => {
                          const current5W1H = overrides[activeNode.id]?.story5W1H || {};
                          let inputVal = e.target.value;
                          
                          // 연락처 자동 하이픈 처리
                          if (key === 'contact') {
                            inputVal = inputVal.replace(/[^0-9]/g, ''); // 숫자만 남기기
                            if (inputVal.startsWith('02')) {
                              // 서울 (02)
                              if (inputVal.length >= 3 && inputVal.length <= 5) {
                                inputVal = inputVal.replace(/(\d{2})(\d+)/, '$1-$2');
                              } else if (inputVal.length > 5 && inputVal.length < 10) {
                                inputVal = inputVal.replace(/(\d{2})(\d{3})(\d+)/, '$1-$2-$3');
                              } else if (inputVal.length >= 10) {
                                inputVal = inputVal.replace(/(\d{2})(\d{4})(\d{4}).*/, '$1-$2-$3');
                              }
                            } else {
                              // 일반 지역번호 및 휴대폰 (010 등)
                              if (inputVal.length >= 4 && inputVal.length <= 6) {
                                inputVal = inputVal.replace(/(\d{3})(\d+)/, '$1-$2');
                              } else if (inputVal.length > 6 && inputVal.length === 10) {
                                inputVal = inputVal.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
                              } else if (inputVal.length > 10) {
                                inputVal = inputVal.replace(/(\d{3})(\d{4})(\d{4}).*/, '$1-$2-$3');
                              } else if (inputVal.length > 6) {
                                 inputVal = inputVal.replace(/(\d{3})(\d{3,4})/, '$1-$2-');
                              }
                            }
                            // 지울 때 끝에 하이픈이 오면 무시 
                            if (e.target.value.length < rawVal.length && rawVal.endsWith('-')) {
                               // 사용자 백스페이스 편의
                            }
                        }

                        // 날짜 픽커에서 기본값인 상태에서 건드리면 그 값을 그대로 저장
                        if (key === 'when' && !rawVal && inputVal) {
                           // pass
                        }

                        setNodeOverride(activeNode.id, { 
                          story5W1H: { ...current5W1H, [typedKey]: inputVal } 
                        });
                      }}
                      onFocus={(e) => e.stopPropagation()}
                      placeholder={key === 'when' ? '' : `${label} 입력...`}
                      className={`w-full bg-slate-50 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 focus:bg-white transition-all shadow-sm ${key === 'when' ? 'text-slate-600' : ''}`}
                    />
                  </div>
                );
              })}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="absolute top-4 right-4 z-10 bg-white/80 backdrop-blur rounded-lg px-3 py-1.5 text-[10px] text-slate-500 shadow-sm border border-slate-100 hidden md:block">
            🖱️ 선택: 클릭 · 이동: 드래그 · 줌: 휠스크롤
          </div>
          <div className="absolute bottom-3 left-3 z-10 bg-white/80 backdrop-blur rounded-lg px-3 py-1.5 text-[10px] text-[var(--color-text-tertiary)] md:hidden">
            👆 탭: 선택 · 드래그: 이동 · 핀치: 줌
          </div>
        </div>
      </div>

      {/* ── Signal Log Panel (full width, below canvas) ── */}
      {!isFullscreen && (
        <div className="bg-white rounded-xl border border-[var(--color-border-light)] shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--color-border-light)] bg-gray-50/50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] flex items-center gap-1.5">
              <FileText size={14} /> 시그널 로그 ({signalEntries.length}건)
            </h3>
          </div>
          <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
            {signalEntries.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-[var(--color-text-tertiary)]">
                아직 기록된 시그널이 없습니다. 위에서 상황을 입력해보세요.
              </div>
            ) : (
              <div>
                {signalEntries.map((entry) => {
                  const isEditing = editingEntryId === entry.id;
                  return (
                    <div
                      key={entry.id}
                      className={`px-5 py-4 border-b border-[var(--color-border-light)] last:border-b-0 transition-colors group ${
                        isEditing ? 'bg-emerald-50/40' : 'hover:bg-gray-50/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-[var(--color-text-primary)] leading-relaxed flex items-center gap-2">
                            {/* Source Badge */}
                            <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${
                              entry.id.startsWith('sig-') ? 'bg-purple-100 text-purple-700' :
                              entry.id.startsWith('task-') ? 'bg-blue-100 text-blue-700' :
                              entry.id.startsWith('know-') ? 'bg-yellow-100 text-yellow-700' :
                              entry.id.startsWith('proj-') ? 'bg-indigo-100 text-indigo-700' :
                              entry.id.startsWith('meet-') ? 'bg-pink-100 text-pink-700' :
                              entry.id.startsWith('budg-') ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {entry.id.startsWith('sig-') ? '🧠 생각' :
                               entry.id.startsWith('task-') ? '📋 업무' :
                               entry.id.startsWith('know-') ? '💡 지식' :
                               entry.id.startsWith('proj-') ? '🚀 PJ' :
                               entry.id.startsWith('meet-') ? '🤝 회의' :
                               entry.id.startsWith('budg-') ? '💰 예산' :
                               '📦 재고'}
                            </span>
                            {entry.text}
                          </div>
                          {/* Keywords — editable or static */}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {entry.keywords.map((kw, i) => (
                              <span
                                key={`${kw}-${i}`}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium ${
                                  isEditing
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : 'bg-emerald-50 text-emerald-700'
                                }`}
                              >
                                {kw}
                                {isEditing && onUpdateKeywords && entry.id.startsWith('sig-') && (
                                  <button
                                    onClick={() => onUpdateKeywords(entry.id, entry.keywords.filter((_, idx) => idx !== i))}
                                    className="hover:text-red-600 cursor-pointer"
                                    title={`'${kw}' 삭제`}
                                  >
                                    <X size={10} />
                                  </button>
                                )}
                              </span>
                            ))}
                            {/* Add keyword input — visible when editing */}
                            {isEditing && onUpdateKeywords && entry.id.startsWith('sig-') && (
                              <form
                                className="inline-flex items-center"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const kw = newKeyword.trim();
                                  if (kw && !entry.keywords.includes(kw)) {
                                    onUpdateKeywords(entry.id, [...entry.keywords, kw]);
                                    setNewKeyword('');
                                  }
                                }}
                              >
                                <input
                                  type="text"
                                  value={newKeyword}
                                  onChange={(e) => setNewKeyword(e.target.value)}
                                  className="w-24 px-2.5 py-1 rounded-md text-[11px] border border-emerald-300 bg-white outline-none focus:ring-1 focus:ring-emerald-400"
                                  placeholder="+ 키워드 추가"
                                />
                                <button
                                  type="submit"
                                  className="p-1 ml-1 text-emerald-600 hover:text-emerald-800 cursor-pointer"
                                >
                                  <Plus size={12} />
                                </button>
                              </form>
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--color-text-tertiary)] mt-2">
                            {new Date(entry.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        {/* Action buttons (Only for raw signals) */}
                        {entry.id.startsWith('sig-') && (
                          <div className={`flex items-center gap-1 shrink-0 ${
                            isEditing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          } transition-all`}>
                            {onUpdateKeywords && (
                              <button
                                onClick={() => {
                                  setEditingEntryId(isEditing ? null : entry.id);
                                  setNewKeyword('');
                                }}
                                className={`p-2 rounded-lg cursor-pointer transition-colors ${
                                  isEditing
                                    ? 'text-emerald-600 bg-emerald-100'
                                    : 'text-[var(--color-text-tertiary)] hover:text-emerald-600 hover:bg-emerald-50'
                                }`}
                                title={isEditing ? '편집 완료' : '키워드 편집'}
                              >
                                <Edit2 size={16} />
                              </button>
                            )}
                            {onDeleteSignal && (
                              <button
                                onClick={() => onDeleteSignal(entry.id)}
                                className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
                                title="시그널 삭제"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
