'use client';

import React from 'react';
import { BudgetCategory, BudgetEntry, InventoryItem, StockChange } from '@/types';
import { BudgetDashboard } from '@/components/budget/BudgetDashboard';

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
  getCategoryStats: (id: string) => { 
    totalBudget: number; spent: number; planned: number; remaining: number; usageRate: number;
    generalSpent: number; dailyExpenseIssued: number; dailyExpenseSpent: number; dailyExpenseRemaining: number;
  } | null;
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
  return (
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
  );
}
