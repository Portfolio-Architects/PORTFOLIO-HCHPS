'use client';

import React, { useState, useEffect } from 'react';
import { BudgetCategory, BudgetEntry, InventoryItem, StockChange } from '@/types';
import { BudgetDashboard } from '@/components/budget/BudgetDashboard';

import { CategoryStats } from '@/hooks/useBudget';

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

export function WorkspaceView(props: WorkspaceViewProps) {
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
    </div>
  );
}
