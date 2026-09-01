'use client';

import React from 'react';
import { ModuleType } from '@/types';
import { Archive, LayoutDashboard, Sparkles } from 'lucide-react';

import { LocalhostStatusHUD } from '@/components/layout/LocalhostStatusHUD';

interface TopNavProps {
  activeModule: ModuleType;
  onModuleChange: (module: ModuleType) => void;
  taskStats: { total: number; done: number; overdue: number };
  appMode: 'HCHPS' | 'VITAL';
  onModeChange: (mode: 'HCHPS' | 'VITAL') => void;
  onPreloadModule?: (module: ModuleType) => void;
  onOpenLogs?: () => void;
}

const navItems: { id: ModuleType; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
  { id: 'workspace', label: '예산관리', icon: Archive },
  { id: 'festival', label: '양재천 페스티벌', icon: Sparkles },
];

export function Sidebar({ activeModule, onModuleChange, appMode, onPreloadModule, onOpenLogs }: TopNavProps) {
  const activeLabel = navItems.find((i) => i.id === activeModule)?.label;

  return (
    <>
      <header className="sticky top-0 left-0 right-0 z-50 pointer-events-auto bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-all duration-300">
        <div className="max-w-[1800px] mx-auto px-2 sm:px-3 lg:px-4">
          <div className="flex items-center justify-between h-14 gap-3">
            
            {/* Left side: Navigation Items */}
            <div className="flex items-center gap-3">
              {/* Mobile Header Title */}
              <div className="flex sm:hidden items-center pt-1 px-1">
                <h1 className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                  {activeLabel}
                </h1>
              </div>

              {/* Desktop Navigation Items */}
              <nav className="hidden sm:flex items-center w-auto justify-start shrink-0 gap-1.5">
                {navItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeModule === item.id;
                  const activeBg = appMode === 'HCHPS' ? 'bg-emerald-600 shadow-emerald-500/10' : 'bg-blue-600 shadow-blue-500/10';
                  return (
                    <button
                      key={item.id}
                      onClick={() => onModuleChange(item.id)}
                      onMouseEnter={() => onPreloadModule?.(item.id)}
                      onFocus={() => onPreloadModule?.(item.id)}
                      className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap cursor-pointer transition-all duration-150 relative hover:scale-[1.03] active:scale-95 ${
                        isActive
                          ? `text-white ${activeBg} shadow-md`
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                      title={item.label}
                    >
                      <Icon className="w-4 h-4" strokeWidth={isActive ? 2.0 : 1.5} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Quick Access: 2026 Yangjaecheon Festival Tracker */}
              <button
                onClick={() => onModuleChange('festival')}
                className={`hidden md:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all duration-150 group active:scale-95 ${
                  activeModule === 'festival'
                    ? 'text-white bg-emerald-600 shadow-md shadow-emerald-600/20 border border-emerald-500 ring-2 ring-emerald-400/20'
                    : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 shadow-2xs'
                }`}
                title="2026 양재천 건강 페스티벌 실시간 관제 대시보드 열기"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-bold tracking-tight">양재천 페스티벌</span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  activeModule === 'festival' ? 'bg-emerald-800 text-white' : 'bg-emerald-200/70 text-emerald-800'
                }`}>D-60</span>
              </button>
            </div>

            {/* Right side: Localhost Health & Daemon Status HUD */}
            <div className="flex items-center gap-2 pr-1.5">
              <button
                onClick={() => onModuleChange('festival')}
                className={`md:hidden flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                  activeModule === 'festival'
                    ? 'text-white bg-emerald-600 border border-emerald-500'
                    : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                }`}
                title="양재천 페스티벌 관제판"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>양재천 D-60</span>
              </button>
              <LocalhostStatusHUD onOpenLogs={onOpenLogs} />
            </div>

          </div>
        </div>
      </header>

      {/* Mobile Floating Dock */}
      <div className="sm:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-[320px] transition-all duration-300 transform animate-slide-up-fade">
        <nav className="flex items-center justify-around p-1.5 bg-white/75 dark:bg-slate-900/75 backdrop-blur-lg border border-white/20 shadow-2xl rounded-[2.5rem]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            const activeText = appMode === 'HCHPS' ? 'text-emerald-600' : 'text-blue-600';
            const activeBg = appMode === 'HCHPS' ? 'bg-emerald-50/70 dark:bg-emerald-950/20' : 'bg-blue-50/70 dark:bg-blue-950/20';
            const dotBg = appMode === 'HCHPS' ? 'bg-emerald-600' : 'bg-blue-600';
            return (
              <button
                key={item.id}
                onClick={() => onModuleChange(item.id)}
                onTouchStart={() => onPreloadModule?.(item.id)}
                className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-full transition-all duration-200 hover:scale-105 active:scale-90 ${
                  isActive
                    ? `${activeText} ${activeBg}`
                    : 'text-slate-400 hover:text-slate-500'
                }`}
                aria-label={item.label}
              >
                <Icon 
                  className={`w-6 h-6 scale-[0.8] transition-transform duration-200 ${isActive ? 'scale-90' : ''}`} 
                  strokeWidth={isActive ? 2.0 : 1.5} 
                />
                
                {/* Active Indicator Dot */}
                <div 
                  className={`absolute bottom-2 w-1.5 h-1.5 rounded-full ${dotBg} transition-all duration-300 ${
                    isActive ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
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

