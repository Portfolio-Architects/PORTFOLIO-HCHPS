'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { BudgetCategory, BudgetEntry, InventoryItem, StockChange } from '@/types';
function BudgetDashboardSkeleton() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      <div className="h-10 bg-slate-200/60 dark:bg-slate-800/40 rounded-xl w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 bg-slate-200/60 dark:bg-slate-800/40 rounded-[2rem]" />
        ))}
      </div>
      <div className="h-64 bg-slate-200/60 dark:bg-slate-800/40 rounded-[2rem]" />
    </div>
  );
}

const BudgetDashboard = dynamic(
  () => import('@/components/budget/BudgetDashboard').then((mod) => mod.BudgetDashboard),
  {
    ssr: false,
    loading: () => <BudgetDashboardSkeleton />,
  }
);
import { CategoryStats } from '@/hooks/useBudget';

function InventoryListSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="h-7 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg w-32" />
        <div className="h-10 bg-slate-200/60 dark:bg-slate-800/40 rounded-xl w-28" />
      </div>
      <div className="glass-panel rounded-[2rem] p-5 border border-slate-200/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="h-10 bg-slate-200/60 dark:bg-slate-800/40 rounded-xl flex-1" />
        <div className="flex gap-1.5 items-center">
          <div className="h-8 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg w-12" />
          <div className="h-8 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg w-16" />
          <div className="h-8 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg w-16" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-panel rounded-[2rem] border border-slate-200/60 p-5 h-[245px] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <div className="space-y-2">
                  <div className="h-5 bg-slate-200/60 dark:bg-slate-800/40 rounded w-28" />
                  <div className="h-4 bg-slate-200/60 dark:bg-slate-800/40 rounded w-16" />
                </div>
                <div className="flex gap-1">
                  <div className="h-6 w-6 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg" />
                  <div className="h-6 w-6 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg" />
                </div>
              </div>
              <div className="h-16 bg-slate-100/70 dark:bg-slate-800/30 rounded-2xl p-4 mb-4 border border-slate-100/50 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="h-3 bg-slate-200/60 dark:bg-slate-800/40 rounded w-14" />
                  <div className="h-6 bg-slate-200/60 dark:bg-slate-800/40 rounded w-20" />
                </div>
                <div className="h-6 bg-slate-200/60 dark:bg-slate-800/40 rounded-xl w-16" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-8 bg-slate-200/60 dark:bg-slate-800/40 rounded-xl flex-1" />
              <div className="h-8 bg-slate-200/60 dark:bg-slate-800/40 rounded-xl flex-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const InventoryList = dynamic(
  () => import('@/components/inventory/InventoryList').then((mod) => mod.InventoryList),
  {
    ssr: false,
    loading: () => <InventoryListSkeleton />,
  }
);

interface WorkspaceViewProps {
  // Budget
  budgetCategories: BudgetCategory[];
  budgetEntries: BudgetEntry[];
  addCategory: (cat: Omit<BudgetCategory, 'id'>) => BudgetCategory;
  updateCategory: (id: string, updates: Partial<BudgetCategory>) => void;
  deleteCategory: (id: string) => void;
  replaceCategories: (cats: BudgetCategory[]) => void;
  addEntry: (entry: Omit<BudgetEntry, 'id'>) => void;
  updateEntry: (id: string, updates: Partial<BudgetEntry>) => void;
  deleteEntry: (id: string) => void;
  getCategoryStats: (id: string) => CategoryStats | null;
  overallStats: { 
    totalBudget: number; totalSpent: number; totalPlanned: number; remaining: number;
    dailyExpenseIssued: number; dailyExpenseSpent: number; dailyExpenseRemaining: number;
  };
  // Inventory (상위 컴포넌트 호환용)
  inventoryItems: InventoryItem[];
  addItem: (item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateItem: (id: string, updates: Partial<InventoryItem>) => void;
  deleteItem: (id: string) => void;
  adjustStock: (itemId: string, change: number, reason: string) => void;
  getItemHistory: (itemId: string) => StockChange[];
  // Signal (상위 컴포넌트 호환용)
  addSignal?: (text: string) => void;
}

function WorkspaceViewComponent(props: WorkspaceViewProps) {
  const [activeTab, setActiveTab] = useState<'budget' | 'inventory'>('budget');
  const [zodError, setZodError] = useState<{ sheetName: string; rowId: string; errors: any } | null>(null);

  useEffect(() => {
    const handleZodError = (e: Event) => {
      const customEvent = e as CustomEvent;
      setZodError(customEvent.detail);
    };
    window.addEventListener('hchps-zod-error', handleZodError);
    return () => {
      window.removeEventListener('hchps-zod-error', handleZodError);
    };
  }, []);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('budget')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-xs sm:text-sm tracking-wide transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'budget'
              ? 'border-indigo-650 text-indigo-650 bg-indigo-50/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          예산 대조보드
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-xs sm:text-sm tracking-wide transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'inventory'
              ? 'border-indigo-650 text-indigo-650 bg-indigo-50/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          홍보물 관리
        </button>
      </div>

      {zodError && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 p-4 rounded-[1.5rem] flex items-center justify-between gap-4 backdrop-blur-md animate-pulse">
          <div className="flex items-center gap-3">
            <span className="text-[20px]">⚠️</span>
            <div className="text-left">
              <p className="font-bold text-[14px] text-amber-200">[데이터 구조 경고] 일부 데이터 무결성이 손상되었습니다.</p>
              <p className="text-[12px] text-amber-300/80 mt-0.5">
                시트: <span className="font-mono font-bold">{zodError.sheetName}</span> (ID: {zodError.rowId}) | 
                안전 디폴트값으로 자동 격리 보정(Sandboxing)되었습니다.
              </p>
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-[1rem] text-[12px] font-bold transition-all shadow-md hover:shadow-lg cursor-pointer shrink-0"
          >
            F5 안전 새로고침 (백업 복구)
          </button>
        </div>
      )}

      {activeTab === 'budget' ? (
        <BudgetDashboard
          categories={props.budgetCategories}
          entries={props.budgetEntries}
          addCategory={props.addCategory}
          updateCategory={props.updateCategory}
          deleteCategory={props.deleteCategory}
          replaceCategories={props.replaceCategories}
          addEntry={props.addEntry}
          updateEntry={props.updateEntry}
          deleteEntry={props.deleteEntry}
          getCategoryStats={props.getCategoryStats}
          overallStats={props.overallStats}
        />
      ) : (
        <InventoryList
          items={props.inventoryItems}
          addItem={props.addItem}
          updateItem={props.updateItem}
          deleteItem={props.deleteItem}
          adjustStock={props.adjustStock}
          getItemHistory={props.getItemHistory}
        />
      )}
    </div>
  );
}

export const WorkspaceView = React.memo(WorkspaceViewComponent);
WorkspaceView.displayName = 'WorkspaceView';

