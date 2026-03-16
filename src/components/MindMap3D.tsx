'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent } from './ui/card';
import { extractKeywords, analyzeCoOccurrence } from '@/lib/keyword-extractor';
import { buildGraphData, GraphData, GraphNode } from '@/lib/graph-builder';
import { Brain, Play, RotateCcw, Database, Type, Search, X, Link2, Circle } from 'lucide-react';
import { Task, Meeting, BudgetEntry, Project } from '@/types';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface MindMap3DProps {
  tasks?: Task[];
  meetings?: Meeting[];
  budgetEntries?: BudgetEntry[];
  projects?: Project[];
}

function buildModuleText(tasks: Task[], meetings: Meeting[], budgetEntries: BudgetEntry[], projects: Project[]): string {
  const parts: string[] = [];
  tasks.forEach(t => {
    parts.push(t.title);
    if (t.description) parts.push(t.description);
    if (t.category) parts.push(t.category);
    t.tags.forEach(tag => parts.push(tag));
  });
  meetings.forEach(m => {
    parts.push(m.title);
    if (m.agenda) parts.push(m.agenda);
    if (m.notes) parts.push(m.notes);
    if (m.location) parts.push(m.location);
    m.attendees.forEach(a => parts.push(a));
  });
  budgetEntries.forEach(e => {
    parts.push(e.purpose);
    if (e.memo) parts.push(e.memo);
  });
  projects.forEach(p => {
    parts.push(p.name);
    if (p.description) parts.push(p.description);
    p.checklistItems.forEach(item => parts.push(item.text));
  });
  return parts.join(' ');
}

export function MindMap3D({ tasks = [], meetings = [], budgetEntries = [], projects = [] }: MindMap3DProps) {
  const [mode, setMode] = useState<'data' | 'text'>('data');
  const [text, setText] = useState('');
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [maxKeywords, setMaxKeywords] = useState(30);
  const graphRef = useRef<any>(null);

  const totalItems = tasks.length + meetings.length + budgetEntries.length + projects.length;

  const analyze = useCallback(() => {
    let input: string;
    if (mode === 'data') {
      input = buildModuleText(tasks, meetings, budgetEntries, projects);
      if (!input.trim()) {
        input = '데이터가 아직 없습니다. 업무, 미팅, 예산, 프로젝트를 먼저 추가해 주세요.';
      }
    } else {
      input = text.trim() || '텍스트를 입력해 주세요.';
    }
    const keywords = extractKeywords(input, maxKeywords);
    const coOccurrences = analyzeCoOccurrence(input, keywords);
    const data = buildGraphData(keywords, coOccurrences);
    setGraphData(data);
    setSelectedNode(null);
  }, [mode, text, maxKeywords, tasks, meetings, budgetEntries, projects]);

  const reset = () => {
    setGraphData({ nodes: [], links: [] });
    setText('');
    setHoveredNode(null);
    setSelectedNode(null);
  };

  // Set of connected node IDs for the selected node
  const connectedNodeIds = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const ids = new Set<string>();
    graphData.links.forEach((l: any) => {
      const sourceId = l.source?.id || l.source;
      const targetId = l.target?.id || l.target;
      if (sourceId === selectedNode.id) ids.add(targetId);
      if (targetId === selectedNode.id) ids.add(sourceId);
    });
    return ids;
  }, [selectedNode, graphData.links]);

  // Connected nodes with link weight for the side panel
  const connectedList = useMemo(() => {
    if (!selectedNode) return [];
    return graphData.links
      .filter((l: any) => {
        const sourceId = l.source?.id || l.source;
        const targetId = l.target?.id || l.target;
        return sourceId === selectedNode.id || targetId === selectedNode.id;
      })
      .map((l: any) => {
        const sourceId = l.source?.id || l.source;
        const targetId = l.target?.id || l.target;
        const otherId = sourceId === selectedNode.id ? targetId : sourceId;
        const node = graphData.nodes.find(n => n.id === otherId);
        return node ? { ...node, linkWeight: l.value } : null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.linkWeight - a.linkWeight);
  }, [selectedNode, graphData]);

  const handleNodeHover = useCallback((node: any) => {
    setHoveredNode(node || null);
  }, []);

  const handleNodeClick = useCallback((node: any) => {
    if (selectedNode?.id === node?.id) {
      setSelectedNode(null); // toggle off
    } else {
      setSelectedNode(node || null);
      if (graphRef.current && node) {
        graphRef.current.centerAt(node.x, node.y, 500);
        graphRef.current.zoom(2, 500);
      }
    }
  }, [selectedNode]);

  const handleDeselect = useCallback(() => {
    setSelectedNode(null);
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 40);
    }
  }, []);

  // Custom node paint — dim non-connected nodes when one is selected
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name;
    const fontSize = Math.max(10, 12 / globalScale);
    const r = Math.max(4, Math.min(22, node.val * 1.5));
    const isSelected = selectedNode?.id === node.id;
    const isConnected = connectedNodeIds.has(node.id);
    const isHovered = hoveredNode?.id === node.id;
    const hasSelection = !!selectedNode;

    // Determine opacity: dim unconnected nodes when selection active
    const opacity = hasSelection
      ? (isSelected || isConnected ? 1 : 0.15)
      : (isHovered ? 1 : 0.85);

    // Glow for selected
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 6 / globalScale, 0, 2 * Math.PI, false);
      ctx.fillStyle = node.color + '20';
      ctx.fill();
    }

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
    ctx.fillStyle = node.color || '#4A6CF7';
    ctx.globalAlpha = opacity;
    ctx.fill();

    // Border
    if (isSelected || isHovered) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5 / globalScale;
      ctx.stroke();
      ctx.strokeStyle = node.color || '#4A6CF7';
      ctx.lineWidth = 1.5 / globalScale;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 3 / globalScale, 0, 2 * Math.PI, false);
      ctx.stroke();
    } else if (isConnected && hasSelection) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    // Label — always show for selected/connected, otherwise based on zoom
    const showLabel = isSelected || isConnected || isHovered || globalScale > 0.6 || r > 8;
    if (showLabel) {
      const labelAlpha = hasSelection ? (isSelected || isConnected ? 1 : 0.1) : 1;
      ctx.globalAlpha = labelAlpha;
      ctx.font = `${isSelected || node.val > 5 ? 'bold ' : ''}${fontSize}px 'Pretendard', sans-serif`;
      ctx.fillStyle = '#1e293b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, node.x, node.y + r + 3 / globalScale);
      ctx.globalAlpha = 1;
    }
  }, [hoveredNode, selectedNode, connectedNodeIds]);

  // Custom edge paint — highlight connected edges
  const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const sourceId = link.source?.id || link.source;
    const targetId = link.target?.id || link.target;
    const hasSelection = !!selectedNode;
    const isConnected = hasSelection && (sourceId === selectedNode?.id || targetId === selectedNode?.id);

    const sx = link.source.x, sy = link.source.y;
    const tx = link.target.x, ty = link.target.y;

    if (!sx || !sy || !tx || !ty) return;

    // Edge style
    const width = isConnected
      ? Math.max(1.5, Math.min(link.value * 0.8, 4)) / globalScale
      : Math.max(0.3, Math.min(link.value * 0.3, 1.5)) / globalScale;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);

    if (isConnected) {
      // Connected: use the selected node's color with strong alpha
      ctx.strokeStyle = selectedNode?.color || '#4A6CF7';
      ctx.globalAlpha = 0.6;
    } else if (hasSelection) {
      // Non-connected while selection active: very faint
      ctx.strokeStyle = '#e2e8f0';
      ctx.globalAlpha = 0.08;
    } else {
      // No selection: subtle default
      ctx.strokeStyle = '#cbd5e1';
      ctx.globalAlpha = 0.35;
    }

    ctx.lineWidth = width;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, [selectedNode]);

  // Build legend from cluster colors
  const legend = useMemo(() => {
    const colorMap = new Map<string, { count: number; sample: string }>();
    graphData.nodes.forEach(n => {
      const existing = colorMap.get(n.color);
      if (existing) {
        existing.count++;
      } else {
        colorMap.set(n.color, { count: 1, sample: n.name });
      }
    });
    return [...colorMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8);
  }, [graphData.nodes]);

  const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Brain size={22} className="text-[var(--color-primary)]" />
          마인드맵
        </h2>
      </div>

      {/* Input Section */}
      <Card>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode('data')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                  mode === 'data'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-gray-100 text-[var(--color-text-secondary)] hover:bg-gray-200'
                }`}
              >
                <Database size={14} />
                전체 데이터 분석
                {totalItems > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    mode === 'data' ? 'bg-white/25' : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  }`}>
                    {totalItems}
                  </span>
                )}
              </button>
              <button
                onClick={() => setMode('text')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                  mode === 'text'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-gray-100 text-[var(--color-text-secondary)] hover:bg-gray-200'
                }`}
              >
                <Type size={14} />
                텍스트 입력
              </button>
            </div>

            {mode === 'data' && (
              <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-700">
                <div className="font-medium mb-1">📊 업무관리 데이터에서 키워드를 자동 추출합니다</div>
                <div className="flex gap-4 text-xs text-blue-500">
                  <span>업무 {tasks.length}건</span>
                  <span>미팅 {meetings.length}건</span>
                  <span>예산 {budgetEntries.length}건</span>
                  <span>프로젝트 {projects.length}건</span>
                </div>
              </div>
            )}

            {mode === 'text' && (
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                className={`${inputClass} resize-none`}
                rows={4}
                placeholder="정제된 텍스트를 붙여넣으세요..."
              />
            )}

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-[var(--color-text-secondary)]">최대 키워드:</label>
                <input type="number" value={maxKeywords} onChange={e => setMaxKeywords(Number(e.target.value))} className="w-16 px-2 py-1 rounded border border-[var(--color-border)] text-sm text-center" min={5} max={80} />
              </div>
              <div className="flex-1" />
              <button onClick={reset} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm hover:bg-gray-50 transition-colors cursor-pointer">
                <RotateCcw size={14} /> 초기화
              </button>
              <button onClick={analyze} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">
                <Play size={14} /> 분석
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2D Graph + Side Panel */}
      {graphData.nodes.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
          {/* Graph */}
          <Card>
            <div className="relative" style={{ height: '560px' }}>
              {/* Legend (top-left overlay) */}
              <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-x-3 gap-y-1">
                {legend.map(([color, info], i) => (
                  <span key={i} className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    {info.sample}..
                  </span>
                ))}
              </div>

              {/* Stats (top-right overlay) */}
              <div className="absolute top-3 right-3 z-10 text-right">
                <div className="bg-white/90 backdrop-blur rounded-lg px-3 py-1.5 shadow-sm border border-[var(--color-border-light)] inline-flex gap-4">
                  <div>
                    <div className="text-[10px] text-[var(--color-text-tertiary)]">노드</div>
                    <div className="text-sm font-bold text-[var(--color-primary)]">{graphData.nodes.length}개</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--color-text-tertiary)]">연결</div>
                    <div className="text-sm font-bold text-[var(--color-success)]">{graphData.links.length}개</div>
                  </div>
                </div>
              </div>

              <ForceGraph2D
                ref={graphRef}
                graphData={graphData}
                nodeCanvasObject={paintNode}
                nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                  const r = Math.max(4, Math.min(22, node.val * 1.5));
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, r + 5, 0, 2 * Math.PI, false);
                  ctx.fillStyle = color;
                  ctx.fill();
                }}
                linkCanvasObject={paintLink}
                linkDirectionalParticles={0}
                backgroundColor="#ffffff"
                onNodeHover={handleNodeHover}
                onNodeClick={handleNodeClick}
                onBackgroundClick={handleDeselect}
                width={undefined}
                height={560}
                cooldownTicks={80}
                d3AlphaDecay={0.025}
                d3VelocityDecay={0.3}
                d3AlphaMin={0.01}
              />

              <div className="absolute bottom-3 left-3 bg-white/80 backdrop-blur rounded-lg px-3 py-1.5 text-[10px] text-[var(--color-text-tertiary)]">
                🖱️ 드래그: 이동 · 스크롤: 줌 · 클릭: 연결관계 보기
              </div>
            </div>
          </Card>

          {/* Side Panel */}
          <div className="space-y-3">
            {/* Node Detail / Empty State */}
            <Card>
              <CardContent>
                {selectedNode ? (
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: selectedNode.color }}>
                          <Circle size={8} className="text-white" fill="white" />
                        </span>
                        <h3 className="font-bold text-base">{selectedNode.name}</h3>
                      </div>
                      <button onClick={handleDeselect} className="p-1 rounded-md hover:bg-gray-100 cursor-pointer transition-colors">
                        <X size={14} className="text-[var(--color-text-tertiary)]" />
                      </button>
                    </div>

                    {/* Category tags */}
                    <div className="flex gap-1.5 mb-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: selectedNode.color + '15', color: selectedNode.color }}>
                        출현 {selectedNode.count}회
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-600">
                        연결 {connectedList.length}개
                      </span>
                    </div>

                    {/* Connected items list */}
                    {connectedList.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-[var(--color-text-tertiary)] mb-2">
                          <Link2 size={10} />
                          연결된 항목 ({connectedList.length}개)
                        </div>
                        <div className="space-y-1 max-h-[320px] overflow-y-auto custom-scrollbar">
                          {connectedList.map((node: any) => (
                            <button
                              key={node.id}
                              onClick={() => handleNodeClick(node)}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors text-left"
                            >
                              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: node.color }} />
                              <span className="flex-1 text-xs font-medium text-[var(--color-text-primary)] truncate">{node.name}</span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-100 text-[var(--color-text-secondary)] shrink-0">
                                {node.linkWeight > 1 ? `강도 ${node.linkWeight}` : '연관'}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Deselect button */}
                    <button onClick={handleDeselect} className="w-full mt-3 py-1.5 text-center text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] cursor-pointer transition-colors border-t border-[var(--color-border-light)]">
                      ✕ 선택 해제
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Search size={28} className="mx-auto mb-3 text-[var(--color-text-tertiary)] opacity-30" />
                    <div className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">
                      노드를 선택해보세요<br />
                      그래프의 점을 클릭하면<br />
                      연결된 관계를 확인할 수 있어요
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Keyword List */}
            <Card>
              <div className="px-4 py-2.5 border-b border-[var(--color-border-light)]">
                <h3 className="text-xs font-semibold">추출된 키워드 ({graphData.nodes.length}개)</h3>
              </div>
              <CardContent>
                <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                  {[...graphData.nodes].sort((a, b) => b.count - a.count).map(node => (
                    <button
                      key={node.id}
                      onClick={() => handleNodeClick(node)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium cursor-pointer transition-all ${
                        selectedNode?.id === node.id ? 'ring-2 ring-offset-1' : 'hover:opacity-80'
                      }`}
                      style={{
                        backgroundColor: selectedNode?.id === node.id ? node.color : `${node.color}12`,
                        color: selectedNode?.id === node.id ? '#fff' : node.color,
                        ...(selectedNode?.id === node.id ? { ringColor: node.color } : {}),
                      }}
                    >
                      {node.name}
                      <span className={selectedNode?.id === node.id ? 'opacity-70' : 'opacity-50'}>{node.count}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
