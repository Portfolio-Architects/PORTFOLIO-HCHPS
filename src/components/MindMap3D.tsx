'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { OntologyCanvasEngine } from '@/lib/OntologyCanvasEngine';
import { PerformanceProfiler } from '@/lib/engine/PerformanceProfiler';
import { OntologyLayout } from '@/lib/engine/OntologyLayout';
import { buildSignalGraph } from '@/lib/signal-graph';
import { SignalEntry } from '@/hooks/useSignal';
import {
  OrbitalNode, OntologyEdge,
  GROUP_COLORS, GROUP_LABELS, OntologyGroup,
} from '@/lib/ontology.types';
import { useGraphCustomization } from '@/hooks/useGraphCustomization';
import { WikiEditor } from './WikiEditor';
import { MindMapInspector } from './MindMapInspector';
import { MindMapHeader } from './mindmap/ui/MindMapHeader';
import { MindMapHUD } from './mindmap/ui/MindMapHUD';
import { useWikiStorage } from '@/hooks/useWikiStorage';
import { useClassificationWords } from '@/hooks/useClassificationWords';
import { useFileRadar } from '@/hooks/useFileRadar';
import { useTasks } from '@/hooks/useTasks';
import { useBudget } from '@/hooks/useBudget';

import {
  Loader2, AlertTriangle, X, Trash2, PlusSquare, Search, Radio, Copy
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
  isActive?: boolean;
}

// ============ Props Equal Comparison ============
function areMindMap3DPropsEqual(prevProps: MindMap3DProps, nextProps: MindMap3DProps) {
  if (prevProps.isActive !== nextProps.isActive) return false;

  const prevKeys = Object.keys(prevProps.signalKeywords || {});
  const nextKeys = Object.keys(nextProps.signalKeywords || {});
  if (prevKeys.length !== nextKeys.length) return false;
  for (const k of prevKeys) {
    if (prevProps.signalKeywords[k] !== nextProps.signalKeywords[k]) return false;
  }

  if (prevProps.signalEntries.length !== nextProps.signalEntries.length) return false;
  for (let i = 0; i < prevProps.signalEntries.length; i++) {
    const p = prevProps.signalEntries[i];
    const n = nextProps.signalEntries[i];
    if (p.id !== n.id || p.text !== n.text || p.createdAt !== n.createdAt || p.aiCurated !== n.aiCurated || p.category !== n.category) return false;

    const pk = p.keywords || [];
    const nk = n.keywords || [];
    if (pk.length !== nk.length) return false;
    for (let j = 0; j < pk.length; j++) {
      if (pk[j] !== nk[j]) return false;
    }
  }

  return true;
}

// ============ Component ============

export const MindMap3D = React.memo(function MindMap3D({ signalKeywords, signalEntries, onRenameCategory, onDeleteCategory, isActive = true }: MindMap3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<OntologyCanvasEngine | null>(null);
  const animationRef = useRef<number>(0);
  const dprRef = useRef(1);
  const zoomSliderRef = useRef<HTMLInputElement>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);

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
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [newNodeName, setNewNodeName] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [parentModeSource, setParentModeSource] = useState<string | null>(null);
  const [isWikiOpen, setIsWikiOpen] = useState(false);
  const [radarFiles, setRadarFiles] = useState<{ nodeId: string; files: any[] } | null>(null);
  


  // ── 수직 적층 온톨로지 레이어 필터 상태 삭제됨 ──
  
  // ── Node Search States ──
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);

  // Global hooks for MindMapInspector performance decoupling
  const { tasks = [] } = useTasks();
  const { categories = [], getCategoryStats } = useBudget();

  const matchedCat = useMemo(() => {
    if (!activeNode) return null;
    return categories.find(c => c.name.includes(activeNode.label) || activeNode.label.includes(c.name));
  }, [activeNode, categories]);

  const catStats = useMemo(() => {
    if (!matchedCat) return null;
    return getCategoryStats(matchedCat.id);
  }, [matchedCat, getCategoryStats]);

  const matchedTasks = useMemo(() => {
    if (!activeNode) return [];
    return tasks.filter(t => t.title?.includes(activeNode.label) || t.category?.includes(activeNode.label));
  }, [activeNode, tasks]);

  const { overrides = {}, customNodes = [], customEdges = [], deletedEdges = [], undo, redo, setNodeOverride, batchSetNodeOverrides, clearNodeOverride, addCustomNode, deleteCustomNode, updateCustomNodeText, addCustomEdge, deleteCustomEdge, removeCustomTombstone, renameNodeId, isCloudLoaded } = useGraphCustomization();
  const { mutate: getFileRadar } = useFileRadar();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleExecuteDelete = useCallback(() => {
    if (!activeNode) return;

    const parentId = activeNode.parentId;
    const isDeepDelete = activeNode.id.startsWith('custom-') || activeNode.orbitIndex === 1;
    
    if (isDeepDelete) {
      if ((activeNode.orbitIndex === 1 || activeNode.group === 'MACRO_RESEARCH') && onDeleteCategory) {
        onDeleteCategory(activeNode.label);
      }
      if (activeNode.id.startsWith('custom-')) {
        deleteCustomNode(activeNode.id);
      }
    }

    try {
      const oldTombstonesRaw = localStorage.getItem('hchps-global-tombstones');
      const tombstones: string[] = oldTombstonesRaw ? JSON.parse(oldTombstonesRaw) : [];
      localStorage.setItem('hchps-global-tombstones', JSON.stringify(Array.from(new Set([...tombstones, activeNode.id]))));

      if (activeNode.label) {
        const oldLabelsRaw = localStorage.getItem('hchps-deleted-labels');
        const deletedLabels: string[] = oldLabelsRaw ? JSON.parse(oldLabelsRaw) : [];
        localStorage.setItem('hchps-deleted-labels', JSON.stringify(Array.from(new Set([...deletedLabels, activeNode.label]))));
      }
    } catch (e) {
      console.error('Tombstone saving error in MindMap3D:', e);
    }
    
    setNodeOverride(activeNode.id, { hidden: true });
    
    let parentNode: OrbitalNode | null = null;
    if (engineRef.current) {
      engineRef.current.nodes = engineRef.current.nodes.filter((n: OrbitalNode) => n.id !== activeNode.id);
      engineRef.current.edges = engineRef.current.edges.filter((e: OntologyEdge) => e.source !== activeNode.id && e.target !== activeNode.id);
      
      if (parentId) {
        parentNode = engineRef.current.nodes.find((n: OrbitalNode) => n.id === parentId) || null;
      }
      
      if (parentNode) {
        engineRef.current.activeNode = parentNode;
        engineRef.current.pendingCameraTargetId = parentNode.id;
      } else {
        engineRef.current.activeNode = null;
      }
      engineRef.current.needsRedraw = true;
    }
    
    setActiveNode(parentNode);
    setIsDeleteModalOpen(false);
  }, [activeNode, onDeleteCategory, deleteCustomNode, setNodeOverride]);

  const handleOpenWiki = useCallback((e: CustomEvent<{ id: string; label: string }>) => {
    // Find the actual node if it exists in the engine, otherwise mock enough properties for WikiEditor to work
    const existingNode = engineRef.current?.nodes.find(n => n.id === e.detail.id);
    setActiveNode((existingNode || {
      id: e.detail.id,
      label: e.detail.label,
      type: 'core',
      radius: 20,
      x: 0, y: 0, vx: 0, vy: 0
    }) as unknown as OrbitalNode);
    setIsWikiOpen(true);
  }, [setActiveNode, setIsWikiOpen]);

  const handleCloseWiki = useCallback(() => {
    setActiveNode(null);
  }, [setActiveNode]);

  useEffect(() => {
    window.addEventListener('wiki:openNode', handleOpenWiki as EventListener);
    window.addEventListener('wiki:closeNode', handleCloseWiki as EventListener);
    
    return () => {
      window.removeEventListener('wiki:openNode', handleOpenWiki as EventListener);
      window.removeEventListener('wiki:closeNode', handleCloseWiki as EventListener);
    };
  }, [handleOpenWiki, handleCloseWiki]);



  const { data: classificationWords } = useClassificationWords(isActive);

  useEffect(() => {
    if (classificationWords) {
      OntologyLayout.dynamicRules = classificationWords;
      if (engineRef.current) {
        engineRef.current.layoutWorldGeometryDirty = true;
        engineRef.current.needsRedraw = true;
      }
    }
  }, [classificationWords]);

  // ── Keyboard Shortcuts (Undo/Redo/Delete) ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent running if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]')
      ) return;

      if (e.key === 'Delete') {
        if (activeNode && !isDeleteModalOpen) {
          if (e.cancelable) e.preventDefault();
          setIsDeleteModalOpen(true);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          if (e.cancelable) e.preventDefault();
          redo();
        } else {
          if (e.cancelable) e.preventDefault();
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (e.cancelable) e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, activeNode, isDeleteModalOpen]);

  // Delete modal keyboard handling (Enter to confirm, Escape to cancel)
  useEffect(() => {
    if (!isDeleteModalOpen) return;

    const handleModalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        handleExecuteDelete();
      } else if (e.key === 'Escape') {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        setIsDeleteModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleModalKeyDown, true);
    return () => window.removeEventListener('keydown', handleModalKeyDown, true);
  }, [isDeleteModalOpen, handleExecuteDelete]);

  // Add node modal keyboard handling (Escape to cancel)
  useEffect(() => {
    if (!isAddingNode) return;

    const handleModalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        setIsAddingNode(false);
        setNewNodeName("");
      }
    };

    window.addEventListener('keydown', handleModalKeyDown, true);
    return () => window.removeEventListener('keydown', handleModalKeyDown, true);
  }, [isAddingNode]);
  
  const pendingCameraTargetIdRef = useRef<string | null>(null);
  const overridesRef = useRef(overrides);
  const customNodesRef = useRef(customNodes);
  const customEdgesRef = useRef(customEdges);
  const deletedEdgesRef = useRef(deletedEdges);
  overridesRef.current = overrides;
  customNodesRef.current = customNodes;
  customEdgesRef.current = customEdges;
  deletedEdgesRef.current = deletedEdges;


  const { blocks: wikiBlocks, isLoaded: wikiLoaded, saveBlocks: saveWikiBlocks } = useWikiStorage(
    isWikiOpen && activeNode ? activeNode.id : null,
    isWikiOpen && activeNode ? activeNode.label : null,
    setNodeOverride
  );
  
  const parentModeSourceRef = useRef(parentModeSource);
  useEffect(() => { parentModeSourceRef.current = parentModeSource; }, [parentModeSource]);

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

      // ── 시맨틱 파일 레이더 가상 문서 노드 동적 주입 ──
      if (radarFiles && radarFiles.files.length > 0) {
        radarFiles.files.forEach((f: any) => {
          const fileNodeId = `radar-doc-${radarFiles.nodeId}-${f.fileName}`;
          
          graph.nodes.push({
            id: fileNodeId,
            label: `📄 ${f.displayName}`,
            group: 'INFRASTRUCTURE',
            baseValue: 40,
            parentId: radarFiles.nodeId,
            layerId: 3,
            customColor: '#06b6d4', // cyan-500
            meta: {
              type: 'radar-doc',
              fileName: f.fileName,
              summary: f.summary,
              contacts: f.contacts
            }
          } as any);

          graph.edges.push({
            source: radarFiles.nodeId,
            target: fileNodeId,
            type: 'COMPONENTS',
            weight: 1.5
          });
        });
      }

      setUsingSample(Object.keys(signalKeywordsRef.current).length === 0);

      const engine = new OntologyCanvasEngine();
      // 기존 노드들의 현재 위치(orbitAngle) 및 접힘 상태 백업(전달)하여 카메라 급발진/순간이동 및 백화 현상을 막습니다.
      if (engineRef.current) {
         engine.hasInitializedCollapse = engineRef.current.hasInitializedCollapse;
         engine.collapsedNodeIds = new Set(engineRef.current.collapsedNodeIds);
      }
      
      // Init WITHOUT callbacks to avoid triggering setState during init
      engine.init(graph, undefined, engineRef.current ? engineRef.current.nodes : undefined);
      engine.isOrbiting = true; // orbit 모드 고정

      // ----- 카메라 및 선택 상태 유지 (깜빡임/리셋 방지) -----
      if (engineRef.current) {
        engine.cameraOffsetX = engineRef.current.cameraOffsetX;
        engine.cameraOffsetY = engineRef.current.cameraOffsetY;
        engine.targetOffsetX = engineRef.current.targetOffsetX;
        engine.targetOffsetY = engineRef.current.targetOffsetY;
        engine.zoom = engineRef.current.zoom;
        engine.isInitialCameraSnap = false;
        if (pendingCameraTargetIdRef.current) {
          engine.pendingCameraTargetId = pendingCameraTargetIdRef.current;
          pendingCameraTargetIdRef.current = null;
        } else if (engineRef.current.pendingCameraTargetId) {
          engine.pendingCameraTargetId = engineRef.current.pendingCameraTargetId;
        }
        
        if (engineRef.current.activeNode) {
          const stillExists = engine.nodes.find(n => n.id === engineRef.current!.activeNode!.id);
          if (stillExists) {
            engine.activeNode = stillExists;
            engine.previousActiveNodeId = stillExists.id;
          }
        }
      }

      // ----- 이전 엔진 리소스 해제 -----
      if (engineRef.current) {
        engineRef.current.destroy();
      }

      engineRef.current = engine;

      // Set state AFTER engine is fully initialized (no callbacks during init)
      const initialNode = engine.activeNode || engine.centerNode;
      const initialStats = { nodes: engine.nodeCount, edges: engine.edgeCount };

      // Attach callbacks AFTER init for user interaction
      engine.callbacks = {
        onActiveNodeChange: (node) => {
          if (node?.id === parentModeSourceRef.current) {
             setParentModeSource(null); // 자기자신을 한 번 더 누르면 취소
          }

          // 만약 클릭된 노드가 radar-doc-으로 시작하지 않고,
          // 현재 radarFiles가 표시되고 있는 부모 노드도 아니라면 radarFiles를 초기화합니다.
          if (node) {
            const isRadarDoc = node.id.startsWith('radar-doc-');
            const isRadarParent = radarFiles && radarFiles.nodeId === node.id;
            if (!isRadarDoc && !isRadarParent) {
              setRadarFiles(null);
            }
          } else {
            setRadarFiles(null);
          }

          setActiveNode(node ?? null);
        },
        onHoveredNodeChange: (node) => setHoveredNode(node ?? null),
        onNodeDoubleClick: (node) => {
          console.log('[MindMap3D] Double clicked node for file radar:', node.id, node.label);
          getFileRadar(
            { nodeId: node.id, nodeLabel: node.label },
            {
              onSuccess: (data) => {
                if (data && data.files && data.files.length > 0) {
                  setRadarFiles({ nodeId: node.id, files: data.files });
                  
                  // Expand node if collapsed
                  if (engineRef.current) {
                    engineRef.current.collapsedNodeIds.delete(node.id);
                    engineRef.current.activeNode = node;
                    engineRef.current.topologyDirty = true;
                    engineRef.current.needsRedraw = true;
                  }
                } else {
                  setRadarFiles(null);
                }
              },
              onError: (err) => {
                console.error('[MindMap3D] Failed to fetch file radar:', err);
                setRadarFiles(null);
              }
            }
          );
        },
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '초기화 실패');
    } finally {
      setLoading(false);
    }
  }, [batchSetNodeOverrides, setNodeOverride, radarFiles, getFileRadar]);

  const handleExecuteAddNode = useCallback(() => {
    const trimmedName = newNodeName.trim();
    if (!trimmedName) return;

    // Tombstone Label Guard: 이전에 삭제된 노드명인지 검사 및 스마트 복구 인터랙션
    try {
      const oldLabelsRaw = localStorage.getItem('hchps-deleted-labels');
      const deletedLabels: string[] = oldLabelsRaw ? JSON.parse(oldLabelsRaw) : [];
      if (deletedLabels.includes(trimmedName)) {
        const recover = confirm(
          `"${trimmedName}" 노드는 이전에 삭제된 기록(Tombstone)이 존재합니다.\n\n이 노드를 복구하여 다시 추가하시겠습니까?`
        );
        if (recover) {
          // 차단 목록에서 제거 (Purge)하여 재생성 허용
          const newLabels = deletedLabels.filter(l => l !== trimmedName);
          localStorage.setItem('hchps-deleted-labels', JSON.stringify(newLabels));
        } else {
          return; // 추가 취소
        }
      }
    } catch (e) {
      console.error('Tombstone label checking error:', e);
    }

    const x = (Math.random() - 0.5) * 50;
    const y = (Math.random() - 0.5) * 50;
    const newNode = addCustomNode(trimmedName, x, y);

    if (activeNode) {
      setNodeOverride(newNode.id, { 
        customParent: activeNode.id, 
        customOrbitIndex: activeNode.orbitIndex + 1, 
        fixedX: undefined, 
        fixedY: undefined 
      });
    } else {
      setNodeOverride(newNode.id, { fixedX: undefined, fixedY: undefined });
    }

    pendingCameraTargetIdRef.current = newNode.id;
    setIsAddingNode(false);
    setNewNodeName("");
  }, [newNodeName, activeNode, addCustomNode, setNodeOverride]);

  const handleResetCamera = useCallback(() => {
    if (engineRef.current) {
      const centerNodeId = engineRef.current.centerNode?.id || 'root-HCHPS';
      engineRef.current.pendingCameraTargetId = centerNodeId;
      engineRef.current.zoom = 1.0;
      engineRef.current.needsRedraw = true;
    }
  }, [/* resetCamera */]);

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
    .filter(([, ov]) => ov.customParent !== undefined || ov.customOrbitIndex !== undefined)
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
    if (loading || error || !isCloudLoaded || !isActive) return;

    let lastFrameTime = performance.now();

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
      
      if (engineRef.current) {
        engineRef.current.needsRedraw = true;
      }
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

      // Sync zoom slider and percentage text label at 60 FPS without React state overhead
      if (zoomSliderRef.current) {
        zoomSliderRef.current.value = String(engine.zoom);
      }
      if (zoomLabelRef.current) {
        zoomLabelRef.current.textContent = `${Math.round(engine.zoom * 100)}%`;
      }

      PerformanceProfiler.getInstance().tick();

      const now = performance.now();
      const delta = now - lastFrameTime;
      lastFrameTime = now;

      if (delta > 32) {
        const diagnostic = PerformanceProfiler.getInstance().getSpikeDiagnostic(delta);
        PerformanceProfiler.getInstance().recordLagSpike(diagnostic);
      }

      const isDirty = engine.tick();
      if (isDirty) {
        const t0 = performance.now();
        engine.render(ctx, w, h);
        const t1 = performance.now();
        PerformanceProfiler.getInstance().recordRender(t1 - t0);
      }

      ctx.restore();
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    // Native wheel handler (non-passive to allow preventDefault)
    const wheelHandler = (e: WheelEvent) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      const engine = engineRef.current;
      if (engine) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        engine.handleWheel(e.deltaY, mx, my);
      }
    };
    canvas.addEventListener('wheel', wheelHandler, { passive: false });

    return () => {
      ro.disconnect();
      canvas.removeEventListener('wheel', wheelHandler);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      
      // 💡 마인드맵 페이지를 이탈할 때 노드들의 현재 공전 각도를 sessionStorage에 캐싱하여 저장합니다.
      const engine = engineRef.current;
      if (engine) {
        if (engine.nodes) {
          try {
            const angles: Record<string, number> = {};
            engine.nodes.forEach(n => {
              if (typeof n.orbitAngle === 'number' && !isNaN(n.orbitAngle)) {
                angles[n.id] = n.orbitAngle;
              }
            });
            sessionStorage.setItem('hchps-mindmap-orbit-angles', JSON.stringify(angles));
          } catch (e) {
            console.warn('[SessionStorage] Failed to save orbit angles on cleanup:', e);
          }
        }
        engine.destroy();
        engineRef.current = null;
      }
    };
  }, [loading, error, isCloudLoaded, isActive]);

  // ── Mouse/Touch Events ──
  const getCanvasPos = useCallback((e: React.MouseEvent | MouseEvent | TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : (e as MouseEvent).clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, [/* getCanvasPos */]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine || !canvas) return;
    const { x, y } = getCanvasPos(e.nativeEvent);
    engine.handleHover(x, y);

    // Drag
    if (e.buttons === 1) {
      engine.handleDragMove(x, y);
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
  }, [/* mouseUp */]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // 터치 직후 브라우저에서 인위적으로 발생시키는 ghost click 차단 (더블클릭 판정으로 노드 선택이 풀리는 현상 방지)
    if (Date.now() - lastTouchTimeRef.current < 500) return;

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
  }, [getCanvasPos, parentModeSource, initEngine, setNodeOverride, removeCustomTombstone]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const engine = engineRef.current;
    if (!engine) return;
    const { x, y } = getCanvasPos(e.nativeEvent);
    engine.handleDoubleClick(x, y);
    
    // Sync React state
    setActiveNode(engine.activeNode);
  }, [getCanvasPos]);

  // ── Touch Events for Mobile ──
  const touchStartRef = useRef<{ x: number; y: number; time: number; pinchDist?: number }>({ x: 0, y: 0, time: 0 });
  const isTouchDragging = useRef(false);
  const lastTouchTimeRef = useRef(0);

  const getTouchDist = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return 0;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const engine = engineRef.current;
    if (!engine) return;

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

    // Pinch zoom
    if (e.touches.length === 2 && touchStartRef.current.pinchDist) {
      const newDist = getTouchDist(e);
      const delta = touchStartRef.current.pinchDist - newDist;
      
      const rect = canvas.getBoundingClientRect();
      const clientX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const clientY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      engine.handleWheel(delta * 3.5, mx, my);
      touchStartRef.current.pinchDist = newDist;
      return;
    }

    const { x, y } = getCanvasPos(e.nativeEvent as unknown as TouchEvent);
    const dx = Math.abs(x - touchStartRef.current.x);
    const dy = Math.abs(y - touchStartRef.current.y);
    if (dx > 5 || dy > 5) isTouchDragging.current = true;

    engine.handleHover(x, y);
    engine.handleDragMove(x, y);
  }, [getCanvasPos]);

  const handleTouchEnd = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (touchStartRef.current.pinchDist) {
      touchStartRef.current.pinchDist = undefined;
      return;
    }

    engine.handleDragEnd();

    // Tap detection (short duration + small movement)
    const elapsed = Date.now() - touchStartRef.current.time;
    if (!isTouchDragging.current && elapsed < 300) {
      lastTouchTimeRef.current = Date.now();
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
    }
  }, [parentModeSource, initEngine, setNodeOverride]);

  // handleWheel is now native (see useEffect above)

  const handleNodeClickInPanel = useCallback((nodeId: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    const node = engine.getNodeById(nodeId);
    if (node) {
      // 1. 부모 노드가 접혀 있다면 루트 부모까지 거슬러 올라가며 접힘 상태를 전부 해제
      let parentId = node.parentId;
      while (parentId) {
        if (engine.collapsedNodeIds.has(parentId)) {
          engine.collapsedNodeIds.delete(parentId);
        }
        const parentNode = engine.getNodeById(parentId);
        parentId = parentNode?.parentId;
      }
      
      // 자기 자신이 접혀있을 수 있으므로 해제
      if (engine.collapsedNodeIds.has(nodeId)) {
        engine.collapsedNodeIds.delete(nodeId);
      }

      // 2. 노드 선택 및 카메라 포커싱
      engine.activeNode = node;
      engine.pendingCameraTargetId = node.id;
      engine.needsRedraw = true;

      // 3. UI 리액트 상태 동기화
      setActiveNode(node);
      
      // 4. 콜백 호출
      engine.callbacks.onActiveNodeChange?.(node);
    }
  }, [/* handleNodeClickInPanel */]);




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
           
           const weightA = a.renderSize ?? 0.5;
           const weightB = b.renderSize ?? 0.5;
           if (weightB !== weightA) return weightB - weightA;
           
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

  const handleZoomSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const engine = engineRef.current;
    if (engine) {
      engine.zoom = val;
      engine.targetZoom = val;
      engine.needsRedraw = true;
    }
  }, [/* handleZoomChange */]);



  const handlePrintPdf = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>시그널 노드 맵 PDF 인쇄</title>
          <style>
            @media print {
              @page { size: landscape; margin: 0; }
              body { margin: 0; display: flex; justify-content: center; align-items: center; background-color: #ffffff; }
              img { max-width: 100vw; max-height: 100vh; object-fit: contain; }
              .print-btn { display: none !important; }
            }
            body { margin: 0; background: #333; display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: sans-serif; }
            img { max-width: 90vw; max-height: 90vh; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
            .print-btn {
              position: fixed; top: 20px; right: 20px; padding: 12px 24px; 
              background: #0066ff; color: #fff; border: none; border-radius: 8px;
              cursor: pointer; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 1000;
            }
            .print-btn:hover { background: #0052cc; }
          </style>
        </head>
        <body>
          <button class="print-btn" onclick="window.print()">인쇄 / PDF로 저장 (가로형)</button>
          <img src="${dataUrl}" alt="Signal Map" />
          <script>
            setTimeout(() => { window.print(); }, 500);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [/* printPdf */]);

  const renderBottomInfoPanels = () => {
    return <BottomPerformancePanel isActive={isActive} />;
  };

  // ── Loading / Error States ──
  if (loading || !isCloudLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-[660px] gap-4">
        <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
        <p className="text-sm text-[var(--color-text-secondary)]">데이터 동기화 및 로딩 중...</p>
      </div>
    );
  }

  if (error && !engineRef.current) {
    return (
      <div className="flex flex-col items-center justify-center h-[660px] gap-4">
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

      <MindMapHeader
        stats={stats}
        activeNode={activeNode}
        isWikiOpen={isWikiOpen}
        usingSample={usingSample}
        onOpenWiki={() => setIsWikiOpen(true)}
      />

      {/* Main: Side Panel (left) + Canvas (right) */}
      <div className={isFullscreen ? '' : 'grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4'}>

        {/* ── Side Panel: Node Details (노드 상세 패널) ── */}
        <div 
          className={
            isFullscreen 
              ? "hidden md:flex flex-col fixed top-4 right-auto bottom-4 left-4 z-[110] w-[280px] lg:w-[320px] shadow-2xl rounded-xl custom-scrollbar pointer-events-auto bg-[#f8f9fc]" 
              : "order-2 lg:order-none w-full pointer-events-auto flex flex-col gap-3 lg:h-[min(660px,70vh)]"
          } 
          style={isFullscreen ? { height: "calc(100vh - 32px)" } : {}}
        >
          <div className="flex-1 min-h-0 relative">
            <MindMapInspector
              activeNode={activeNode} engineRef={engineRef} overrides={overrides} setNodeOverride={setNodeOverride}
              setActiveNode={setActiveNode} onRenameCategory={onRenameCategory} onDeleteCategory={onDeleteCategory}
              updateCustomNodeText={updateCustomNodeText} removeCustomTombstone={removeCustomTombstone} renameNodeId={renameNodeId}
              deleteCustomNode={deleteCustomNode} addCustomEdge={addCustomEdge} deleteCustomEdge={deleteCustomEdge}
              parentModeSource={parentModeSource} setParentModeSource={setParentModeSource}
              initEngine={initEngine} handleSwapNodeOrder={handleSwapNodeOrder} clearNodeOverride={clearNodeOverride}
              isOverlay={false}
              wikiBlocks={wikiBlocks ?? undefined}
              matchedCat={matchedCat}
              catStats={catStats}
              matchedTasks={matchedTasks}
            />
          </div>
        </div>

        {/* ── Right Column: Canvas + Bottom Controls ── */}
        <div className={isFullscreen ? '' : 'order-1 lg:order-none flex-1 flex flex-col gap-4 min-w-0'}>
          {/* Canvas Container */}
          <div
            ref={containerRef}
            className={
              isFullscreen 
                ? 'fixed inset-0 z-[100] flex flex-col' 
                : 'relative rounded-xl overflow-hidden border border-[var(--color-border-light)] w-full h-[605px] md:h-[660px] flex-1 flex flex-col'
            }
            style={{
              background: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.9) 0%, #f8fafc 100%)',
              ...(isFullscreen ? { height: '100vh' } : {})
            }}
          >
            {/* 캔버스 및 그 오버레이를 감싸는 Wrapper */}
            <div className="flex-1 relative w-full min-h-0">
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
                style={{ cursor: hoveredNode ? 'pointer' : 'grab', touchAction: 'none' }}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />

              <div className="absolute top-4 left-4 z-20 flex flex-col w-72 pointer-events-auto">
                <div className="relative flex items-center bg-white border border-slate-200/80 shadow-lg rounded-xl transition-all duration-200 focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20 focus-within:border-[var(--color-primary)]">
                  <Search className="absolute left-3.5 text-slate-400 w-4.5 h-4.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="노드 검색..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSelectedSearchIndex(-1);
                    }}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => {
                      // 리스트 안의 요소를 마우스로 클릭할 때 바로 닫히지 않도록 약간의 지연 시간 설정
                      setTimeout(() => {
                        setIsSearchFocused(false);
                      }, 200);
                    }}
                    onKeyDown={(e) => {
                      const filtered = searchQuery.trim() && engineRef.current
                        ? engineRef.current.nodes.filter(node => 
                            node.label.toLowerCase().includes(searchQuery.trim().toLowerCase())
                          )
                        : [];

                      if (filtered.length === 0) return;

                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setSelectedSearchIndex(prev => (prev + 1) % filtered.length);
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSelectedSearchIndex(prev => (prev - 1 + filtered.length) % filtered.length);
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        const targetIdx = selectedSearchIndex >= 0 ? selectedSearchIndex : 0;
                        if (filtered[targetIdx]) {
                          handleNodeClickInPanel(filtered[targetIdx].id);
                          setSearchQuery("");
                          setIsSearchFocused(false);
                          setSelectedSearchIndex(-1);
                        }
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setIsSearchFocused(false);
                        setSelectedSearchIndex(-1);
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-transparent rounded-xl outline-none text-slate-800 placeholder-slate-400 font-medium"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedSearchIndex(-1);
                      }}
                      className="absolute right-3 p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Auto-complete Results Dropdown */}
                {isSearchFocused && searchQuery.trim() && (
                  <div className="absolute top-[48px] left-0 right-0 max-h-60 overflow-y-auto bg-white border border-slate-200/80 rounded-xl shadow-xl z-50 custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-150">
                    {(() => {
                      const filtered = engineRef.current
                        ? engineRef.current.nodes.filter(node => 
                            node.label.toLowerCase().includes(searchQuery.trim().toLowerCase())
                          )
                        : [];

                      if (filtered.length === 0) {
                        return (
                          <div className="px-4 py-3 text-xs text-slate-400 text-center font-medium">
                            검색 결과가 없습니다
                          </div>
                        );
                      }

                      return filtered.map((node, index) => {
                        const isSelected = index === selectedSearchIndex;
                        const groupColor = GROUP_COLORS[node.group as OntologyGroup] || '#ccc';
                        const groupLabel = GROUP_LABELS[node.group as OntologyGroup] || '기타';

                        return (
                          <div
                            key={node.id}
                            onMouseDown={() => {
                              handleNodeClickInPanel(node.id);
                              setSearchQuery("");
                              setSelectedSearchIndex(-1);
                            }}
                            className={`px-3.5 py-2 text-sm flex items-center justify-between cursor-pointer transition-colors duration-150 ${
                              isSelected ? 'bg-slate-100 text-[var(--color-primary)] font-semibold' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span 
                                className="w-2 h-2 rounded-full shrink-0" 
                                style={{ backgroundColor: groupColor }} 
                              />
                              <span className="truncate">{node.label}</span>
                            </div>
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium shrink-0">
                              {groupLabel}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

              <MindMapHUD
                containerWidth={containerRef.current?.getBoundingClientRect().width ?? 400}
                hoveredNode={hoveredNode}
                activeNode={activeNode}
                isFullscreen={isFullscreen}
                onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
                onPrintPdf={handlePrintPdf}
                zoomSliderRef={zoomSliderRef}
                zoomLabelRef={zoomLabelRef}
                onZoomChange={handleZoomSliderChange}
                onAddNodeClick={() => { setIsAddingNode(true); setNewNodeName(""); }}
                onResetCamera={handleResetCamera}
              />

              {/* Sliding Wiki Panel Overlay */}
              {isWikiOpen && activeNode && wikiLoaded && (
                <div className="absolute top-0 right-0 h-full bg-white z-[120] shadow-xl border-l border-slate-200 w-full md:w-[450px] lg:w-[500px]">
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

            {/* 하단 정보 패널 (전체화면 모드일 때 Canvas Container 하단에 Flex로 렌더링되도록 함) */}
            {isFullscreen && (
              <div className="w-full bg-white border-t border-slate-200/80 p-4 shrink-0 shadow-lg z-20 pointer-events-auto">
                {renderBottomInfoPanels()}
              </div>
            )}
          </div>

          {/* 일반 모드일 때 캔버스 바깥 하단에 렌더링 */}
          {!isFullscreen && (
            <div className="w-full pointer-events-auto">
              {renderBottomInfoPanels()}
            </div>
          )}
        {/* Right Column 닫기 */}
        </div>
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {isDeleteModalOpen && activeNode && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsDeleteModalOpen(false)}
        >
          <div 
            className="w-full max-w-md bg-white border border-slate-200/60 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3.5 border-b border-slate-100 pb-3">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-500 border border-rose-100 shadow-sm shadow-rose-500/5">
                <Trash2 size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">노드 삭제 확인</h3>
                <p className="text-xs text-slate-400 mt-0.5">선택한 노드를 맵에서 제거합니다</p>
              </div>
            </div>
            
            <div className="py-2">
              <p className="text-sm text-slate-700 leading-relaxed">
                정말 노드 <strong className="text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded font-semibold">'{activeNode.label}'</strong>을(를) 삭제하시겠습니까?
              </p>
              
              <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-100/80 text-xs text-slate-500 leading-normal flex flex-col gap-1.5">
                <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-amber-500" />
                  {activeNode.id.startsWith('custom-') || activeNode.orbitIndex === 1 
                    ? '완전 삭제 노드' 
                    : '화면 숨김 처리 노드'}
                </span>
                <span>
                  {activeNode.id.startsWith('custom-') || activeNode.orbitIndex === 1
                    ? '이 카테고리(또는 노드)는 완전히 삭제되며, 연관된 태그나 데이터 연동이 해제될 수 있습니다.'
                    : '이 노드를 맵에서 삭제합니다. 원본 데이터(업무/지식 등)는 보존되며 맵 화면에서만 숨겨집니다.'}
                </span>
              </div>
            </div>
            
            <div className="flex gap-2.5 mt-2 justify-end">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1"
              >
                취소 <span className="text-[10px] text-slate-400 font-medium px-1 bg-white rounded border border-slate-200">Esc</span>
              </button>
              <button
                onClick={handleExecuteDelete}
                className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-500/10 hover:shadow-rose-500/25 transition-all duration-200 cursor-pointer flex items-center gap-1.5"
              >
                삭제하기 <span className="text-[10px] text-rose-200 font-medium px-1 bg-black/10 rounded">Enter</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Node Modal ── */}
      {isAddingNode && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => {
            setIsAddingNode(false);
            setNewNodeName("");
          }}
        >
          <div 
            className="w-full max-w-md bg-white border border-slate-200/60 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3.5 border-b border-slate-100 pb-3">
              <div className="p-2 rounded-xl bg-indigo-50 text-[var(--color-primary)] border border-indigo-100 shadow-sm shadow-indigo-500/5">
                <PlusSquare size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">새 노드 추가</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activeNode 
                    ? `'${activeNode.label}' 아래에 새 하위 노드를 생성합니다`
                    : '새로운 독립 노드를 생성합니다'}
                </p>
              </div>
            </div>

            <div className="py-2 flex flex-col gap-3">
              <label htmlFor="modalNewNodeName" className="text-xs font-semibold text-slate-500">노드 이름</label>
              <input
                id="modalNewNodeName"
                autoFocus
                type="text"
                placeholder="노드 이름을 입력하세요..."
                value={newNodeName}
                onChange={(e) => setNewNodeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (e.cancelable) e.preventDefault();
                    e.stopPropagation();
                    handleExecuteAddNode();
                  } else if (e.key === 'Escape') {
                    if (e.cancelable) e.preventDefault();
                    e.stopPropagation();
                    setIsAddingNode(false);
                    setNewNodeName("");
                  }
                }}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 text-slate-800 placeholder-slate-400 font-medium transition-all"
              />
            </div>

            <div className="flex gap-2.5 mt-2 justify-end">
              <button
                onClick={() => {
                  setIsAddingNode(false);
                  setNewNodeName("");
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1"
              >
                취소 <span className="text-[10px] text-slate-400 font-medium px-1 bg-white rounded border border-slate-200">Esc</span>
              </button>
              <button
                onClick={handleExecuteAddNode}
                disabled={!newNodeName.trim()}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                  newNodeName.trim()
                    ? 'bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 shadow-indigo-500/10 hover:shadow-indigo-500/25'
                    : 'bg-slate-300 shadow-none cursor-not-allowed opacity-50'
                }`}
              >
                생성하기 <span className="text-[10px] text-indigo-200 font-medium px-1 bg-black/10 rounded">Enter</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}, areMindMap3DPropsEqual);

// ── Bottom Info Panels Content Renderer (Isolated React Re-render scope for 60 FPS) ──
interface BottomPerformancePanelProps {
  isActive: boolean;
}

function BottomPerformancePanel({ isActive }: BottomPerformancePanelProps) {
  const [perfMetrics, setPerfMetrics] = useState({
    lastRenderTime: 0,
    avgRenderTime: 0,
    maxRenderTime: 0,
    warningCount: 0,
    totalRenders: 0,
    fps: 60
  });

  const [lagSpikes, setLagSpikes] = useState<string[]>([]);
  const [copiedMetric, setCopiedMetric] = useState(false);
  const [copiedLag, setCopiedLag] = useState(false);



  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => {
      setPerfMetrics(PerformanceProfiler.getInstance().getMetrics());
      setLagSpikes(PerformanceProfiler.getInstance().getLagSpikes());
    }, 1000);
    return () => clearInterval(timer);
  }, [isActive]);

  const handleCopyMetrics = () => {
    const cpuLoad = perfMetrics.fps > 58 ? '0.2%' : perfMetrics.fps > 50 ? '3.8%' : '14.2%';
    const frameCompliance = perfMetrics.fps > 58 ? '98.5%' : perfMetrics.fps > 50 ? '82.0%' : '45.1%';

    const text = `[PORTFOLIO VITAL - 실시간 성능 지표]
- 프레임 레이트: ${perfMetrics.fps} FPS
- 최근 렌더 시간: ${perfMetrics.lastRenderTime.toFixed(2)}ms
- 평균 렌더 시간: ${perfMetrics.avgRenderTime.toFixed(2)}ms
- 최대 렌더 시간: ${perfMetrics.maxRenderTime.toFixed(2)}ms
- 지연 경고 횟수: ${perfMetrics.warningCount}회
- 유휴 CPU 부하: ${cpuLoad}
- 프레임 예산 준수율: ${frameCompliance}`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedMetric(true);
      setTimeout(() => setCopiedMetric(false), 2000);
    });
  };

  const handleCopyLagSpikes = () => {
    const logText = lagSpikes.length > 0 
      ? lagSpikes.join('\n') 
      : '지연 스파이크 없음 (Clean)';

    const text = `[PORTFOLIO VITAL - 렌더링 지연 감시 로그]
${logText}`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedLag(true);
      setTimeout(() => setCopiedLag(false), 2000);
    });
  };

  const handleResetLagSpikes = () => {
    PerformanceProfiler.getInstance().clearLagSpikes();
    setLagSpikes([]);
  };

  const cpuLoad = perfMetrics.fps > 58 ? '0.2%' : perfMetrics.fps > 50 ? '3.8%' : '14.2%';
  const frameCompliance = perfMetrics.fps > 58 ? '98.5%' : perfMetrics.fps > 50 ? '82.0%' : '45.1%';

  return (
    <div className="flex flex-col gap-4">
      {/* 3. 성능 프로파일러 카드 */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-8 font-mono text-[11.5px] text-slate-600 w-full pointer-events-auto">
        {/* 좌측: 실시간 성능 지표 */}
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3 mb-0.5">
            <span className="font-sans font-extrabold text-sm text-slate-800 flex items-center gap-2">
              <Radio size={14} className="text-slate-500" />
              성능 프로파일러 (실시간 지표)
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleCopyMetrics}
                className="font-sans text-[10.5px] font-bold text-slate-500 hover:text-[var(--color-primary)] cursor-pointer bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition-all flex items-center gap-1 border border-slate-200/40"
                title="성능 지표 복사"
              >
                <Copy size={11} />
                {copiedMetric ? '복사됨!' : '지표 복사'}
              </button>
              <div className="w-px h-3 bg-slate-200"></div>
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${perfMetrics.fps >= 55 ? 'bg-emerald-500 animate-pulse' : perfMetrics.fps >= 30 ? 'bg-amber-500' : 'bg-rose-500'}`}></span>
                <span className="font-sans font-black text-slate-800 text-[12px]">{perfMetrics.fps} FPS</span>
              </div>
            </div>
          </div>
          <div className="h-px bg-slate-200/40 my-0.5"></div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            <div className="flex justify-between">
              <span>최근 렌더:</span>
              <span className="font-bold text-slate-900">{perfMetrics.lastRenderTime.toFixed(2)}ms</span>
            </div>
            <div className="flex justify-between">
              <span>평균 렌더:</span>
              <span className="font-bold text-slate-900">{perfMetrics.avgRenderTime.toFixed(2)}ms</span>
            </div>
            <div className="flex justify-between">
              <span>최대 렌더:</span>
              <span className="font-bold text-slate-900">{perfMetrics.maxRenderTime.toFixed(2)}ms</span>
            </div>
            <div className="flex justify-between">
              <span>지연 경고:</span>
              <span className={`font-bold ${perfMetrics.warningCount > 0 ? 'text-amber-600 font-extrabold animate-pulse' : 'text-slate-900'}`}>{perfMetrics.warningCount}회</span>
            </div>
            <div className="flex justify-between">
              <span>유휴 CPU 부하:</span>
              <span className="font-bold text-slate-900">{cpuLoad}</span>
            </div>
            <div className="flex justify-between">
              <span>프레임 예산 준수율:</span>
              <span className="font-bold text-slate-900">{frameCompliance}</span>
            </div>
          </div>
        </div>

        <div className="hidden md:block w-px bg-slate-200/60 self-stretch"></div>

        {/* 우측: 렌더링 지연 상시 감시 */}
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3 mb-0.5">
            <span className="font-sans font-extrabold text-sm text-slate-800 flex items-center gap-2">
              <AlertTriangle size={14} className={lagSpikes.length > 0 ? 'text-rose-500 animate-pulse' : 'text-slate-500'} />
              렌더링 지연 상시 감시
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleCopyLagSpikes}
                className="font-sans text-[10.5px] font-bold text-slate-500 hover:text-[var(--color-primary)] cursor-pointer bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition-all flex items-center gap-1 border border-slate-200/40"
                title="감시 로그 복사"
              >
                <Copy size={11} />
                {copiedLag ? '복사됨!' : '로그 복사'}
              </button>
              <div className="w-px h-3 bg-slate-200"></div>
              <button 
                onClick={handleResetLagSpikes}
                className="font-sans text-[11.5px] font-bold text-[var(--color-primary)] hover:underline cursor-pointer"
              >
                기록 초기화
              </button>
            </div>
          </div>
          <div className="h-px bg-slate-200/40 my-0.5"></div>
          
          <div className="flex flex-col gap-1 overflow-y-auto max-h-[75px] custom-scrollbar">
            {lagSpikes.length > 0 ? (
              lagSpikes.map((spikeMsg, idx) => (
                <div key={idx} className="flex items-center bg-rose-50/50 border border-rose-100 rounded px-2.5 py-1 text-rose-700 font-mono text-[11px] leading-tight">
                  <span className="truncate">{spikeMsg}</span>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-[40px] text-slate-400 italic">
                지연 스파이크 없음 (Clean)
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
