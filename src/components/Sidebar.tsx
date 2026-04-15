'use client';

import React from 'react';
import { ModuleType } from '@/types';
import { SquareCheck, Archive, Zap, Lightbulb } from 'lucide-react';

interface TopNavProps {
  activeModule: ModuleType;
  onModuleChange: (module: ModuleType) => void;
  taskStats: { total: number; done: number; overdue: number };
  quickInput?: React.ReactNode;
}

const navItems: { id: ModuleType; label: string; icon: React.ElementType }[] = [
  { id: 'mindmap', label: '시그널', icon: Zap },
  { id: 'workspace', label: '자원관리', icon: Archive },
  { id: 'knowledge', label: '메모장', icon: SquareCheck },
  { id: 'project-planning', label: '사업기획', icon: Lightbulb },
];

export function Sidebar({ activeModule, onModuleChange, taskStats, quickInput }: TopNavProps) {
  const activeLabel = navItems.find((i) => i.id === activeModule)?.label;

  return (
    <>
      <header className="sticky top-0 left-0 right-0 z-40 bg-[var(--color-card)] border-b border-[var(--color-border-light)] shadow-sm">
        <div className="max-w-[1800px] mx-auto px-3 sm:px-6 py-2 sm:py-0">
          <div className="flex flex-col sm:flex-row items-center justify-between sm:justify-start h-auto sm:h-14 gap-2 sm:gap-3">
            
            {/* Mobile Header Title */}
            <div className="flex sm:hidden w-full items-center justify-between pt-1 px-1">
              <h1 className="text-xl font-[800] tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600">
                {activeLabel}
              </h1>
            </div>

            {/* Desktop Navigation Items */}
            <nav className="hidden sm:flex items-center w-auto justify-start shrink-0 gap-1 pb-0 pt-0">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onModuleChange(item.id)}
                    className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium whitespace-nowrap cursor-pointer transition-all duration-200 relative ${
                      isActive
                        ? 'text-white bg-[var(--color-primary)] shadow-sm'
                        : 'text-[var(--color-text-secondary)] hover:bg-gray-50 hover:text-[var(--color-text-primary)]'
                    }`}
                    title={item.label}
                  >
                    <Icon className="w-4 h-4" strokeWidth={isActive ? 2.5 : 1.8} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* QuickInput (Desktop & Mobile) */}
            {quickInput && (
              <div className="flex-1 w-full sm:min-w-0 pb-1 sm:pb-0">
                {quickInput}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Floating Dock */}
      <div className="sm:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-[320px]">
        <nav className="flex items-center justify-around p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg rounded-[2rem]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onModuleChange(item.id)}
                className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-full ${
                  isActive
                    ? 'text-blue-600 bg-blue-50/80 dark:bg-blue-900/30'
                    : 'text-slate-400'
                }`}
                aria-label={item.label}
              >
                <Icon 
                  className="w-6 h-6 scale-[0.8] transition-transform duration-200" 
                  strokeWidth={isActive ? 2.5 : 2} 
                />
                
                {/* Active Indicator Dot */}
                <div 
                  className={`absolute bottom-2.5 w-1.5 h-1.5 rounded-full bg-blue-600 ${
                    isActive ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}

