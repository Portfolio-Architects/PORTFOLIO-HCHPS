'use client';

import React from 'react';
import { Printer, Maximize2, Minimize2, PlusSquare, RotateCcw } from 'lucide-react';
import { OrbitalNode, GROUP_COLORS, OntologyGroup } from '@/lib/ontology.types';

interface MindMapHUDProps {
  containerWidth: number;
  hoveredNode: OrbitalNode | null;
  activeNode: OrbitalNode | null;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onPrintPdf: () => void;
  onAddNodeClick?: () => void;
  onResetCamera?: () => void;
  zoomSliderRef: React.RefObject<HTMLInputElement | null>;
  zoomLabelRef: React.RefObject<HTMLSpanElement | null>;
  onZoomChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function MindMapHUD({
  containerWidth,
  hoveredNode,
  activeNode,
  isFullscreen,
  onToggleFullscreen,
  onPrintPdf,
  onAddNodeClick,
  onResetCamera,
  zoomSliderRef,
  zoomLabelRef,
  onZoomChange
}: MindMapHUDProps) {
  return (
    <>
      {/* Hover tooltip (for nodes that are NOT active) */}
      {hoveredNode && hoveredNode.id !== activeNode?.id && (
        <div
          className="absolute z-20 pointer-events-none bg-white/90 backdrop-blur-md rounded-lg px-3 py-2 shadow-md border border-slate-200/50 transition-all duration-75"
          style={{
            left: Math.min(containerWidth - 180, hoveredNode.renderX + 20),
            top: hoveredNode.renderY - 10,
          }}
        >
          <div className="flex items-center gap-1.5">
            <span 
              className="w-2.5 h-2.5 rounded-full" 
              style={{ backgroundColor: GROUP_COLORS[hoveredNode.group as OntologyGroup] || '#ccc' }} 
            />
            <span className="text-xs font-semibold text-slate-800">{hoveredNode.label}</span>
          </div>
        </div>
      )}

      {/* Controls - Bottom Right */}
      <div className="absolute bottom-24 md:bottom-4 right-4 z-10 flex items-center gap-2 bg-slate-900/10 backdrop-blur-md p-1.5 rounded-xl border border-white/20 shadow-lg">

        {onAddNodeClick && (
          <button
            onClick={onAddNodeClick}
            className="bg-gradient-to-r from-[var(--color-primary)] to-blue-600 text-white rounded-lg p-2.5 shadow-sm hover:opacity-90 cursor-pointer flex items-center gap-1.5 transition-colors border-0"
            title="새 노드 추가 (Add Node)"
          >
            <PlusSquare size={18} />
            <span className="text-xs font-bold px-0.5">노드 추가</span>
          </button>
        )}

        {onAddNodeClick && <div className="w-px h-6 bg-slate-300/40 mx-1"></div>}

        {onResetCamera && (
          <button
            onClick={onResetCamera}
            className="bg-white/80 backdrop-blur-md rounded-lg p-2.5 shadow-sm border border-slate-200/50 hover:bg-gray-50 hover:text-slate-800 cursor-pointer text-gray-500 transition-colors flex items-center justify-center"
            title="카메라 위치 초기화 (중앙으로 정렬)"
          >
            <RotateCcw size={18} />
          </button>
        )}

        {onResetCamera && <div className="w-px h-6 bg-slate-300/40 mx-1"></div>}

        {/* Zoom Ratio Slider */}
        <div className="bg-white/80 backdrop-blur-md border border-slate-200/50 rounded-lg px-3 py-1.5 shadow-sm flex items-center gap-2 select-none h-[38px]">
          <span ref={zoomLabelRef} className="text-[11px] font-bold text-slate-600 min-w-[36px] text-right">100%</span>
          <input
            ref={zoomSliderRef}
            type="range"
            min={0.3}
            max={3.0}
            step={0.01}
            onChange={onZoomChange}
            className="w-20 md:w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)] focus:outline-none"
            style={{ WebkitAppearance: 'none' }}
          />
        </div>

        <div className="w-px h-6 bg-slate-300/40 mx-1"></div>

        {/* PDF Print/Export */}
        <button
          onClick={onPrintPdf}
          className="bg-white/80 backdrop-blur-md rounded-lg p-2.5 shadow-sm border border-slate-200/50 hover:bg-gray-50 hover:text-slate-800 cursor-pointer text-gray-500 transition-colors"
          title="마인드맵 PDF 인쇄/저장"
        >
          <Printer size={18} />
        </button>

        {/* Fullscreen toggle */}
        <button
          onClick={onToggleFullscreen}
          className="bg-white/80 backdrop-blur-md rounded-lg p-2.5 shadow-sm border border-slate-200/50 hover:bg-gray-50 hover:text-slate-800 cursor-pointer text-gray-500 transition-colors"
          title={isFullscreen ? '패널 보기' : '전체화면'}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>
    </>
  );
}
