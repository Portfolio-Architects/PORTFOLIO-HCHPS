'use client';

import React, { useState } from 'react';
import { ModuleType } from '@/types';
import { Archive, Zap, LayoutDashboard, Package, Search } from 'lucide-react';

interface TopNavProps {
  activeModule: ModuleType;
  onModuleChange: (module: ModuleType) => void;
  taskStats: { total: number; done: number; overdue: number };
  appMode: 'HCHPS' | 'VITAL';
  onModeChange: (mode: 'HCHPS' | 'VITAL') => void;
  onPreloadModule?: (module: ModuleType) => void;
  onSearch?: (query: string) => void;
}

const navItems: { id: ModuleType; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
  { id: 'workspace', label: '예산관리', icon: Archive },
  { id: 'mindmap', label: '마인드맵', icon: Zap },
  { id: 'inventory', label: '홍보물', icon: Package },
];

export function Sidebar({ activeModule, onModuleChange, appMode, onPreloadModule, onSearch }: TopNavProps) {
  const [searchVal, setSearchVal] = useState('');
  const activeLabel = navItems.find((i) => i.id === activeModule)?.label;

  const handleSearchSubmit = () => {
    if (searchVal.trim() && onSearch) {
      onSearch(searchVal.trim());
      setSearchVal(''); // 모달이 뜬 뒤 입력창을 초기화
    }
  };

  return (
    <>
      <header className="sticky top-0 left-0 right-0 z-50 pointer-events-auto bg-[var(--color-card)]/70 backdrop-blur-md border-b border-white/20 shadow-xs transition-all duration-300">
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
                          : 'text-[var(--color-text-secondary)] hover:bg-slate-500/5 hover:text-[var(--color-text-primary)]'
                      }`}
                      title={item.label}
                    >
                      <Icon className="w-4 h-4" strokeWidth={isActive ? 2.0 : 1.5} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Right side: Global Search Input */}
            <div className="flex items-center gap-2 max-w-[240px] w-full pr-1.5">
              <div className="relative w-full">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  <Search size={13} />
                </span>
                <input
                  type="text"
                  placeholder="지식 & 파일 본문 검색..."
                  value={searchVal}
                  onChange={e => setSearchVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleSearchSubmit();
                    }
                  }}
                  className="w-full pl-8.5 pr-3 py-1.5 bg-slate-500/5 hover:bg-slate-500/8 focus:bg-white border border-slate-200/40 focus:border-indigo-500/80 rounded-full text-[12px] font-semibold text-slate-800 placeholder:text-slate-400/80 outline-none transition-all focus:shadow-[0_0_12px_rgba(99,102,241,0.12)]"
                />
              </div>
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

