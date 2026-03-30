'use client';

import React, { useState } from 'react';
import { BudgetCategory, BudgetEntry, InventoryItem, StockChange } from '@/types';
import { BudgetDashboard } from '@/components/budget/BudgetDashboard';
import { InventoryList } from '@/components/inventory/InventoryList';
import { DocumentGenerator } from '@/components/document/DocumentGenerator';
import { Wallet, Package, FileText } from 'lucide-react';

type SubTab = 'budget' | 'inventory' | 'document';

const subTabs: { id: SubTab; label: string; icon: React.ElementType }[] = [
  { id: 'budget', label: '예산', icon: Wallet },
  { id: 'inventory', label: '재고', icon: Package },
  { id: 'document', label: '기안문', icon: FileText },
];

interface WorkspaceViewProps {
  // Budget
  budgetCategories: BudgetCategory[];
  budgetEntries: BudgetEntry[];
  addCategory: (cat: Omit<BudgetCategory, 'id'>) => BudgetCategory;
  updateCategory: (id: string, updates: Partial<BudgetCategory>) => void;
  deleteCategory: (id: string) => void;
  addEntry: (entry: Omit<BudgetEntry, 'id'>) => void;
  deleteEntry: (id: string) => void;
  getCategoryStats: (id: string) => { totalBudget: number; spent: number; planned: number; remaining: number; usageRate: number } | null;
  overallStats: { totalBudget: number; totalSpent: number; totalPlanned: number; remaining: number };
  // Inventory
  inventoryItems: InventoryItem[];
  addItem: (item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateItem: (id: string, updates: Partial<InventoryItem>) => void;
  deleteItem: (id: string) => void;
  adjustStock: (itemId: string, change: number, reason: string) => void;
  getItemHistory: (itemId: string) => StockChange[];
}

export function WorkspaceView(props: WorkspaceViewProps) {
  const [activeTab, setActiveTab] = useState<SubTab>('budget');

  const renderSubContent = () => {
    switch (activeTab) {
      case 'budget':
        return (
          <BudgetDashboard
            categories={props.budgetCategories}
            entries={props.budgetEntries}
            addCategory={props.addCategory}
            updateCategory={props.updateCategory}
            deleteCategory={props.deleteCategory}
            addEntry={props.addEntry}
            deleteEntry={props.deleteEntry}
            getCategoryStats={props.getCategoryStats}
            overallStats={props.overallStats}
          />
        );

      case 'inventory':
        return (
          <InventoryList
            items={props.inventoryItems}
            addItem={props.addItem}
            updateItem={props.updateItem}
            deleteItem={props.deleteItem}
            adjustStock={props.adjustStock}
            getItemHistory={props.getItemHistory}
          />
        );

      case 'document':
        return <DocumentGenerator />;

      default:
        return null;
    }
  };

  return (
    <>
      <div className="flex items-center gap-1 sm:gap-2 mb-6 border-b border-[var(--color-border-light)] pb-3 overflow-x-auto no-scrollbar touch-pan-x">
        {subTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-3 text-[13px] sm:text-[15px] font-medium cursor-pointer transition-all border-b-2 -mb-[13px] whitespace-nowrap ${
                isActive
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:border-gray-200'
              }`}
              title={tab.label}
            >
              <Icon size={18} className="sm:w-[20px] sm:h-[20px]" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {renderSubContent()}
    </>
  );
}
