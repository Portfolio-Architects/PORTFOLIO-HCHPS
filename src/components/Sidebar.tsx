'use client';

import React from 'react';
import { ModuleType } from '@/types';
import { SquareCheck, Archive, Zap } from 'lucide-react';

interface TopNavProps {
  activeModule: ModuleType;
  onModuleChange: (module: ModuleType) => void;
  taskStats: { total: number; done: number; overdue: number };
  quickInput?: React.ReactNode;
}

const navItems: { id: ModuleType; label: string; icon: React.ElementType }[] = [
  { id: 'workspace', label: '자원관리', icon: Archive },
  { id: 'knowledge', label: '업무/지식', icon: SquareCheck },
  { id: 'mindmap', label: '시그널', icon: Zap },
];

export function Sidebar({ activeModule, onModuleChange, taskStats, quickInput }: TopNavProps) {
  return (
    <header className="sticky top-0 left-0 right-0 z-50 bg-[var(--color-card)] border-b border-[var(--color-border-light)] shadow-sm">
      <div className="max-w-[1800px] mx-auto px-2 sm:px-6 py-2 sm:py-0">
        <div className="flex flex-col sm:flex-row items-center justify-between sm:justify-start h-auto sm:h-14 gap-3">
          {/* Navigation Items */}
          <nav className="flex items-center w-full sm:w-auto justify-around sm:justify-start shrink-0 px-4 sm:px-0 gap-3 sm:gap-1 pb-1 sm:pb-0 pt-1 sm:pt-0">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onModuleChange(item.id)}
                  className={`flex flex-1 sm:flex-none flex-row items-center justify-center gap-2 sm:gap-1.5 sm:w-auto px-2 sm:px-4 py-3 sm:py-2 rounded-xl sm:rounded-full text-[13px] font-medium whitespace-nowrap cursor-pointer transition-all duration-200 relative ${
                    isActive
                      ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10 sm:bg-[var(--color-primary)] sm:text-white sm:shadow-sm'
                      : 'text-[var(--color-text-secondary)] hover:bg-gray-50 hover:text-[var(--color-text-primary)]'
                  }`}
                  title={item.label}
                >
                  <Icon className="w-5 h-5 sm:w-4 sm:h-4" strokeWidth={isActive ? 2.5 : 1.8} />
                  <span className="hidden sm:inline">{item.label}</span>
                  {item.id === 'workspace' && taskStats.overdue > 0 && (
                    <span className={`absolute top-0 sm:top-auto right-3 sm:right-auto sm:static sm:m-0 text-[10px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none border border-white sm:border-0 ${
                      isActive ? 'bg-[var(--color-danger)] text-white sm:bg-white/25 sm:text-white' : 'bg-[var(--color-danger)] text-white'
                    }`}>
                      {taskStats.overdue}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* QuickInput on Desktop — fills remaining space */}
          {quickInput && (
            <div className="hidden sm:flex flex-1 min-w-0">
              {quickInput}
            </div>
          )}
          {!quickInput && <div className="hidden sm:block flex-1" />}

          {/* Mobile Bottom Bar for QuickInput */}
          <div className="w-full sm:hidden px-1 pb-1 sm:pb-0">
            {quickInput}
          </div>
        </div>
      </div>
    </header>
  );
}
