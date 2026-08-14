'use client';

import React from 'react';
import { BookOpen } from 'lucide-react';
import { OrbitalNode } from '@/lib/ontology.types';

interface MindMapHeaderProps {
  stats: { nodes: number; edges: number };
  activeNode: OrbitalNode | null;
  isWikiOpen: boolean;
  usingSample: boolean;
  onOpenWiki: () => void;
  onLoadFestivalPreset?: () => void;
}

export function MindMapHeader({
  stats,
  activeNode,
  isWikiOpen,
  usingSample,
  onOpenWiki,
  onLoadFestivalPreset
}: MindMapHeaderProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          노드 <span className="text-slate-900 dark:text-white font-bold ml-0.5">{stats.nodes}</span>개
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          연결 <span className="text-slate-900 dark:text-white font-bold ml-0.5">{stats.edges}</span>개
        </div>
        {onLoadFestivalPreset && (
          <button
            onClick={onLoadFestivalPreset}
            className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-white text-[11px] font-bold hover:opacity-90 shadow-sm border-0 cursor-pointer transition-all"
            title="50-70M KRW 축제 5대 도메인 템플릿 로드"
          >
            🎪 5-도메인 축제 템플릿 로드
          </button>
        )}
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
