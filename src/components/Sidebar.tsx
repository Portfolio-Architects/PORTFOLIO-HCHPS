'use client';

import React from 'react';
import { ModuleType } from '@/types';
import { LayoutDashboard, ClipboardList, Radio, BookOpen } from 'lucide-react';

interface TopNavProps {
  activeModule: ModuleType;
  onModuleChange: (module: ModuleType) => void;
  taskStats: { total: number; done: number; overdue: number };
  quickInput?: React.ReactNode;
}

const navItems: { id: ModuleType; label: string; icon: React.ElementType }[] = [
  { id: 'workspace', label: '업무관리', icon: ClipboardList },
  { id: 'knowledge', label: '지식창고', icon: BookOpen },
  { id: 'mindmap', label: '시그널', icon: Radio },
];

export function Sidebar({ activeModule, onModuleChange, taskStats, quickInput }: TopNavProps) {
  return (
    <header className="sticky top-0 z-40 bg-[var(--color-card)] border-b border-[var(--color-border-light)] shadow-[var(--shadow-sm)]">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6">
        <div className="flex items-center h-14 gap-3">
          {/* Navigation Items */}
          <nav className="flex items-center gap-1 shrink-0">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onModuleChange(item.id)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full text-[13px] font-medium whitespace-nowrap cursor-pointer transition-all duration-200 ${
                    isActive
                      ? 'bg-[var(--color-primary)] text-white shadow-sm'
                      : 'text-[var(--color-text-secondary)] hover:bg-gray-100 hover:text-[var(--color-text-primary)]'
                  }`}
                  title={item.label}
                >
                  <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="hidden sm:inline">{item.label}</span>
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

          {/* QuickInput — fills remaining space */}
          {quickInput && (
            <div className="flex-1 min-w-0">
              {quickInput}
            </div>
          )}
          {!quickInput && <div className="flex-1" />}
        </div>
      </div>
    </header>
  );
}
