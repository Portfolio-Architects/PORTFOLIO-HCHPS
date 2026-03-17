'use client';

import React from 'react';
import { ModuleType } from '@/types';
import { LayoutDashboard, ClipboardList, Brain } from 'lucide-react';

interface TopNavProps {
  activeModule: ModuleType;
  onModuleChange: (module: ModuleType) => void;
  taskStats: { total: number; done: number; overdue: number };
}

const navItems: { id: ModuleType; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
  { id: 'workspace', label: '업무관리', icon: ClipboardList },
  { id: 'mindmap', label: '마인드맵', icon: Brain },
];

export function Sidebar({ activeModule, onModuleChange, taskStats }: TopNavProps) {
  return (
    <header className="sticky top-0 z-40 bg-[var(--color-card)] border-b border-[var(--color-border-light)] shadow-[var(--shadow-sm)]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <div className="flex items-center h-14 gap-4">
          {/* Navigation Items — flush left */}
          <nav className="flex items-center gap-1 flex-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onModuleChange(item.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium whitespace-nowrap cursor-pointer transition-all duration-200 ${
                    isActive
                      ? 'bg-[var(--color-primary)] text-white shadow-sm'
                      : 'text-[var(--color-text-secondary)] hover:bg-gray-100 hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span>{item.label}</span>
                  {item.id === 'workspace' && taskStats.overdue > 0 && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                      isActive ? 'bg-white/25 text-white' : 'bg-[var(--color-danger)] text-white'
                    }`}>
                      {taskStats.overdue}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Mini stats (right side) */}
          <div className="hidden md:flex items-center gap-3 shrink-0 pl-4 border-l border-[var(--color-border-light)]">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[var(--color-text-tertiary)]">전체</span>
              <span className="font-semibold text-[var(--color-text-primary)]">{taskStats.total}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[var(--color-text-tertiary)]">완료</span>
              <span className="font-semibold text-[var(--color-success)]">{taskStats.done}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
