'use client';

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { ModuleType } from '@/types';
import { useTasks } from '@/hooks/useTasks';
import { useBudget } from '@/hooks/useBudget';
import { useInventory } from '@/hooks/useInventory';
import { useMeetings } from '@/hooks/useMeetings';
import { useProjects } from '@/hooks/useProjects';
import { useSignal } from '@/hooks/useSignal';
import { useScheduleAlerts } from '@/hooks/useScheduleAlerts';
import { useNotificationAlerts } from '@/hooks/useNotificationAlerts';
import { Sidebar } from '@/components/Sidebar';

const emptySubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

const PortfolioDashboardView = dynamic(() => import('@/components/dashboard/PortfolioDashboardView').then(mod => mod.PortfolioDashboardView), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      <p className="text-sm text-slate-500 font-bold">포트폴리오 대시보드를 생성하는 중...</p>
    </div>
  )
});

const MindMap3D = dynamic(() => import('@/components/MindMap3D').then(mod => mod.MindMap3D), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-[660px] gap-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      <p className="text-sm text-slate-500 font-bold">3D 마인드맵 엔진을 로드하는 중...</p>
    </div>
  )
});

const WorkspaceView = dynamic(() => import('@/components/WorkspaceView').then(mod => mod.WorkspaceView), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p className="text-sm text-slate-500 font-bold">예산 지출 대조보드를 불러오는 중...</p>
    </div>
  )
});

const InventoryList = dynamic(() => import('@/components/inventory/InventoryList').then(mod => mod.InventoryList), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      <p className="text-sm text-slate-500 font-bold">홍보 자재 관리 대장을 불러오는 중...</p>
    </div>
  )
});
import { AlertTriangle, RefreshCw, Sparkles, X } from 'lucide-react';
import { useSecurityLock } from '@/hooks/useSecurityLock';
import { SecurityLockScreen } from '@/components/SecurityLockScreen';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';

const SearchResultModal = dynamic(() => import('@/components/SearchResultModal').then(mod => mod.SearchResultModal), {
  ssr: false,
  loading: () => null
});

const AIAssistantModal = dynamic(() => import('@/components/ai/AIAssistantModal').then(mod => mod.AIAssistantModal), {
  ssr: false,
  loading: () => null
});

import { useMergedSignals } from '@/hooks/useMergedSignals';
import { syncTombstones } from '@/lib/sheets-api';
import { useGraphCustomization } from '@/hooks/useGraphCustomization';

// Error Boundary for MindMap3D — prevents signal map crash from breaking entire app
class MindMapErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertTriangle size={48} className="text-amber-400" />
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">시그널 로드 실패</h2>
          <p className="text-sm text-[var(--color-text-tertiary)] max-w-md text-center">
            {this.state.errorMsg || '컴포넌트 렌더링 중 오류가 발생했습니다.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, errorMsg: '' })}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors cursor-pointer"
          >
            <RefreshCw size={14} /> 다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface ProtectedAppProps {
  appMode: 'HCHPS' | 'VITAL';
  onModeChange: (mode: 'HCHPS' | 'VITAL') => void;
}

function ProtectedApp({ appMode, onModeChange, isInitializingGlobal }: ProtectedAppProps & { isInitializingGlobal: boolean }) {
  const [activeModule, setActiveModule] = useState<ModuleType>('dashboard');
  const [visitedModules, setVisitedModules] = useState<Record<ModuleType, boolean>>({
    dashboard: true,
    mindmap: false,
    workspace: false,
    inventory: false,
  });
  const [isQuickInputOpen, setIsQuickInputOpen] = useState(false);
  const [buttonBottom, setButtonBottom] = useState<number | null>(null);
  // Hooks
  const { tasks, updateTask, stats: taskStats } = useTasks();
  const { categories: budgetCategories, entries: budgetEntries, addCategory, updateCategory, deleteCategory, replaceCategories, addEntry, updateEntry, deleteEntry, getCategoryStats, overallStatsActual } = useBudget();
  const { items: inventoryItems, addItem, updateItem, deleteItem, adjustStock, getItemHistory } = useInventory();
  const { meetings } = useMeetings();
  const { projects } = useProjects();
  const { entries: signalEntries, addSignal, deleteSignal, updateSignalKeywords, keywordMap } = useSignal();
  const scheduleAlerts = useScheduleAlerts(tasks, meetings);
  useNotificationAlerts(scheduleAlerts);

  const { searchModalOpen, searchQuery, searchResults, closeSearchModal, handleGlobalSearch } = useGlobalSearch();
  const { mergedKeywordMap, mergedEntries } = useMergedSignals(signalEntries, keywordMap, tasks, projects, meetings, budgetEntries, inventoryItems);
  const { customNodes, customEdges, deletedEdges, overrides } = useGraphCustomization(activeModule === 'mindmap');



  const preloadModule = useCallback((module: ModuleType) => {
    setVisitedModules(prev => {
      if (prev[module]) return prev;
      return { ...prev, [module]: true };
    });
  }, []);

  const preloadModulesOnIdle = useCallback(() => {
    if (typeof window === 'undefined' || isInitializingGlobal) return null;
    
    // Staggered Preloading: 전역 인트로가 완전히 걷힌 후 세 개의 무거운 모듈 마운트를 시간 차를 두고 조용히 쪼개서 기동
    const timers: number[] = [];
    const triggerPreload = (module: ModuleType) => {
      setVisitedModules(prev => {
        if (prev[module]) return prev;
        return { ...prev, [module]: true };
      });
      console.log(`[Watcher Preload] Background caching initialized for: ${module}`);
    };

    const startStaggeredSequence = () => {
      // 1.5초 후 마인드맵 로드
      timers.push(window.setTimeout(() => triggerPreload('mindmap'), 1500));
      // 3.5초 후 예산 대조보드 로드
      timers.push(window.setTimeout(() => triggerPreload('workspace'), 3500));
      // 5.5초 후 홍보자재 대장 로드
      timers.push(window.setTimeout(() => triggerPreload('inventory'), 5500));
    };

    let idleCallbackId: number | null = null;
    if ('requestIdleCallback' in window) {
      idleCallbackId = window.requestIdleCallback(() => {
        startStaggeredSequence();
      });
    } else {
      startStaggeredSequence();
    }

    return { timers, idleCallbackId };
  }, [isInitializingGlobal]);

  // Prevent hydration mismatch — hooks read localStorage data on client
  useEffect(() => {
    // Sync tombstones from server to client local storage
    syncTombstones().catch((err) => {
      console.error('Failed to sync tombstones on mount:', err);
    });

    const idleTimer = preloadModulesOnIdle();

    return () => {
      if (idleTimer) {
        if (typeof window !== 'undefined') {
          if (idleTimer.idleCallbackId && 'cancelIdleCallback' in window && typeof idleTimer.idleCallbackId === 'number') {
            window.cancelIdleCallback(idleTimer.idleCallbackId);
          }
          if (idleTimer.timers && Array.isArray(idleTimer.timers)) {
            idleTimer.timers.forEach(t => clearTimeout(t));
          }
        }
      }
    };
  }, [preloadModulesOnIdle]);

  // Update browser document title
  useEffect(() => {
    document.title = 'PORTFOLIO - VITAL';
  }, []);

  // AI button position listener to prevent overlapping with footer
  useEffect(() => {
    const handleScroll = () => {
      const footer = document.getElementById('dashboard-footer');
      const isMobile = window.innerWidth < 640;
      const defaultBottom = isMobile ? 96 : 32; // bottom-24 is 96px, sm:bottom-8 is 32px

      if (!footer) {
        setButtonBottom(defaultBottom);
        return;
      }

      const footerRect = footer.getBoundingClientRect();
      const visibleFooterHeight = window.innerHeight - footerRect.top;
      
      if (visibleFooterHeight > 0) {
        // Push the button up so it stays at least 16px above the footer
        const targetBottom = visibleFooterHeight + 16;
        setButtonBottom(Math.max(defaultBottom, targetBottom));
      } else {
        setButtonBottom(defaultBottom);
      }
    };

    // Listen to scroll events anywhere on the page (capture phase)
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', handleScroll);
    
    // Initial calculation
    handleScroll();
    
    // Monitor DOM changes inside the scroll container to handle accordion collapses/expands
    const scrollContainer = document.getElementById('main-scroll-container');
    let mutationObserver: MutationObserver | null = null;
    if (scrollContainer) {
      mutationObserver = new MutationObserver(handleScroll);
      mutationObserver.observe(scrollContainer, { childList: true, subtree: true });
    }

    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      window.removeEventListener('resize', handleScroll);
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
    };
  }, [activeModule]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
      window.location.href = '/login';
    } catch (e) {
      console.error('Logout failed', e);
    }
  };

  // Swipe gesture state
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const handleModuleChange = (module: ModuleType) => {
    setActiveModule(module);
    setVisitedModules(prev => ({
      ...prev,
      [module]: true
    }));
    localStorage.setItem('hchps_active_module', module);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    
    // Disable swipe navigation on mindmap since panning the graph is a core interaction
    if (activeModule === 'mindmap') {
      touchStartX.current = null;
      touchEndX.current = null;
      return;
    }
    
    const distance = touchStartX.current - touchEndX.current;
    
    // Minimum horizontal swipe distance
    if (Math.abs(distance) > 60) {
      const order: ModuleType[] = ['dashboard', 'workspace', 'mindmap', 'inventory'];
      const currentIndex = order.indexOf(activeModule);
      
      if (distance > 0 && currentIndex < order.length - 1) {
        // Swiped left => next tab
        handleModuleChange(order[currentIndex + 1]);
      } else if (distance < 0 && currentIndex > 0) {
        // Swiped right => previous tab
        handleModuleChange(order[currentIndex - 1]);
      }
    }
    
    touchStartX.current = null;
    touchEndX.current = null;
  };

  useEffect(() => {
    const handleOpenWiki = () => {
      if (activeModule !== 'mindmap') {
        setActiveModule('mindmap');
      }
    };
    window.addEventListener('wiki:openNode', handleOpenWiki as EventListener);
    return () => window.removeEventListener('wiki:openNode', handleOpenWiki as EventListener);
  }, [activeModule]);

  const handleRenameCategory = (oldName: string, newName: string) => {
    const rawOld = oldName.startsWith('#') ? oldName.slice(1) : oldName;
    const rawNew = newName.startsWith('#') ? newName.slice(1) : newName;
    
    // update Tasks
    tasks.forEach(t => {
      if (t.tags.includes(rawOld)) {
        updateTask(t.id, { tags: t.tags.map(tag => tag === rawOld ? rawNew : tag) });
      }
    });
  };

  const handleDeleteCategory = (name: string) => {
    const rawName = name.startsWith('#') ? name.slice(1) : name;
    tasks.forEach(t => {
      if (t.tags.includes(rawName)) {
        updateTask(t.id, { tags: t.tags.filter(tag => tag !== rawName) });
      }
    });
  };



  return (
    <div 
      className="flex flex-col min-h-screen bg-[#f8fafc]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >

      <Sidebar
        activeModule={activeModule}
        onModuleChange={handleModuleChange}
        taskStats={taskStats}
        appMode={appMode}
        onModeChange={onModeChange}
        onPreloadModule={preloadModule}
        onSearch={handleGlobalSearch}
      />

      <main id="main-scroll-container" className="flex-1 pb-32 sm:pb-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1800px] mx-auto px-2 sm:px-3 lg:px-4 pt-4 sm:pt-6 lg:pt-8 flex flex-col gap-3">
          
          {/* Global Module Header & Divider Container */}
          <div className="flex flex-col gap-12 pt-3 sm:pt-4 lg:pt-5 shrink-0">
            <div className="flex flex-col gap-3">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-[1rem] shadow-sm border border-slate-100 flex items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icon-192x192.png" alt={`${appMode} Logo`} className="w-full h-full object-cover" />
                </div>
                {activeModule === 'dashboard' 
                  ? `PORTFOLIO ${appMode}` 
                  : `${appMode} ${
                      activeModule === 'mindmap' 
                        ? '마인드맵' 
                        : activeModule === 'workspace' 
                        ? '예산관리' 
                        : activeModule === 'inventory' 
                        ? '홍보물' 
                        : ''
                    }`
                }
              </h1>
              <div className="flex items-center gap-3 ml-2">
                <div className={`w-1 h-5 ${appMode === 'HCHPS' ? 'bg-emerald-600' : 'bg-blue-600'} rounded-full`} />
                <p className="text-[13px] font-medium text-slate-500 tracking-wide">
                  {appMode === 'HCHPS' 
                    ? '사내 업무 편성, 지식 자산화, 그리고 인물 시맨틱 온톨로지 시각화를 위한 초개인화 인텔리전스 워크스페이스' 
                    : 'Vital Information & Task Architecture Ledger — converging public health resources, tasks, and budget execution into a unified management topology'}
                </p>
              </div>
            </div>
            {/* Divider Line */}
            <div className="h-[1px] w-full bg-slate-200 dark:bg-slate-700" />
          </div>

          {/* Module Content */}
          <div className="flex-1 min-h-0">
            {/* Dashboard */}
            {visitedModules.dashboard && (
              <div className={activeModule === 'dashboard' ? 'block' : 'hidden'}>
                <PortfolioDashboardView tasks={tasks} budgetCategories={budgetCategories} budgetEntries={budgetEntries} onLogout={handleLogout} appMode={appMode} />
              </div>
            )}

            {/* MindMap3D */}
            {visitedModules.mindmap && (
              <div className={activeModule === 'mindmap' ? 'block' : 'hidden'}>
                <div className="flex flex-col h-full">
                  <MindMapErrorBoundary>
                    <MindMap3D 
                      signalKeywords={mergedKeywordMap} 
                      signalEntries={mergedEntries} 
                      onAddSignal={addSignal} 
                      onDeleteSignal={deleteSignal} 
                      onUpdateKeywords={updateSignalKeywords}
                      onRenameCategory={handleRenameCategory}
                      onDeleteCategory={handleDeleteCategory}
                      isActive={activeModule === 'mindmap'}
                    />
                  </MindMapErrorBoundary>
                </div>
              </div>
            )}

            {/* Workspace (Budget Management) */}
            {visitedModules.workspace && (
              <div className={activeModule === 'workspace' ? 'block' : 'hidden'}>
                <WorkspaceView
                  budgetCategories={budgetCategories}
                  budgetEntries={budgetEntries.filter(e => !e.isPlanned)}
                  addCategory={addCategory}
                  updateCategory={updateCategory}
                  deleteCategory={deleteCategory}
                  replaceCategories={replaceCategories}
                  addEntry={addEntry}
                  updateEntry={updateEntry}
                  deleteEntry={deleteEntry}
                  getCategoryStats={(id) => getCategoryStats(id, true)}
                  overallStats={overallStatsActual}
                  inventoryItems={inventoryItems}
                  addItem={addItem}
                  updateItem={updateItem}
                  deleteItem={deleteItem}
                  adjustStock={adjustStock}
                  getItemHistory={getItemHistory}
                  addSignal={addSignal}
                />
              </div>
            )}

            {/* Inventory (PR Materials) */}
            {visitedModules.inventory && (
              <div className={activeModule === 'inventory' ? 'block' : 'hidden'}>
                <InventoryList
                  items={inventoryItems}
                  addItem={addItem}
                  updateItem={updateItem}
                  deleteItem={deleteItem}
                  adjustStock={adjustStock}
                  getItemHistory={getItemHistory}
                />
              </div>
            )}
          </div>

          {/* Common Footer */}
          <div id="dashboard-footer" className="mt-8 pt-8 pb-4 border-t border-slate-200/60 shrink-0">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 text-[10px] font-black text-slate-400 tracking-widest uppercase">
              <span>© 2026 PORTFOLIO {appMode}. All rights reserved.</span>
              <span className="flex items-center gap-3">
                Precision Operations Intelligence
                <span className="text-slate-300">|</span> 
                <button onClick={handleLogout} className={`text-${appMode === 'HCHPS' ? 'emerald' : 'blue'}-500 hover:text-${appMode === 'HCHPS' ? 'emerald' : 'blue'}-600 transition-colors cursor-pointer`}>SECURE</button>
              </span>
            </div>
          </div>
        </div>
      </main>

      <SearchResultModal 
        isOpen={searchModalOpen}
        onClose={closeSearchModal}
        query={searchQuery}
        results={searchResults}
        appMode={appMode}
      />

      {/* Floating LLM Button & Popover */}
      <div 
        className="fixed bottom-24 sm:bottom-8 right-4 sm:right-8 z-50 flex flex-col items-end gap-3"
        style={buttonBottom !== null ? { bottom: `${buttonBottom}px` } : undefined}
      >
        <AIAssistantModal 
          isOpen={isQuickInputOpen} 
          onClose={() => setIsQuickInputOpen(false)}
          contextData={{
            signals: mergedEntries,
            budgetEntries: budgetEntries,
            budgetCategories: budgetCategories,
            customNodes,
            customEdges,
            deletedEdges,
            overrides,
            keywordMap: mergedKeywordMap
          }}
          appMode={appMode}
        />
        <button
          onClick={() => setIsQuickInputOpen(!isQuickInputOpen)}
          className={`p-4 rounded-full shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center ${
            isQuickInputOpen 
              ? 'bg-gray-800 text-white hover:bg-gray-700 shadow-lg' 
              : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:shadow-blue-500/25'
          }`}
          aria-label="AI 어시스턴트 열기"
        >
          {isQuickInputOpen ? <X size={24} /> : <Sparkles size={24} />}
        </button>
      </div>

    </div>
  );
}

export default function Home() {
  const isClient = useIsClient();
  const { isLocked, hasSetupPIN, failCount, verifyPIN, setupPIN } = useSecurityLock();
  const [appMode, setAppMode] = useState<'HCHPS' | 'VITAL'>('VITAL');

  const [isInitializing, setIsInitializing] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    document.title = 'PORTFOLIO - VITAL';
  }, [appMode]);

  useEffect(() => {
    // 클라이언트 마운트 및 PIN 락이 해제되어 활성화된 순간부터 1.8초 동안만 스플래시 가동
    if (isClient && !isLocked) {
      const timer = setTimeout(() => {
        setIsInitializing(false);
        const removeTimer = setTimeout(() => {
          setShowSplash(false);
        }, 700);
        return () => clearTimeout(removeTimer);
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [isClient, isLocked]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleModeChange = (_mode: 'HCHPS' | 'VITAL') => {
    setAppMode('VITAL');
  };

  if (!isClient || hasSetupPIN === null) {
    return (
      <div className="flex flex-col min-h-screen overflow-x-hidden">
        <header className="sticky top-0 z-50 bg-[var(--color-card)] border-b border-[var(--color-border-light)] shadow-[var(--shadow-sm)]">
          <div className="max-w-[1800px] mx-auto px-4 sm:px-6">
            <div className="flex items-center h-14 gap-3">
              <div className="w-24 h-8 bg-gray-100 rounded-full animate-pulse" />
              <div className="w-20 h-8 bg-gray-100 rounded-full animate-pulse" />
              <div className="w-24 h-8 bg-gray-100 rounded-full animate-pulse" />
              <div className="flex-1" />
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-[1800px] mx-auto">
            <div className="space-y-3">
              <div className="h-16 bg-gray-50 rounded-xl animate-pulse" />
              <div className="h-16 bg-gray-50 rounded-xl animate-pulse" />
              <div className="h-16 bg-gray-50 rounded-xl animate-pulse" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (isLocked) {
    return (
      <SecurityLockScreen 
        hasSetupPIN={hasSetupPIN} 
        failCount={failCount} 
        onVerify={verifyPIN} 
        onSetup={setupPIN} 
        appMode={appMode}
      />
    );
  }

  return (
    <>
      <ProtectedApp 
        appMode={appMode} 
        onModeChange={handleModeChange} 
        isInitializingGlobal={isInitializing}
      />
      
      {/* 프리미엄 전역 로딩 스플래시 화면 */}
      {showSplash && (
        <div 
          className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-slate-950 transition-opacity duration-700 ease-out pointer-events-auto"
          style={{ opacity: isInitializing ? 1 : 0 }}
        >
          <div className="flex flex-col items-center gap-6 max-w-md text-center px-6 animate-in fade-in zoom-in-95 duration-500">
            {/* 시각적 브랜드 링 심볼 */}
            <div className="relative flex items-center justify-center w-24 h-24">
              {/* 바깥 회전 링 */}
              <div className="absolute inset-0 rounded-full border-[3px] border-indigo-500/10 border-t-indigo-500 animate-spin duration-1000"></div>
              {/* 안쪽 역회전 링 */}
              <div className="absolute w-16 h-16 rounded-full border-[2.5px] border-emerald-500/10 border-b-emerald-500 animate-spin duration-700 reverse"></div>
              {/* 중앙 로고 빛 */}
              <div className="absolute w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 shadow-lg shadow-indigo-500/50 flex items-center justify-center animate-pulse">
                <Sparkles size={14} className="text-white" />
              </div>
            </div>
            
            <div className="flex flex-col gap-2 mt-2">
              <h1 className="text-xl font-black text-white tracking-wider uppercase">
                VITAL Work & Wealth
              </h1>
              <p className="text-xs text-indigo-400 font-bold tracking-widest uppercase">
                Architecture Initialization
              </p>
              <div className="h-px bg-slate-800 my-1 w-full max-w-[200px] mx-auto"></div>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed max-w-[280px] mx-auto">
                종단간 암호화(E2EE) 환경 내 예산 정산 및 시그널 노드 동기화를 가동하고 있습니다. 잠시만 기다려 주십시오.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
