'use client';

import React from 'react';
import { 
  Plus, RotateCcw, Search, LayoutGrid, ZoomIn, ZoomOut, 
  Maximize2, Minimize2, FileText 
} from 'lucide-react';

interface MindMapHeaderProps {
  stats: { nodes: number; edges: number };
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddNewNode: () => void;
  onClearAll: () => void;
  onAutoArrange?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function MindMapHeader({
  stats,
  searchQuery,
  onSearchChange,
  onAddNewNode,
  onClearAll,
  onAutoArrange,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  isFullscreen,
  onToggleFullscreen,
}: MindMapHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 select-none">
      {/* Left: Stats & Search */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs">
          <FileText size={14} className="text-blue-500" />
          노트 <span className="font-bold text-blue-600 dark:text-blue-400 ml-0.5">{stats.nodes}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          연결 <span className="font-bold text-emerald-600 dark:text-emerald-400 ml-0.5">{stats.edges}</span>
        </div>

        {/* Search Bar */}
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="노트 검색..."
            className="pl-8 pr-3 py-1.5 text-xs bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 w-36 sm:w-48 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Right: Actions (Add, Layout, Clear, Zoom) */}
      <div className="flex items-center gap-2">
        {/* Add Note Button */}
        <button
          onClick={onAddNewNode}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer hover:shadow hover:-translate-y-0.5"
          title="새 루트 노트 추가"
        >
          <Plus size={15} />
          <span>새 노트 추가</span>
        </button>

        {/* Auto Arrange Button */}
        {onAutoArrange && (
          <button
            onClick={onAutoArrange}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            title="노트 자동 트리 정렬"
          >
            <LayoutGrid size={14} className="text-slate-500 dark:text-slate-400" />
            <span className="hidden sm:inline">자동 정렬</span>
          </button>
        )}

        {/* Zoom Controls */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700">
          {onZoomOut && (
            <button
              onClick={onZoomOut}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="축소"
            >
              <ZoomOut size={14} />
            </button>
          )}
          {onResetZoom && (
            <button
              onClick={onResetZoom}
              className="px-2 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="100% 원래 크기"
            >
              100%
            </button>
          )}
          {onZoomIn && (
            <button
              onClick={onZoomIn}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="확대"
            >
              <ZoomIn size={14} />
            </button>
          )}
        </div>

        {/* Reset All Button */}
        <button
          onClick={onClearAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-rose-200/50 dark:border-rose-900/50"
          title="모든 노트와 연결을 비우고 백지 상태로 새로 시작"
        >
          <RotateCcw size={13} />
          <span className="hidden sm:inline">초기화</span>
        </button>

        {/* Fullscreen Toggle */}
        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={isFullscreen ? "전체화면 종료" : "전체화면"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}
