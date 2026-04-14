'use client';

import React from 'react';
import { Printer, Maximize2, Minimize2 } from 'lucide-react';
import { OrbitalNode, GROUP_COLORS, OntologyGroup } from '@/lib/ontology.types';

interface MindMapHUDProps {
  containerWidth: number;
  hoveredNode: OrbitalNode | null;
  activeNode: OrbitalNode | null;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onPrintPdf: () => void;
}

export function MindMapHUD({
  containerWidth,
  hoveredNode,
  activeNode,
  isFullscreen,
  onToggleFullscreen,
  onPrintPdf
}: MindMapHUDProps) {
  return (
    <>
      {/* Hover tooltip (for nodes that are NOT active) */}
      {hoveredNode && hoveredNode.id !== activeNode?.id && (
        <div
          className="absolute z-20 pointer-events-none bg-white rounded-lg px-3 py-2 shadow-sm border border-[var(--color-border-light)] transition-all duration-75"
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
            <span className="text-xs font-semibold">{hoveredNode.label}</span>
          </div>
        </div>
      )}

      {/* Controls - Bottom Right */}
      <div className="absolute bottom-24 md:bottom-4 right-4 z-10 flex items-center gap-2">
        {/* PDF Print/Export */}
        <button
          onClick={onPrintPdf}
          className="bg-white rounded-lg p-2.5 shadow-sm border border-[var(--color-border-light)] hover:bg-gray-100 cursor-pointer text-gray-500 transition-colors"
          title="시그널 맵 PDF 인쇄/저장"
        >
          <Printer size={18} />
        </button>

        {/* Fullscreen toggle */}
        <button
          onClick={onToggleFullscreen}
          className="bg-white rounded-lg p-2.5 shadow-sm border border-[var(--color-border-light)] hover:bg-gray-100 cursor-pointer text-gray-500 transition-colors"
          title={isFullscreen ? '패널 보기' : '전체화면'}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>
    </>
  );
}
