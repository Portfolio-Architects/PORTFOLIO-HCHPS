'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { OntologyCanvasEngine } from '@/lib/OntologyCanvasEngine';
import { OntologyLayout } from '@/lib/engine/OntologyLayout';
import { buildSignalGraph } from '@/lib/signal-graph';
import { SignalEntry } from '@/hooks/useSignal';
import {
  OrbitalNode, OntologyEdge,
  GROUP_COLORS, GROUP_LABELS, OntologyGroup,
  EDGE_TYPE_LABELS, EdgeType,
} from '@/lib/ontology.types';
import { useGraphCustomization } from '@/hooks/useGraphCustomization';
import { WikiEditor } from './WikiEditor';
import { useWikiStorage } from '@/hooks/useWikiStorage';
import {
  Radio, Loader2, RefreshCw, AlertTriangle, BookOpen,
  Circle, Link2, X, ChevronRight, ChevronUp, ChevronDown, Zap, Maximize2, Minimize2,
  Trash2, FileText, Edit2, Plus, Palette, PinOff, PlusSquare, Waypoints, Eraser, Play, Pause,
  CheckCircle, Unlink, Crosshair
} from 'lucide-react';


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
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [newNodeName, setNewNodeName] = useState("");
  const { overrides = {}, customNodes = [], customEdges = [], deletedEdges = [], undo, redo, setNodeOverride, batchSetNodeOverrides, clearNodeOverride, addCustomNode, deleteCustomNode, updateCustomNodeText, addCustomEdge, deleteCustomEdge, removeCustomTombstone, clearOverrides, resetLayoutOverrides, clearAll } = useGraphCustomization();
  useEffect(() => {
    const handleOpenWiki = (e: CustomEvent<{ id: string; label: string }>) => {
      // Find the actual node if it exists in the engine, otherwise mock enough properties for WikiEditor to work
      const existingNode = engineRef.current?.nodes.find(n => n.id === e.detail.id);
      setActiveNode((existingNode || {
        id: e.detail.id,
        label: e.detail.label,
        type: 'core',
        radius: 20,
        x: 0, y: 0, vx: 0, vy: 0
      }) as unknown as OrbitalNode);
    };
    
    const handleCloseWiki = () => {
      setActiveNode(null);
    };

    window.addEventListener('wiki:openNode', handleOpenWiki as EventListener);
    window.addEventListener('wiki:closeNode', handleCloseWiki as EventListener);
    
    return () => {
      window.removeEventListener('wiki:openNode', handleOpenWiki as EventListener);
      window.removeEventListener('wiki:closeNode', handleCloseWiki as EventListener);
    };
  }, []);

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
  const deletedEdgesRef = useRef(deletedEdges);
  overridesRef.current = overrides;
  customNodesRef.current = customNodes;
  customEdgesRef.current = customEdges;
  deletedEdgesRef.current = deletedEdges;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState('');
  const [edgeModeSource, setEdgeModeSource] = useState<string | null>(null);
  const [parentModeSource, setParentModeSource] = useState<string | null>(null);

  
  const [isWikiOpen, setIsWikiOpen] = useState(false);
  const { blocks: wikiBlocks, isLoaded: wikiLoaded, saveBlocks: saveWikiBlocks } = useWikiStorage(isWikiOpen && activeNode ? activeNode.id : null, setNodeOverride);
  
  const tooltipRef = useRef<HTMLDivElement>(null);
  const edgeModeSourceRef = useRef(edgeModeSource);
  useEffect(() => { edgeModeSourceRef.current = edgeModeSource; }, [edgeModeSource]);
  const parentModeSourceRef = useRef(parentModeSource);
  useEffect(() => { parentModeSourceRef.current = parentModeSource; }, [parentModeSource]);

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
        deletedEdges: deletedEdgesRef.current // Fix stale closure issue
      });
      setUsingSample(Object.keys(signalKeywordsRef.current).length === 0);

      const engine = new OntologyCanvasEngine();
      // 기존 노드들의 현재 위치(orbitAngle) 및 접힘 상태 백업(전달)하여 카메라 급발진/순간이동 및 백화 현상을 막습니다.
      if (engineRef.current) {
         engine.hasInitializedCollapse = engineRef.current.hasInitializedCollapse;
         engine.collapsedNodeIds = new Set(engineRef.current.collapsedNodeIds);
      }
      
      // Init WITHOUT callbacks to avoid triggering setState during init
      engine.init(graph, undefined, engineRef.current ? engineRef.current.nodes : undefined);
      engine.isOrbiting = false;

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
            // 💡 데이터 변경/재초기화 후 카메라가 허공을 맴돌거나 중앙으로 초기화되지 않도록,
            // 복원된 현재 노드로 애니메이션/카메라의 초점을 다시 맞춥니다.
            engine.pendingCameraTargetId = stillExists.id;
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
          if (node?.id === edgeModeSourceRef.current) {
             setEdgeModeSource(null); // 자기자신을 한 번 더 누르면 취소
          }
          if (node?.id === parentModeSourceRef.current) {
             setParentModeSource(null); // 자기자신을 한 번 더 누르면 취소
          }

          setActiveNode(node ?? null);
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
          // setTimeout 제거: useEffect의 topologicOverridesHash 추적에 의해 자동 리렌더링됨
        },
        onNodePin: (id, fixedX, fixedY) => {
          // User manually dropped node somewhere; lock it to the map
          setNodeOverride(id, { fixedX, fixedY });
        },
        onNodeBatchPin: (pins) => {
          // Batched cluster drops (Shift+Drag to move Sub-graphs)
          if (!batchSetNodeOverrides) return;
          const updates: Record<string, any> = {};
          for (const p of pins) {
             updates[p.id] = { fixedX: p.fixedX, fixedY: p.fixedY };
          }
          batchSetNodeOverrides(updates);
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

  // ── Async Data Hydration ──
  // 최초 렌더링 시에는 Yjs 네트워크 지연으로 overrides가 빈 통({}) 상태입니다.
  // 찰나의 순간 뒤 서버에서 데이터가 넘어오거나 마이그레이션이 발동하면, 한 번 엔진을 덮어씌워서 복구(초기화)합니다.
  const didInitialAsyncLoad = useRef(false);
  const prevDataLengths = useRef({ nodes: 0, edges: 0, deletedEdges: 0, topoHash: '' });
  
  // customParent, customOrbitIndex 등 토폴로지에 영향을 주는 속성 변경사항만 추적 (좌표이동 fixedX/Y 제외)
  const topologicOverridesHash = Object.entries(overrides)
    .filter(([_, ov]) => ov.customParent !== undefined || ov.customOrbitIndex !== undefined)
    .map(([id, ov]) => `${id}:${ov.customParent}:${ov.customOrbitIndex}`)
    .sort()
    .join('|');

  useEffect(() => {
    // 하나라도 복구된(존재하는) 데이터가 들어왔고, 방금 막 다운로드 받은 상태라면
    if (!didInitialAsyncLoad.current && (Object.keys(overrides).length > 0 || customNodes.length > 0 || customEdges.length > 0 || deletedEdges.length > 0)) {
      didInitialAsyncLoad.current = true;
      prevDataLengths.current = { nodes: customNodes.length, edges: customEdges.length, deletedEdges: deletedEdges.length, topoHash: topologicOverridesHash };
      initEngine();
    } else if (didInitialAsyncLoad.current) {
      // 그 이후에 노드 생성/삭제 또는 토폴로지(부모/궤도/연결끊기)가 변동했다면 엔진 재초기화 (수동 setTimeout 타이밍 이슈 해결)
      if (customNodes.length !== prevDataLengths.current.nodes || 
          customEdges.length !== prevDataLengths.current.edges ||
          deletedEdges.length !== prevDataLengths.current.deletedEdges ||
          topologicOverridesHash !== prevDataLengths.current.topoHash) {
        prevDataLengths.current = { nodes: customNodes.length, edges: customEdges.length, deletedEdges: deletedEdges.length, topoHash: topologicOverridesHash };
        initEngine();
      }
    }
  }, [overrides, customNodes.length, customEdges.length, deletedEdges.length, topologicOverridesHash, initEngine]);

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

      const isDirty = engine.tick();
      if (isDirty) {
        engine.render(ctx, w, h);
      }

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
    // Shift 클릭을 통한 카테고리 전체 그룹 드래그 지원
    engine.handleDragStart(x, y, e.shiftKey);
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

    // If parent mode is active
    if (parentModeSource && engine.activeNode && engine.activeNode.id !== parentModeSource) {
      const childId = parentModeSource;
      const parentNode = engine.activeNode;
      const newOrbit = parentNode.orbitIndex > 0 ? parentNode.orbitIndex + 1 : undefined;
      removeCustomTombstone(childId, parentNode.id); // 부모 지정 시 기존 Tombstone 삭제
      setNodeOverride(childId, { customParent: parentNode.id, customOrbitIndex: newOrbit });
      setParentModeSource(null);
      setTimeout(() => initEngine(), 50);
      return; 
    }

    // If edge connecting mode is active, handle it
    if (edgeModeSource && engine.activeNode && engine.activeNode.id !== edgeModeSource) {
      const srcId = edgeModeSource;
      const tgtId = engine.activeNode.id;
      
      const exists = engine.edges.some(e => 
        (e.source === srcId && e.target === tgtId) ||
        (e.source === tgtId && e.target === srcId)
      );
      
      if (exists) {
        deleteCustomEdge(srcId, tgtId);
      } else {
        addCustomEdge(srcId, tgtId);
      }
      
      setEdgeModeSource(null);
      // setTimeout 제거: customEdges.length 변화 감지로 자동 엔진 재시작됨
    }
  }, [getCanvasPos, edgeModeSource, parentModeSource, addCustomEdge, deleteCustomEdge, initEngine, setNodeOverride]);

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

      // Parent mode logic
      if (parentModeSource && engine.activeNode && engine.activeNode.id !== parentModeSource) {
        const childId = parentModeSource;
        const parentNode = engine.activeNode;
        const newOrbit = parentNode.orbitIndex > 0 ? parentNode.orbitIndex + 1 : undefined;
        setNodeOverride(childId, { customParent: parentNode.id, customOrbitIndex: newOrbit });
        setParentModeSource(null);
        setTimeout(() => initEngine(), 50);
        return;
      }

      // If edge connecting mode is active, handle it (Mobile/Touch 대응)
      if (edgeModeSource && engine.activeNode && engine.activeNode.id !== edgeModeSource) {
        const srcId = edgeModeSource;
        const tgtId = engine.activeNode.id;
        
        const exists = engine.edges.some(edge => 
          (edge.source === srcId && edge.target === tgtId) ||
          (edge.source === tgtId && edge.target === srcId)
        );
        
        if (exists) {
          deleteCustomEdge(srcId, tgtId);
        } else {
          addCustomEdge(srcId, tgtId);
        }
        
        setEdgeModeSource(null);
        setTimeout(() => initEngine(), 50);
      }
    }
  }, [edgeModeSource, parentModeSource, addCustomEdge, initEngine, setNodeOverride]);

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




  const handleSwapNodeOrder = useCallback((dir: -1 | 1) => {
    if (!activeNode || !engineRef.current) return;
    const engine = engineRef.current;
    
    // Find parent in treeChildrenMap
    let parentId: string | null = null;
    let siblingsIds: string[] = [];
    
    for (const [pId, children] of OntologyLayout.lastTreeChildrenMap.entries()) {
      if (children.includes(activeNode.id)) {
         parentId = pId;
         siblingsIds = [...children];
         break;
      }
    }
    
    // Root 노드일 경우 (부모가 없음)
    if (!parentId) {
      const allChildren = new Set<string>();
      for (const children of OntologyLayout.lastTreeChildrenMap.values()) {
        children.forEach(c => allChildren.add(c));
      }
      // 루트 노드들의 형제 배열을 구성
      siblingsIds = engine.nodes
        .filter(n => !allChildren.has(n.id))
        .sort((a, b) => {
           const orderA = overrides[a.id]?.customSortOrder ?? 0;
           const orderB = overrides[b.id]?.customSortOrder ?? 0;
           if (orderA !== orderB) return orderA - orderB;
           return a.label.localeCompare(b.label);
        })
        .map(n => n.id);
    }
    
    const idx = siblingsIds.indexOf(activeNode.id);
    if (idx < 0) return;
    
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= siblingsIds.length) return;
    
    // 형제들의 순서를 명시적으로 0, 1, 2, ... 로 덮어씌움 (단, active와 target은 서로의 인덱스 가짐)
    siblingsIds.forEach((id, i) => {
      let finalIndex = i;
      if (i === idx) finalIndex = targetIdx;
      else if (i === targetIdx) finalIndex = idx;
      
      setNodeOverride(id, { customSortOrder: finalIndex });
      
      // 엔진 내 객체에도 즉시 반영
      const engineNode = engine.getNodeById(id);
      if (engineNode) {
          engineNode.customSortOrder = finalIndex;
      }
    });
    
    // Active Node 상태에도 즉시 반영 (리렌더링 후 선택 유지 목적)
    setActiveNode(prev => prev && prev.id === activeNode.id ? { ...prev, customSortOrder: targetIdx } : prev);
    
    setTimeout(() => initEngine(), 50);
  }, [activeNode, overrides, setNodeOverride, initEngine]);


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



  const renderNodeDetails = (isOverlay: boolean) => {
    return (
      <div 
        className={
          isOverlay 
            ? "absolute bottom-6 left-1/2 -translate-x-1/2 z-[110] w-[95%] md:w-[90%] max-w-[800px] bg-white/95 backdrop-blur-xl rounded-xl border border-[var(--color-border-light)] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
            : "w-full h-full flex-1 bg-white rounded-xl border border-[var(--color-border-light)] shadow-sm overflow-hidden relative flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-auto"
        }
      >
        <div className="px-4 py-3 border-b border-[var(--color-border-light)] bg-gray-50/50 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">노드 상세</h3>
          {isOverlay && (
            <button onClick={() => setActiveNode(null)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer shrink-0">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ maxHeight: isOverlay ? '40vh' : 'auto' }}>
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
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate">{activeNode.label}</span>
                            <span className="shrink-0 px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">
                              {activeNode.orbitIndex === 0 ? '중심' : `${activeNode.orbitIndex}궤도`}
                            </span>
                          </div>
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
                            className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 hover:text-gray-700 transition-colors cursor-pointer shrink-0 ml-2"
                            title="이름 수정"
                          >
                            <Edit2 size={12} />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] mt-0.5">
                          {(activeNode.orbitIndex === 1 || (activeNode.parentId && activeNode.parentId !== 'root-HCHPS')) && (
                            <>
                              <span className="text-emerald-600 font-medium truncate">
                                📁 카테고리: {activeNode.orbitIndex === 1 ? '메인' : (engineRef.current?.nodes.find((n: OrbitalNode) => n.id === activeNode.parentId)?.label || (activeNode.parentId?.startsWith('tag-') ? activeNode.parentId.replace('tag-', '') : '지정됨'))}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {activeNode.isHedge && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                          🚧 병목 노드
                        </span>
                      )}
                    </div>

                    <div className="mb-5">
                      <div className="text-[11px] font-bold text-slate-400 mb-1.5 flex items-center px-1 gap-1.5">
                        <Waypoints size={12} /> 관계 및 위계 설정
                      </div>
                      <div className="flex flex-col gap-2">
                        {/* 1. 카테고리 위계 선택 (새로운 기능) */}
                        <div className="flex flex-col gap-1 bg-slate-50 p-2.5 border border-slate-200 rounded-lg shadow-sm">
                          <div className="flex justify-between items-center mb-0.5">
                            <label className="text-[10px] font-bold text-slate-500">상위 카테고리 (그룹) 소속 지정</label>
                          </div>
                          <div className="flex gap-1.5">
                            <select
                              disabled={activeNode.id.startsWith('root-') && (!activeNode.parentId || activeNode.parentId === 'root-HCHPS' || activeNode.parentId === 'NONE')}
                              value={activeNode.parentId && activeNode.parentId !== 'root-HCHPS' ? activeNode.parentId : 'NONE'}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'NONE') {
                                  setNodeOverride(activeNode.id, { customParent: 'NONE', customOrbitIndex: undefined, fixedX: undefined, fixedY: undefined });
                                } else {
                                  const parentNode = engineRef.current?.nodes.find((n: OrbitalNode) => n.id === val);
                                  const newOrbit = parentNode ? parentNode.orbitIndex + 1 : undefined;
                                  // 과거에 이 대상과의 '끊기'를 수행한 적이 있다면 (Tombstone 존재), 부모 지정을 위해 Tombstone을 영구히 파기
                                  removeCustomTombstone(activeNode.id, val);
                                  setNodeOverride(activeNode.id, { customParent: val, customOrbitIndex: newOrbit, fixedX: undefined, fixedY: undefined });
                                }
                                setTimeout(() => initEngine(), 50);
                              }}
                              className={`flex-1 text-xs px-2 py-1.5 rounded-md border min-w-0 ${(activeNode.id.startsWith('root-') && (!activeNode.parentId || activeNode.parentId === 'root-HCHPS' || activeNode.parentId === 'NONE')) ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200 focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] cursor-pointer'}`}
                            >
                              <option value="NONE">소속 없음 (메인/독립 노드)</option>
                              {engineRef.current?.nodes
                                 .filter((n: OrbitalNode) => {
                                    // If this is the currently selected parent, always show it so the select doesn't break
                                    if (n.id === activeNode.parentId) return true;
                                    // Otherwise, if root node, don't show any other options
                                    if (activeNode.id.startsWith('root-')) return false;
                                    return n.id !== activeNode.id && !n.id.startsWith('root-') && n.orbitIndex > 0;
                                 })
                                 .sort((a, b) => {
                                   if (a.orbitIndex !== b.orbitIndex) return a.orbitIndex - b.orbitIndex;
                                   return a.label.localeCompare(b.label);
                                 })
                                 .map((c: OrbitalNode) => {
                                   const prefix = c.orbitIndex === 1 ? '📁 1차:' : c.orbitIndex === 2 ? '📄 2차:' : `📄 ${c.orbitIndex}차:`;
                                   return <option key={c.id} value={c.id}>{prefix} {c.label}</option>;
                                 })
                              }
                            </select>
                            
                            <button
                              onClick={() => setParentModeSource(parentModeSource === activeNode.id ? null : activeNode.id)}
                              className={`px-2.5 py-1.5 rounded-md border text-xs shadow-sm cursor-pointer transition-colors flex items-center justify-center shrink-0 ${
                                parentModeSource === activeNode.id
                                  ? 'bg-purple-100 border-purple-300 text-purple-700'
                                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                              }`}
                              title={parentModeSource === activeNode.id ? "맵에서 지정할 부모 노드를 클릭하세요..." : "맵에서 대상 노드 직접 클릭하기"}
                            >
                              <Crosshair size={14} />
                            </button>
                          </div>
                          <p className="text-[9px] text-slate-400 leading-tight mt-1">지정된 부모의 위계, 색상, 동기화 망에 종속됩니다.</p>
                        </div>
                        
                        {/* 2. 궤도 차수 강제 지정 */}
                        <div className="flex flex-col gap-1 bg-slate-50 p-2.5 border border-slate-200 rounded-lg shadow-sm">
                          <label className="text-[10px] font-bold text-slate-500 mb-0.5">궤도(차수) 수동 강제 지정</label>
                          <select
                            disabled={activeNode.id.startsWith('root-') && (!activeNode.customOrbitIndex || activeNode.customOrbitIndex === 0)}
                            className={`border text-xs px-2 py-1.5 rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] cursor-pointer ${(activeNode.id.startsWith('root-') && (!activeNode.customOrbitIndex || activeNode.customOrbitIndex === 0)) ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200'}`}
                            value={activeNode.customOrbitIndex ?? activeNode.orbitIndex ?? 1}
                            onChange={(e) => {
                              const newOrbit = Number(e.target.value);
                              setNodeOverride(activeNode.id, { customOrbitIndex: newOrbit === 0 ? undefined : newOrbit, fixedX: undefined, fixedY: undefined });
                              if (engineRef.current) {
                                const engineNode = engineRef.current.nodes.find((n: OrbitalNode) => n.id === activeNode.id);
                                if (engineNode) {
                                  engineNode.customOrbitIndex = newOrbit;
                                  engineNode.fixedX = undefined;
                                  engineNode.fixedY = undefined;
                                }
                                setActiveNode({ ...activeNode, customOrbitIndex: newOrbit, orbitIndex: newOrbit });
                              }
                              setTimeout(() => initEngine(), 50);
                            }}
                          >
                            {activeNode.id.startsWith('root-') && <option value="0">초기화 (0차 복귀)</option>}
                            <option value="1">1차 카테고리 (메인)</option>
                            <option value="2">2차 궤도 파생</option>
                            <option value="3">3차 궤도 파생</option>
                            <option value="4">4차 궤도 파생</option>
                            <option value="5">5차 궤도 파생</option>
                            <option value="6">6차 궤도 파생</option>
                          </select>
                        </div>

                        {/* 3. 형제 노드 간 정렬 순서 조정 */}
                        <div className="flex flex-col gap-1 bg-slate-50 p-2.5 border border-slate-200 rounded-lg shadow-sm">
                          <label className="text-[10px] font-bold text-slate-500 mb-0.5">배치 순서 위/아래 이동</label>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleSwapNodeOrder(-1)}
                              className="flex-1 px-2.5 py-1.5 rounded-md border text-xs font-semibold shadow-sm cursor-pointer transition-colors flex items-center justify-center shrink-0 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                              title="위로 올리기"
                            >
                              ⬆ 위로 이동
                            </button>
                            <button
                              onClick={() => handleSwapNodeOrder(1)}
                              className="flex-1 px-2.5 py-1.5 rounded-md border text-xs font-semibold shadow-sm cursor-pointer transition-colors flex items-center justify-center shrink-0 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                              title="아래로 내리기"
                            >
                              ⬇ 아래로 이동
                            </button>
                          </div>
                            <p className="text-[9px] text-slate-400 leading-tight mt-1">같은 부모를 가진 동급 노드들 사이의 표시 순서를 변경합니다.</p>
                        </div>

                        {/* 4. 일반 횡적 선분 연결 */}
                        <button
                          onClick={() => setEdgeModeSource(activeNode.id)}
                          className={`w-full flex items-center justify-center px-3 py-2 border rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-sm ${
                            edgeModeSource === activeNode.id
                              ? 'bg-blue-50 border-blue-200 text-blue-600'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <Link2 size={14} className="mr-1.5" /> {edgeModeSource === activeNode.id ? '선으로 이을 대상 노드 찍기...' : '다른 노드와 자유롭게 선 긋기...'}
                        </button>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="text-[11px] font-bold text-slate-400 mb-1.5 flex items-center px-1 gap-1.5">
                        <Trash2 size={12} /> 관리 속성
                      </div>
                      <div className="flex flex-col gap-1.5">
                        

                        <div className="flex gap-1.5 mt-0.5">
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
                            className="flex-1 flex justify-center items-center gap-1.5 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors shadow-sm cursor-pointer"
                          >
                            <CheckCircle size={14} /> 완료 처리
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
                                  engineRef.current.nodes = engineRef.current.nodes.filter((n: OrbitalNode) => n.id !== activeNode.id);
                                  engineRef.current.edges = engineRef.current.edges.filter((e: OntologyEdge) => e.source !== activeNode.id && e.target !== activeNode.id);
                                  setActiveNode(null);
                                }
                              }
                            }}
                            className="flex-1 flex justify-center items-center gap-1.5 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition-colors shadow-sm cursor-pointer"
                          >
                            <Trash2 size={14} /> 노드 삭제
                          </button>
                        </div>
                      </div>
                    </div>



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
    );
  };



  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Radio size={22} className="text-emerald-500" />
            시그널
          </h2>
          <div className="mt-1 flex items-center gap-3 text-xs text-[var(--color-text-tertiary)]">
            <span>노드 <strong className="text-[var(--color-primary)]">{stats.nodes}</strong>개</span>
            <span>연결 <strong className="text-[var(--color-success)]">{stats.edges}</strong>개</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeNode && !isWikiOpen && (
            <button
              onClick={() => setIsWikiOpen(true)}
              className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 shadow-sm border border-indigo-200 cursor-pointer transition-colors"
            >
              <BookOpen size={15} /> 위키 문서 편집
            </button>
          )}
          {usingSample && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">
              시그널을 입력해주세요
            </span>
          )}
        </div>
      </div>

      {/* Main: Side Panel (left) + Canvas (right) */}
      <div className={isFullscreen ? '' : 'grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4'}>

        {/* ── Side Panel: Node Details (노드 상세 패널) ── */}
        <div className={isFullscreen ? "hidden md:flex flex-col fixed top-4 right-auto bottom-4 left-4 z-[110] w-[280px] lg:w-[320px] shadow-2xl rounded-xl custom-scrollbar pointer-events-auto bg-[#f8f9fc]" : "order-2 lg:order-none w-full pointer-events-auto flex flex-col gap-3"} style={{ height: isFullscreen ? "calc(100vh - 32px)" : "min(600px, 70vh)" }}>
          {isAddingNode ? (
            <div className="w-full shrink-0 flex flex-col gap-2 p-3 rounded-xl bg-white shadow-sm border border-[var(--color-primary)] animate-in fade-in zoom-in-95 duration-200">
              <input
                autoFocus
                type="text"
                value={newNodeName}
                onChange={e => setNewNodeName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') setIsAddingNode(false);
                  if (e.key === 'Enter') {
                    if (newNodeName.trim()) {
                      const engine = engineRef.current;
                      const categories = engine ? engine.nodes.filter(n => n.orbitIndex === 1) : [];
                      const x = (Math.random() - 0.5) * 50;
                      const y = (Math.random() - 0.5) * 50;
                      const newNode = addCustomNode(newNodeName.trim(), x, y);

                      if (activeNode) {
                        setNodeOverride(newNode.id, { 
                          customParent: activeNode.id, customOrbitIndex: activeNode.orbitIndex + 1, fixedX: undefined, fixedY: undefined 
                        });
                      } else if (categories.length > 0) {
                        const randomCat = categories[Math.floor(Math.random() * categories.length)];
                        setNodeOverride(newNode.id, { customParent: randomCat.id, fixedX: undefined, fixedY: undefined });
                      } else {
                        setNodeOverride(newNode.id, { customGroup: 'MACRO_RESEARCH' });
                      }
                      
                      setIsAddingNode(false);
                      setNewNodeName("");
                    }
                  }
                }}
                placeholder="노드 이름 (Enter로 생성)"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setIsAddingNode(false)}
                  className="flex-1 py-1.5 px-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    if (newNodeName.trim()) {
                      const engine = engineRef.current;
                      const categories = engine ? engine.nodes.filter(n => n.orbitIndex === 1) : [];
                      const x = (Math.random() - 0.5) * 50;
                      const y = (Math.random() - 0.5) * 50;
                      const newNode = addCustomNode(newNodeName.trim(), x, y);

                      if (activeNode) {
                        setNodeOverride(newNode.id, { 
                          customParent: activeNode.id, customOrbitIndex: activeNode.orbitIndex + 1, fixedX: undefined, fixedY: undefined 
                        });
                      } else if (categories.length > 0) {
                        const randomCat = categories[Math.floor(Math.random() * categories.length)];
                        setNodeOverride(newNode.id, { customParent: randomCat.id, fixedX: undefined, fixedY: undefined });
                      } else {
                        setNodeOverride(newNode.id, { customGroup: 'MACRO_RESEARCH' });
                      }
                      setTimeout(() => initEngine(), 10);
                      setIsAddingNode(false);
                      setNewNodeName("");
                    }
                  }}
                  className="flex-1 py-1.5 px-2 bg-[var(--color-primary)] text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-colors"
                >
                  생성
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setIsAddingNode(true); setNewNodeName(""); }}
              className="w-full shrink-0 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold hover:opacity-90 shadow-sm border border-[var(--color-primary)] cursor-pointer transition-colors"
            >
              <PlusSquare size={16} /> 노드 추가
            </button>
          )}
          
          <div className="flex-1 min-h-0 relative">
            {renderNodeDetails(false)}
          </div>
        </div>

        {/* ── Canvas Container ── */}
        <div
          ref={containerRef}
          className={
            isFullscreen 
              ? 'fixed inset-0 z-[100] bg-[#f8f9fc]' 
              : 'relative rounded-xl overflow-hidden border border-[var(--color-border-light)] order-1 lg:order-none flex-1'
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

          {/* Whiteboard Toolbar (top-left) */}
          {edgeModeSource && (
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
              <div className="bg-blue-50/90 backdrop-blur rounded-lg px-3 py-2 shadow-sm border border-blue-200 text-xs font-semibold text-blue-700 animate-pulse">
                대상을 클릭해 선을 연결하세요...
                <button 
                  onClick={() => setEdgeModeSource(null)}
                  className="ml-2 underline text-blue-500 hover:text-blue-800 cursor-pointer"
                >취소</button>
              </div>
            </div>
          )}

          {/* Hover tooltip (for nodes that are NOT active) */}
          {hoveredNode && hoveredNode.id !== activeNode?.id && (
            <div
              className="absolute z-20 pointer-events-none bg-white/95 backdrop-blur rounded-lg px-3 py-2 shadow-md border border-[var(--color-border-light)] animate-in fade-in zoom-in duration-100"
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

          {/* Controls - Bottom Right */}
          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
            

            {/* Fullscreen toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="bg-white/90 backdrop-blur rounded-lg p-2.5 shadow-md border border-[var(--color-border-light)] hover:bg-gray-100 transition-colors cursor-pointer text-gray-500 hover:text-gray-800"
              title={isFullscreen ? '패널 보기' : '전체화면'}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>


          {/* Sliding Wiki Panel Overlay */}
          {isWikiOpen && activeNode && wikiLoaded && (
            <div className="absolute top-0 right-0 h-full bg-white z-[120] shadow-2xl border-l border-slate-200 w-full md:w-[450px] lg:w-[500px] animate-in slide-in-from-right-8 duration-300">
              <WikiEditor 
                key={activeNode.id}
                nodeId={activeNode.id} 
                nodeTitle={activeNode.label} 
                initialBlocks={wikiBlocks ?? undefined} 
                onChange={(blocks) => saveWikiBlocks(activeNode.id, blocks)} 
                onClose={() => setIsWikiOpen(false)} 
                addCustomEdge={addCustomEdge}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
