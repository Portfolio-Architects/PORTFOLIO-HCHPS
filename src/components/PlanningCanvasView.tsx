'use client';

/**
 * PlanningCanvasView
 * 사업 기획 전용 온톨로지 캔버스. 
 * 시그널 탭의 MindMap3D와 동일한 OntologyCanvasEngine을 재사용하되,
 * usePlanningGraph 훅(별도 Yjs 네임스페이스)으로 데이터를 분리합니다.
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { OntologyCanvasEngine } from '@/lib/OntologyCanvasEngine';
import { OntologyLayout } from '@/lib/engine/OntologyLayout';
import {
  OrbitalNode, OntologyEdge, OntologyNode,
  GROUP_COLORS, GROUP_LABELS, OntologyGroup,
  EDGE_TYPE_LABELS, EdgeType,
} from '@/lib/ontology.types';
import { usePlanningGraph } from '@/hooks/usePlanningGraph';
import { Plus, Trash2, Undo2, Redo2, Cloud, CloudDownload, RotateCcw, Link2 } from 'lucide-react';

// ============ Build Graph from Custom Nodes Only ============

function buildPlanningGraph(
  customNodes: OntologyNode[],
  customEdges: OntologyEdge[],
  overrides: Record<string, any>,
  deletedEdges?: string[],
): { nodes: OntologyNode[]; edges: OntologyEdge[] } {
  const deletedSet = new Set(deletedEdges || []);

  // Apply overrides to custom nodes
  const nodes: OntologyNode[] = customNodes.map(n => {
    const ov = overrides[n.id];
    if (!ov) return n;
    return {
      ...n,
      customColor: ov.customColor ?? n.customColor,
      customLabel: ov.customLabel ?? n.customLabel,
      customGroup: ov.customGroup ?? n.customGroup,
      customOrbitIndex: ov.customOrbitIndex ?? n.customOrbitIndex,
      customSortOrder: ov.customSortOrder ?? n.customSortOrder,
      parentId: ov.customParent ?? n.parentId,
      fixedX: ov.fixedX ?? n.fixedX,
      fixedY: ov.fixedY ?? n.fixedY,
      isHighlighted: ov.isHighlighted ?? n.isHighlighted,
      isCompleted: ov.isCompleted ?? n.isCompleted,
      group: (ov.customGroup || n.group) as OntologyGroup,
    };
  });

  // Compute centrality based on edge connections
  const connectionCount = new Map<string, number>();
  customEdges.forEach(e => {
    connectionCount.set(e.source, (connectionCount.get(e.source) || 0) + 1);
    connectionCount.set(e.target, (connectionCount.get(e.target) || 0) + 1);
  });
  const maxConn = Math.max(1, ...Array.from(connectionCount.values()));
  nodes.forEach(n => {
    n.centralityScore = (connectionCount.get(n.id) || 0) / maxConn;
    n.renderSize = 0.3 + (n.centralityScore * 0.7);
  });

  // If no nodes, add a seed node
  if (nodes.length === 0) {
    nodes.push({
      id: 'plan-seed',
      label: '사업 기획',
      group: 'CORE_PROJECT',
      baseValue: 100,
      centralityScore: 1.0,
      renderSize: 1.0,
    });
  }

  // Filter edges
  const edges = customEdges.filter(e => {
    const k1 = `${e.source}|||${e.target}`;
    const k2 = `${e.target}|||${e.source}`;
    return !deletedSet.has(k1) && !deletedSet.has(k2);
  });

  return { nodes, edges };
}

// ============ Component ============

export function PlanningCanvasView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<OntologyCanvasEngine | null>(null);
  const rafRef = useRef<number>(0);

  const graph = usePlanningGraph();
  const [activeNode, setActiveNode] = useState<OrbitalNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<OrbitalNode | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [newNodeLabel, setNewNodeLabel] = useState('');
  const [editingLabel, setEditingLabel] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [linkSource, setLinkSource] = useState<string | null>(null);

  // Build ontology graph from planning data
  const graphData = useMemo(() => {
    return buildPlanningGraph(
      graph.customNodes,
      graph.customEdges,
      graph.overrides,
      graph.deletedEdges
    );
  }, [graph.customNodes, graph.customEdges, graph.overrides, graph.deletedEdges]);

  // Initialize engine
  useEffect(() => {
    if (!canvasRef.current) return;
    if (!engineRef.current) {
      engineRef.current = new OntologyCanvasEngine();
    }
    const engine = engineRef.current;

    engine.init(graphData, {
      onActiveNodeChange: (node) => setActiveNode(node),
      onHoveredNodeChange: (node) => setHoveredNode(node),
    }, engine.nodes.length > 0 ? engine.nodes : undefined);

    engine.needsRedraw = true;
  }, [graphData]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const engine = engineRef.current;
    if (!engine) return;

    let running = true;

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      engine.needsRedraw = true;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const loop = () => {
      if (!running) return;
      const dirty = engine.tick();
      if (dirty) {
        const rect = canvas.getBoundingClientRect();
        engine.render(ctx, rect.width, rect.height);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Interaction handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const engine = engineRef.current;
    if (!engine) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    engine.handleDragStart(mx, my, e.shiftKey);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const engine = engineRef.current;
    if (!engine) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    engine.handleHover(mx, my);
    engine.handleDragMove(mx, my, rect.width, rect.height);
  }, []);

  const handleMouseUp = useCallback(() => {
    engineRef.current?.handleDragEnd();
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const engine = engineRef.current;
    if (!engine) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Link mode: click to select two nodes
    if (linkMode) {
      const hit = engine.hitTest(mx, my);
      if (hit) {
        if (!linkSource) {
          setLinkSource(hit.id);
        } else if (hit.id !== linkSource) {
          graph.addCustomEdge(linkSource, hit.id);
          setLinkSource(null);
          setLinkMode(false);
        }
      }
      return;
    }

    engine.handleClick(mx, my);
  }, [linkMode, linkSource, graph]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    engineRef.current?.handleWheel(e.deltaY);
  }, []);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const engine = engineRef.current;
    if (!engine) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const t = e.touches[0];
    engine.handleDragStart(t.clientX - rect.left, t.clientY - rect.top);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const engine = engineRef.current;
    if (!engine) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const t = e.touches[0];
    engine.handleDragMove(t.clientX - rect.left, t.clientY - rect.top, rect.width, rect.height);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (e.changedTouches.length > 0) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const t = e.changedTouches[0];
      engine.handleClick(t.clientX - rect.left, t.clientY - rect.top);
    }
    engine.handleDragEnd();
  }, []);

  // Add node
  const handleAddNode = () => {
    if (!newNodeLabel.trim()) return;
    graph.addCustomNode(newNodeLabel.trim(), 0, 0);
    setNewNodeLabel('');
    setAddMode(false);
  };

  // Delete active node
  const handleDeleteActive = () => {
    if (!activeNode) return;
    if (!confirm(`"${activeNode.label}" 노드를 삭제하시겠습니까?`)) return;
    graph.deleteCustomNode(activeNode.id);
    setActiveNode(null);
  };

  // Rename active node
  const handleRename = () => {
    if (!activeNode || !newNodeLabel.trim()) return;
    graph.updateCustomNodeText(activeNode.id, newNodeLabel.trim());
    setNewNodeLabel('');
    setEditingLabel(false);
  };

  // Change color
  const handleColorChange = (color: string) => {
    if (!activeNode) return;
    graph.setNodeOverride(activeNode.id, { customColor: color });
  };

  // Set parent
  const handleSetParent = () => {
    if (!activeNode || !hoveredNode || activeNode.id === hoveredNode.id) return;
    graph.setNodeOverride(activeNode.id, { customParent: hoveredNode.id });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] relative">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-slate-200">
        <h2 className="text-sm font-bold text-slate-700 mr-2">사업기획 캔버스</h2>

        {/* Add Node */}
        {addMode ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newNodeLabel}
              onChange={e => setNewNodeLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddNode()}
              className="px-2 py-1 text-xs border border-slate-300 rounded-md w-40 focus:outline-none focus:ring-1 focus:ring-blue-400"
              placeholder="아이디어 이름..."
              autoFocus
            />
            <button onClick={handleAddNode} className="px-2 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600">추가</button>
            <button onClick={() => { setAddMode(false); setNewNodeLabel(''); }} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200">취소</button>
          </div>
        ) : (
          <button onClick={() => setAddMode(true)} className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 border border-blue-200 font-medium">
            <Plus size={13} /> 노드 추가
          </button>
        )}

        {/* Link Mode */}
        <button
          onClick={() => { setLinkMode(!linkMode); setLinkSource(null); }}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border font-medium ${linkMode ? 'bg-green-100 text-green-700 border-green-300' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
        >
          <Link2 size={13} /> {linkMode ? (linkSource ? '대상 노드 클릭' : '출발 노드 클릭') : '연결'}
        </button>

        {/* Delete active */}
        {activeNode && activeNode.id !== 'plan-seed' && (
          <button onClick={handleDeleteActive} className="flex items-center gap-1 px-2 py-1 text-xs bg-red-50 text-red-500 rounded-md hover:bg-red-100 border border-red-200 font-medium">
            <Trash2 size={13} /> 삭제
          </button>
        )}

        <div className="flex-1" />

        {/* Undo/Redo */}
        <button onClick={graph.undo} className="p-1.5 rounded hover:bg-gray-100 text-gray-400" title="되돌리기"><Undo2 size={14} /></button>
        <button onClick={graph.redo} className="p-1.5 rounded hover:bg-gray-100 text-gray-400" title="다시실행"><Redo2 size={14} /></button>
        
        {/* Cloud */}
        <button onClick={() => graph.syncToCloud()} className="p-1.5 rounded hover:bg-gray-100 text-gray-400" title="클라우드 저장"><Cloud size={14} /></button>
        <button onClick={() => graph.fetchFromCloud()} className="p-1.5 rounded hover:bg-gray-100 text-gray-400" title="클라우드 불러오기"><CloudDownload size={14} /></button>
        <button onClick={graph.clearAll} className="p-1.5 rounded hover:bg-gray-100 text-red-300" title="전체 초기화"><RotateCcw size={14} /></button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="flex-1 w-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Active Node Inspector */}
      {activeNode && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-72 bg-white border border-slate-200 rounded-xl shadow-lg p-4 space-y-3 z-10">
          <div className="flex items-center justify-between">
            {editingLabel ? (
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="text"
                  value={newNodeLabel}
                  onChange={e => setNewNodeLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRename()}
                  className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                  autoFocus
                />
                <button onClick={handleRename} className="px-2 py-1 text-xs bg-blue-500 text-white rounded">확인</button>
                <button onClick={() => { setEditingLabel(false); setNewNodeLabel(''); }} className="px-2 py-1 text-xs bg-gray-100 rounded">취소</button>
              </div>
            ) : (
              <h3
                className="text-sm font-bold text-slate-800 cursor-pointer hover:text-blue-600 truncate"
                onClick={() => { setEditingLabel(true); setNewNodeLabel(activeNode.label); }}
                title="클릭하여 이름 변경"
              >
                {activeNode.customLabel || activeNode.label}
              </h3>
            )}
          </div>

          {/* Color Picker */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 font-medium mr-1">색상</span>
            {['#0055FF', '#00CC44', '#8800FF', '#FF6600', '#00BBDD', '#FF0044', '#888888'].map(c => (
              <button
                key={c}
                onClick={() => handleColorChange(c)}
                className="w-5 h-5 rounded-full border border-white shadow-sm hover:scale-125 transition-transform"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Group */}
          <div>
            <span className="text-[10px] text-gray-400 font-medium">그룹</span>
            <select
              value={(activeNode as any).customGroup || activeNode.group}
              onChange={e => graph.setNodeOverride(activeNode.id, { customGroup: e.target.value })}
              className="w-full mt-1 px-2 py-1 text-xs border border-gray-200 rounded-md"
            >
              {Object.entries(GROUP_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Stats */}
          <div className="text-[10px] text-gray-400 space-y-0.5">
            {/* eslint-disable-next-line react-hooks/refs */}
            <div>연결: {engineRef.current?.getConnectedEdges(activeNode.id).length || 0}개</div>
            <div>ID: {activeNode.id}</div>
          </div>
        </div>
      )}

      {/* HUD */}
      <div className="absolute top-14 left-3 text-[10px] text-gray-300 font-mono">
        노드: {graphData.nodes.length} | 엣지: {graphData.edges.length}
      </div>
    </div>
  );
}
