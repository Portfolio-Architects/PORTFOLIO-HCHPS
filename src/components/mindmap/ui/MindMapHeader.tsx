'use client';

import React from 'react';
import { Radio, BookOpen } from 'lucide-react';
import { OrbitalNode } from '@/lib/ontology.types';

interface MindMapHeaderProps {
  stats: { nodes: number; edges: number };
  activeNode: OrbitalNode | null;
  isWikiOpen: boolean;
  usingSample: boolean;
  onOpenWiki: () => void;
}

export function MindMapHeader({
  stats,
  activeNode,
  isWikiOpen,
  usingSample,
  onOpenWiki
}: MindMapHeaderProps) {
  return (
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
            onClick={onOpenWiki}
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
  );
}
