'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { ModuleType } from '@/types';
import { useTasks } from '@/hooks/useTasks';
import { useBudget } from '@/hooks/useBudget';
import { useInventory } from '@/hooks/useInventory';
import { useMeetings } from '@/hooks/useMeetings';
import { useProjects } from '@/hooks/useProjects';
import { useContacts } from '@/hooks/useContacts';
import { useSignal } from '@/hooks/useSignal';
import { useScheduleAlerts } from '@/hooks/useScheduleAlerts';
import { useNotificationAlerts } from '@/hooks/useNotificationAlerts';
import { useFreezeDetector } from '@/hooks/useFreezeDetector';
import { Sidebar } from '@/components/Sidebar';

const emptySubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

function PortfolioDashboardViewSkeleton() {
  return (
    <div className="w-full flex flex-col gap-6 animate-pulse">
      {/* Main Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-4">
        {/* Left Column */}
        <div className="xl:col-span-6 flex flex-col gap-6">
          {/* Budget Allocation Panel */}
          <div className="bg-slate-100/60 dark:bg-slate-800/40 rounded-[2rem] p-8 border border-slate-200/40 dark:border-slate-800 h-[400px] flex flex-col justify-between">
            <div className="flex justify-between items-center mb-6">
              <div className="w-48 h-6 bg-slate-200 dark:bg-slate-700 rounded-lg" />
              <div className="w-36 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl" />
            </div>
            <div className="flex-grow flex flex-col sm:flex-row gap-8 items-center justify-center">
              <div className="w-[180px] h-[180px] rounded-full border-[16px] border-slate-200 dark:border-slate-700 flex items-center justify-center flex-shrink-0" />
              <div className="flex-grow flex flex-col gap-3 w-full">
                <div className="w-full h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="w-5/6 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="w-2/3 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="w-3/4 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
          </div>
          {/* KPI Mini Cards Grid */}
          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800 rounded-[1.5rem] p-5 h-[110px] flex flex-col justify-between">
              <div className="w-24 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="w-16 h-6 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            </div>
            <div className="bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800 rounded-[1.5rem] p-5 h-[110px] flex flex-col justify-between">
              <div className="w-24 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="w-16 h-6 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            </div>
            <div className="bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800 rounded-[1.5rem] p-5 h-[110px] flex flex-col justify-between">
              <div className="w-24 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="w-28 h-6 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            </div>
            <div className="bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800 rounded-[1.5rem] p-5 h-[110px] flex flex-col justify-between">
              <div className="w-24 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="w-28 h-6 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="xl:col-span-6 flex flex-col gap-6">
          {/* Monthly Budget Execution */}
          <div className="bg-slate-100/60 dark:bg-slate-800/40 rounded-[2rem] p-8 border border-slate-200/40 dark:border-slate-800 h-full min-h-[530px] flex flex-col justify-between">
            <div className="flex justify-between items-center mb-6">
              <div className="flex flex-col gap-2">
                <div className="w-56 h-6 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                <div className="w-40 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="w-28 h-9 bg-slate-200 dark:bg-slate-700 rounded-xl" />
            </div>
            {/* Chart Area Mockup */}
            <div className="flex-grow w-full bg-slate-200/20 dark:bg-slate-700/10 rounded-2xl flex items-end gap-3 p-4 h-[385px]">
              <div className="flex-grow bg-slate-200 dark:bg-slate-700 rounded-t h-[20%]" />
              <div className="flex-grow bg-slate-200 dark:bg-slate-700 rounded-t h-[35%]" />
              <div className="flex-grow bg-slate-200 dark:bg-slate-700 rounded-t h-[25%]" />
              <div className="flex-grow bg-slate-200 dark:bg-slate-700 rounded-t h-[50%]" />
              <div className="flex-grow bg-slate-200 dark:bg-slate-700 rounded-t h-[45%]" />
              <div className="flex-grow bg-slate-200 dark:bg-slate-700 rounded-t h-[70%]" />
              <div className="flex-grow bg-slate-200 dark:bg-slate-700 rounded-t h-[60%]" />
              <div className="flex-grow bg-slate-200 dark:bg-slate-700 rounded-t h-[80%]" />
              <div className="flex-grow bg-slate-200 dark:bg-slate-700 rounded-t h-[75%]" />
              <div className="flex-grow bg-slate-200 dark:bg-slate-700 rounded-t h-[90%]" />
              <div className="flex-grow bg-slate-200 dark:bg-slate-700 rounded-t h-[85%]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceViewSkeleton() {
  return (
    <div className="w-full flex flex-col gap-6 animate-pulse">
      {/* Tab Switcher Skeleton */}
      <div className="flex border-b border-slate-200 gap-1 pb-px">
        <div className="w-32 h-11 bg-slate-200 dark:bg-slate-700 rounded-t-lg" />
        <div className="w-32 h-11 bg-slate-200/50 dark:bg-slate-700/50 rounded-t-lg" />
      </div>

      {/* Title Area */}
      <div className="flex items-center justify-between flex-wrap gap-2 mt-4">
        <div className="w-36 h-7 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        <div className="w-24 h-9 bg-slate-200 dark:bg-slate-700 rounded-lg" />
      </div>

      {/* Multi-Filter System Skeleton */}
      <div className="bg-slate-100/60 dark:bg-slate-800/40 rounded-[2rem] p-5 border border-slate-200/40 dark:border-slate-800">
        <div className="w-40 h-5 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
        <div className="flex flex-wrap gap-3">
          <div className="w-36 h-9 bg-slate-200 dark:bg-slate-700 rounded-xl" />
          <div className="w-36 h-9 bg-slate-200 dark:bg-slate-700 rounded-xl" />
          <div className="w-36 h-9 bg-slate-200 dark:bg-slate-700 rounded-xl" />
          <div className="w-36 h-9 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        </div>
      </div>

      {/* Summary Cards Grid (4 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
        <div className="bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800 rounded-[2rem] p-6 h-[160px] flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="w-32 h-6 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="w-48 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
        <div className="bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800 rounded-[2rem] p-6 h-[160px] flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="w-32 h-6 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="w-48 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
        <div className="bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800 rounded-[2rem] p-6 h-[160px] flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="w-32 h-6 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="w-48 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
        <div className="bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800 rounded-[2rem] p-6 h-[160px] flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="w-32 h-6 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="w-48 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
      </div>

      {/* Budget List Skeletons */}
      <div className="flex flex-col gap-4 mt-4">
        <div className="bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800 rounded-3xl p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="w-48 h-6 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="w-24 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          </div>
          <div className="h-[2px] bg-slate-200/40 dark:bg-slate-700/40" />
          <div className="flex flex-col gap-3">
            <div className="w-full h-4 bg-slate-200/50 dark:bg-slate-700/50 rounded" />
            <div className="w-3/4 h-4 bg-slate-200/50 dark:bg-slate-700/50 rounded" />
          </div>
        </div>
        <div className="bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800 rounded-3xl p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="w-48 h-6 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="w-24 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          </div>
          <div className="h-[2px] bg-slate-200/40 dark:bg-slate-700/40" />
          <div className="flex flex-col gap-3">
            <div className="w-full h-4 bg-slate-200/50 dark:bg-slate-700/50 rounded" />
            <div className="w-3/4 h-4 bg-slate-200/50 dark:bg-slate-700/50 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectManagementPageSkeleton() {
  return (
    <div className="w-full h-full flex gap-6 animate-pulse p-6 bg-slate-50/50">
      <div className="w-[360px] bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col gap-4">
        <div className="w-32 h-6 bg-slate-200 rounded" />
        <div className="w-full h-24 bg-slate-100 rounded-xl" />
        <div className="w-full h-24 bg-slate-100 rounded-xl" />
        <div className="w-full h-24 bg-slate-100 rounded-xl" />
      </div>
      <div className="flex-1 bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col gap-6">
        <div className="w-48 h-8 bg-slate-200 rounded" />
        <div className="w-full h-32 bg-slate-100 rounded-xl" />
        <div className="w-full h-64 bg-slate-100 rounded-xl" />
      </div>
    </div>
  );
}

const PortfolioDashboardView = dynamic(() => import('@/components/dashboard/PortfolioDashboardView').then(mod => mod.PortfolioDashboardView), {
  ssr: false,
  loading: () => <PortfolioDashboardViewSkeleton />
});

function MindMap3DSkeleton() {
  return (
    <div className="flex flex-col h-[660px] w-full bg-slate-950 border border-slate-800 rounded-3xl p-6 relative overflow-hidden animate-pulse">
      {/* Top HUD Skeleton */}
      <div className="flex justify-between items-center mb-6 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 rounded-xl" />
          <div className="flex flex-col gap-2">
            <div className="w-36 h-5 bg-slate-800 rounded" />
            <div className="w-48 h-3 bg-slate-800 rounded" />
          </div>
        </div>
        <div className="w-24 h-9 bg-slate-800 rounded-xl" />
      </div>

      {/* Orbit Visualization Mockup */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[100px] h-[100px] border border-slate-800/60 rounded-full" />
        <div className="absolute w-[240px] h-[240px] border border-slate-800/40 rounded-full" />
        <div className="absolute w-[380px] h-[380px] border border-slate-800/20 rounded-full" />
        <div className="absolute w-[500px] h-[500px] border border-slate-800/10 rounded-full" />
      </div>

      {/* Center Status Loader */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 z-10">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-400">3D 마인드맵 시각화 엔진을 구축하는 중...</p>
          <p className="text-[11px] text-slate-600 mt-1">네트워크 분석 및 실시간 궤도 매핑 준비 중</p>
        </div>
      </div>

      {/* Bottom HUD Placeholder */}
      <div className="absolute bottom-6 left-6 right-6 flex justify-between items-center z-10">
        <div className="flex gap-2">
          <div className="w-10 h-10 bg-slate-800 rounded-xl" />
          <div className="w-10 h-10 bg-slate-800 rounded-xl" />
        </div>
        <div className="w-40 h-8 bg-slate-800 rounded-lg" />
        <div className="w-24 h-10 bg-slate-800 rounded-xl" />
      </div>
    </div>
  );
}

const MindMap3D = dynamic(() => import('@/components/MindMap3D').then(mod => mod.MindMap3D), {
  ssr: false,
  loading: () => <MindMap3DSkeleton />
});

const WorkspaceView = dynamic(() => import('@/components/WorkspaceView').then(mod => mod.WorkspaceView), {
  ssr: false,
  loading: () => <WorkspaceViewSkeleton />
});

const ProjectManagementPage = dynamic(() => import('@/components/project/ProjectManagementPage'), {
  ssr: false,
  loading: () => <ProjectManagementPageSkeleton />
});

import BudgetSimulatorSkeleton from '@/components/budget/ui/BudgetSimulatorSkeleton';

const BudgetSimulator = dynamic(() => import('@/components/budget/BudgetSimulator').then(mod => mod.BudgetSimulator), {
  ssr: false,
  loading: () => <BudgetSimulatorSkeleton />
});
import { AlertTriangle, RefreshCw, Sparkles, X } from 'lucide-react';
import { useSecurityLock } from '@/hooks/useSecurityLock';
const SecurityLockScreen = dynamic(() => import('@/components/SecurityLockScreen').then(mod => mod.SecurityLockScreen), {
  ssr: false,
  loading: () => null
});

const AppLogModal = dynamic(() => import('@/components/AppLogModal').then(mod => mod.AppLogModal), {
  ssr: false,
  loading: () => null
});

const AIAssistantModal = dynamic(() => import('@/components/ai/AIAssistantModal').then(mod => mod.AIAssistantModal), {
  ssr: false,
  loading: () => null
});

const CommandPalette = dynamic(() => import('@/components/modals/CommandPalette').then(mod => mod.CommandPalette), {
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

const EMPTY_AI_CONTEXT = {
  signals: [],
  budgetEntries: [],
  budgetCategories: [],
  customNodes: [],
  customEdges: [],
  deletedEdges: [],
  overrides: {},
  keywordMap: {}
};

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
    project: false,
    simulator: false,
  });
  const [isQuickInputOpen, setIsQuickInputOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [buttonBottom, setButtonBottom] = useState<number | null>(null);
  // Hooks
  const { tasks, updateTask, stats: taskStats } = useTasks();
  const { categories: budgetCategories, entries: budgetEntries, addCategory, updateCategory, deleteCategory, replaceCategories, addEntry, updateEntry, deleteEntry, batchUpdateEntries, batchDeleteEntries, batchSettleEntries, getCategoryStats, overallStatsActual } = useBudget();
  const { items: inventoryItems, addItem, updateItem, deleteItem, adjustStock, getItemHistory } = useInventory();
  const { meetings } = useMeetings();
  const { projects } = useProjects();
  const { contacts } = useContacts();
  const { entries: signalEntries, addSignal, deleteSignal, updateSignalKeywords, keywordMap } = useSignal();
  const scheduleAlerts = useScheduleAlerts(tasks, meetings);
  useNotificationAlerts(scheduleAlerts);
  useFreezeDetector(activeModule);

  const handleCloseCommandPalette = useCallback(() => setIsCommandPaletteOpen(false), []);

  // Global keyboard shortcut (Ctrl+K / Cmd+K) to toggle Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isMergedSignalsEnabled = !isInitializingGlobal && (activeModule === 'mindmap' || isQuickInputOpen);
  const { mergedKeywordMap, mergedEntries } = useMergedSignals(signalEntries, keywordMap, tasks, projects, meetings, budgetEntries, inventoryItems, isMergedSignalsEnabled);
  const { customNodes, customEdges, deletedEdges, overrides } = useGraphCustomization(!isInitializingGlobal && activeModule === 'mindmap');

  const actualBudgetEntries = useMemo(() => budgetEntries.filter(e => !e.isPlanned), [budgetEntries]);
  const handleGetCategoryStats = useCallback((id: string) => getCategoryStats(id, true), [getCategoryStats]);
  const handleCloseQuickInput = useCallback(() => setIsQuickInputOpen(false), []);
  const handleToggleQuickInput = useCallback(() => setIsQuickInputOpen(prev => !prev), []);
  const aiContextData = useMemo(() => {
    if (!isQuickInputOpen) return EMPTY_AI_CONTEXT;
    return {
      signals: mergedEntries,
      budgetEntries: budgetEntries,
      budgetCategories: budgetCategories,
      customNodes,
      customEdges,
      deletedEdges,
      overrides,
      keywordMap: mergedKeywordMap
    };
  }, [isQuickInputOpen, mergedEntries, budgetEntries, budgetCategories, customNodes, customEdges, deletedEdges, overrides, mergedKeywordMap]);



  const preloadModule = useCallback((module: ModuleType) => {
    setVisitedModules(prev => {
      if (prev[module]) return prev;
      return { ...prev, [module]: true };
    });
    if (typeof window !== 'undefined') {
      if (module === 'workspace') {
        import('@/components/WorkspaceView');
        import('@/components/budget/BudgetDashboard');
        import('@/components/inventory/InventoryList');
      } else if (module === 'simulator') {
        import('@/components/budget/BudgetSimulator');
      } else if (module === 'mindmap') {
        import('@/components/MindMap3D');
      } else if (module === 'project') {
        import('@/components/project/ProjectManagementPage');
      }
    }
  }, []);

  const preloadModulesOnIdle = useCallback((): { timers: number[]; idleCallbackId: number | null } | null => {
    if (typeof window === 'undefined' || isInitializingGlobal) return null;
    
    // Staggered Preloading: 전역 인트로가 완전히 걷힌 후 세 개의 무거운 모듈 마운트를 requestIdleCallback을 사용하여 시간 차(3.5s, 5.5s, 7.5s)를 두고 조용히 쪼개서 기동
    const timers: number[] = [];
    let idleCallbackId: number | null = null;

    const triggerPreload = (module: ModuleType) => {
      if (module === 'mindmap') {
        import('@/components/MindMap3D');
      } else if (module === 'workspace') {
        import('@/components/WorkspaceView');
        // Pre-trigger dynamic imports for sub-chunks during idle to eliminate 2-stage loading waterfall
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(() => {
            import('@/components/budget/BudgetDashboard');
            import('@/components/inventory/InventoryList');
          });
        } else {
          import('@/components/budget/BudgetDashboard');
          import('@/components/inventory/InventoryList');
        }
      } else if (module === 'project') {
        import('@/components/project/ProjectManagementPage');
      }
      console.log(`[Watcher Preload] Background caching initialized for: ${module}`);
    };

    const scheduleModule = (module: ModuleType, delayMs: number) => {
      const timerId = window.setTimeout(() => {
        if ('requestIdleCallback' in window) {
          idleCallbackId = window.requestIdleCallback(() => triggerPreload(module));
        } else {
          triggerPreload(module);
        }
      }, delayMs);
      timers.push(timerId);
    };

    scheduleModule('mindmap', 3500);
    scheduleModule('workspace', 5500);
    scheduleModule('project', 7500);

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
          const cbId = (idleTimer as { idleCallbackId?: number | null }).idleCallbackId;
          if (cbId && 'cancelIdleCallback' in window && typeof cbId === 'number') {
            window.cancelIdleCallback(cbId);
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

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
      window.location.href = '/login';
    } catch (e) {
      console.error('Logout failed', e);
    }
  }, []);

  // Swipe gesture state
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const [, startTabTransition] = useTransition();

  const handleModuleChange = useCallback((module: ModuleType) => {
    startTabTransition(() => {
      setActiveModule(module);
      setVisitedModules(prev => prev[module] ? prev : { ...prev, [module]: true });
      localStorage.setItem('hchps_active_module', module);
    });
  }, []);

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
      const order: ModuleType[] = ['dashboard', 'workspace', 'simulator', 'mindmap', 'project'];
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
        setVisitedModules(prev => prev['mindmap'] ? prev : { ...prev, mindmap: true });
      }
    };
    window.addEventListener('wiki:openNode', handleOpenWiki as EventListener);
    return () => window.removeEventListener('wiki:openNode', handleOpenWiki as EventListener);
  }, [activeModule]);

  const handleRenameCategory = useCallback((oldName: string, newName: string) => {
    const rawOld = oldName.startsWith('#') ? oldName.slice(1) : oldName;
    const rawNew = newName.startsWith('#') ? newName.slice(1) : newName;
    
    // update Tasks
    tasks.forEach(t => {
      if (t.tags.includes(rawOld)) {
        updateTask(t.id, { tags: t.tags.map(tag => tag === rawOld ? rawNew : tag) });
      }
    });
  }, [tasks, updateTask]);

  const handleDeleteCategory = useCallback((name: string) => {
    const rawName = name.startsWith('#') ? name.slice(1) : name;
    tasks.forEach(t => {
      if (t.tags.includes(rawName)) {
        updateTask(t.id, { tags: t.tags.filter(tag => tag !== rawName) });
      }
    });
  }, [tasks, updateTask]);



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
        onOpenLogs={() => setIsLogsOpen(true)}
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
                        : activeModule === 'simulator'
                        ? '예산 시뮬레이터'
                        : activeModule === 'project' 
                        ? '사업관리' 
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
                  budgetEntries={actualBudgetEntries}
                  addCategory={addCategory}
                  updateCategory={updateCategory}
                  deleteCategory={deleteCategory}
                  replaceCategories={replaceCategories}
                  addEntry={addEntry}
                  updateEntry={updateEntry}
                  deleteEntry={deleteEntry}
                  batchUpdateEntries={batchUpdateEntries}
                  batchDeleteEntries={batchDeleteEntries}
                  batchSettleEntries={batchSettleEntries}
                  getCategoryStats={handleGetCategoryStats}
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

            {/* Project Management */}
            {visitedModules.project && (
              <div className={activeModule === 'project' ? 'block' : 'hidden'}>
                <ProjectManagementPage />
              </div>
            )}

            {/* Budget Simulator */}
            {visitedModules.simulator && (
              <div className={activeModule === 'simulator' ? 'block' : 'hidden'}>
                <BudgetSimulator />
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

      {isLogsOpen && (
        <AppLogModal 
          isOpen={isLogsOpen}
          onClose={() => setIsLogsOpen(false)}
          appMode={appMode}
        />
      )}

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={handleCloseCommandPalette}
        onSelectModule={handleModuleChange}
        tasks={tasks}
        budgetEntries={budgetEntries}
        budgetCategories={budgetCategories}
        inventoryItems={inventoryItems}
        contacts={contacts}
        projects={projects}
        meetings={meetings}
      />

      {/* Floating LLM Button & Popover */}
      <div 
        className="fixed bottom-24 sm:bottom-8 right-4 sm:right-8 z-50 flex flex-col items-end gap-3"
        style={buttonBottom !== null ? { bottom: `${buttonBottom}px` } : undefined}
      >
        {isQuickInputOpen && (
          <AIAssistantModal 
            isOpen={isQuickInputOpen} 
            onClose={handleCloseQuickInput}
            contextData={aiContextData}
            appMode={appMode}
          />
        )}
        <button
          onClick={handleToggleQuickInput}
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
    let timerId: NodeJS.Timeout | undefined;
    let removeTimerId: NodeJS.Timeout | undefined;

    // 클라이언트 마운트 및 PIN 락이 해제되어 활성화된 순간부터 1초 동안만 스플래시 가동
    if (isClient && !isLocked) {
      timerId = setTimeout(() => {
        setIsInitializing(false);
        removeTimerId = setTimeout(() => {
          setShowSplash(false);
        }, 700);
      }, 1000);
    }

    return () => {
      if (timerId) clearTimeout(timerId);
      if (removeTimerId) clearTimeout(removeTimerId);
    };
  }, [isClient, isLocked]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleModeChange = useCallback((_mode: 'HCHPS' | 'VITAL') => {
    setAppMode('VITAL');
  }, []);

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
