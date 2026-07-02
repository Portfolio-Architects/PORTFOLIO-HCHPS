'use client';

import React, { useState } from 'react';
import { BudgetCategory, BudgetEntry } from '@/types';
import { useBudgetFilters } from '@/hooks/useBudgetFilters';
import { Card } from '@/components/ui/card';
import { ShieldAlert, RefreshCw, Search, FilePlus2, CircleDollarSign, Wallet, Receipt, ShieldCheck } from 'lucide-react';
import { MultiSelectDropdown } from './ui/MultiSelectDropdown';
import { PolicyGroupCard } from './ui/PolicyGroupCard';
import { LedgerModal } from './ui/LedgerModal';
import { CategoryEditModal } from './ui/CategoryEditModal';
import { BatchEditModal } from './ui/BatchEditModal';
import { ExpenseEntryModal } from './ui/ExpenseEntryModal';
import { DailyExpenseStatModal } from './ui/DailyExpenseStatModal';
import { LawSearchPanel } from './ui/LawSearchPanel';

import { CategoryStats } from '@/hooks/useBudget';

interface BudgetDashboardProps {
  categories: BudgetCategory[];
  entries: BudgetEntry[];
  addCategory: (cat: Omit<BudgetCategory, 'id'>) => BudgetCategory;
  updateCategory: (id: string, updates: Partial<BudgetCategory>) => void;
  deleteCategory: (id: string) => void;
  replaceCategories?: (cats: BudgetCategory[]) => void;
  addEntry: (entry: Omit<BudgetEntry, 'id'>) => void;
  updateEntry: (id: string, updates: Partial<BudgetEntry>) => void;
  deleteEntry: (id: string) => void;
  getCategoryStats: (id: string) => CategoryStats | null;
  overallStats: { 
    totalBudget: number; totalSpent: number; totalPlanned: number; remaining: number;
    dailyExpenseIssued: number; dailyExpenseSpent: number; dailyExpenseRemaining: number;
  };
}

function formatN(n: number) { return n.toLocaleString('ko-KR'); }

export function BudgetDashboard(props: BudgetDashboardProps) {
  const { categories, entries, addCategory, updateCategory, deleteCategory, addEntry, updateEntry, deleteEntry, getCategoryStats } = props;

  const [showCatModal, setShowCatModal] = useState(false);
  const [catModalInitialData, setCatModalInitialData] = useState<Partial<BudgetCategory> | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryModalInitialData, setEntryModalInitialData] = useState<Partial<BudgetEntry> | null>(null);

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchCats, setBatchCats] = useState<BudgetCategory[]>([]);
  const [batchTitle, setBatchTitle] = useState('');
  
  const [returnToEntryModal, setReturnToEntryModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showDailyStatModal, setShowDailyStatModal] = useState(false);

  const {
    filterPolicy, setFilterPolicy,
    filterUnit, setFilterUnit,
    filterDetail, setFilterDetail,
    filterStat, setFilterStat,
    handleSaveFilters,
    handleResetFilters,
    uniquePolicies,
    unitOptions,
    detailOptions,
    statOptions,
    filteredCategoriesTree,
    groupedByPolicy,
    filteredStats
  } = useBudgetFilters(categories, entries, getCategoryStats);

  const handleSaveCategory = (isEdit: boolean, editCatId: string | null, updates: Partial<BudgetCategory>) => {
    if (isEdit && editCatId) {
      updateCategory(editCatId, updates);
    } else {
      addCategory(updates as Omit<BudgetCategory, 'id'>);
    }
  };

  const handleSaveEntry = (isEdit: boolean, editEntryId: string | null, entryData: Partial<BudgetEntry>) => {
    if (isEdit && editEntryId) {
      updateEntry(editEntryId, entryData);
    } else {
      addEntry(entryData as BudgetEntry);
    }
    if (returnToEntryModal) {
      setShowEntryModal(true);
      setReturnToEntryModal(false);
    }
  };

  const handleSettleEntry = (plannedEntryId: string, actualAmount: number) => {
    const plannedEntry = entries.find(e => e.id === plannedEntryId);
    if (!plannedEntry) return;

    // 1. Update the planned entry to isSettled: true
    updateEntry(plannedEntryId, { isSettled: true });

    // 2. Add the actual spent entry
    addEntry({
      categoryId: plannedEntry.categoryId,
      amount: actualAmount,
      date: new Date().toISOString().split('T')[0], // today
      purpose: `${plannedEntry.purpose} (정산)`,
      memo: plannedEntry.memo,
      isPlanned: false,
      isSettled: false,
      relatedPlanId: plannedEntryId,
      actionType: plannedEntry.actionType || 'general',
      linkedSubItemId: plannedEntry.linkedSubItemId,
      docRegNum: plannedEntry.docRegNum,
      fundingSource: plannedEntry.fundingSource
    });
  };

  const handleAddCategory = () => {
    setCatModalInitialData(null);
    setShowCatModal(true);
  };
  const handleEditCategory = (cat: BudgetCategory) => {
    setCatModalInitialData(cat);
    setShowCatModal(true);
  };
  
  const openEditEntry = (entry: BudgetEntry) => {
    setEntryModalInitialData(entry);
    setShowEntryModal(true);
  };

  const openBatchEdit = React.useCallback((title: string, cats: BudgetCategory[]) => {
    setBatchCats(cats);
    setBatchTitle(title);
    setShowBatchModal(true);
  }, []);

  const handleApplyBatchEdit = (updates: Partial<BudgetCategory>, fundingSplits?: { source: string; ratio: string }[]) => {
    batchCats.forEach(c => {
      const finalUpdates = { ...updates };
      
      if (fundingSplits) {
        const newSplitsArray = fundingSplits.map(br => ({
          source: br.source || '기타',
          amount: Math.floor(c.totalBudget * (Number(br.ratio || 0) / 100))
        }));
        
        const sumNewSplits = newSplitsArray.reduce((s, a) => s + a.amount, 0);
        if (newSplitsArray.length > 0 && sumNewSplits !== c.totalBudget) {
          newSplitsArray[0].amount += (c.totalBudget - sumNewSplits);
        }
        finalUpdates.fundingSplits = newSplitsArray;
      }
      
      updateCategory(c.id, finalUpdates);
    });
    setShowBatchModal(false);
  };

  const currentMonth = new Date().getMonth() + 1;
  const isEndOfYearApproaching = currentMonth >= 11;
  
  const riskCategories = React.useMemo(() => {
    return categories.map(cat => {
      const st = getCategoryStats(cat.id);
      if (!st) return null;
      if (currentMonth >= 9 && st.usageRate < 70) return { cat, st, reason: '3분기 집행률 70% 미만' };
      if (isEndOfYearApproaching && (st.remaining / st.totalBudget) >= 0.1) return { cat, st, reason: '회계연도 마감 임박 (가용 잔액 10% 초과)' };
      return null;
    }).filter(Boolean);
  }, [categories, getCategoryStats, currentMonth, isEndOfYearApproaching]);

  return (
    <div className="space-y-6">
      
      {/* Risk Alert Widget */}
      {riskCategories.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-red-700 font-bold">
            <ShieldAlert size={20} />
            <h2>불용액 발생 위험 - 긴급 모니터링 알림</h2>
          </div>
          <p className="text-xs text-red-600 mb-2">다음 사업들은 조기 집행 및 연말 잔액 소진 조치(추경 등)가 강력 권고됩니다.</p>
          <div className="flex flex-col gap-2">
            {riskCategories.map((item, id) => (
              <div key={id} className="flex flex-wrap items-center justify-between text-xs bg-white/50 px-3 py-2 rounded-lg">
                <span className="font-semibold text-gray-800">[{item?.cat.name}]</span>
                <span className="text-red-600 font-medium">{item?.reason}</span>
                <span className="text-gray-600">현재 잔액: <strong className="text-red-700">{formatN(item?.st.remaining ?? 0)}원</strong></span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold">예산 관리</h2>
        <div className="flex gap-2">
          <button onClick={() => { setEntryModalInitialData(null); setShowEntryModal(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer" disabled={categories.length === 0}>
            <FilePlus2 size={16} /> 지출 품의
          </button>
        </div>
      </div>

      {/* Hierarchical Filters */}
      <div className="glass-panel rounded-[2rem] p-5 shadow-2xs border border-white/20">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="text-sm font-bold text-slate-800 tracking-wide">다중 필터링 시스템</div>
          <div className="flex items-center gap-2">
            <button onClick={handleSaveFilters} className="text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold border border-blue-200 transition-all cursor-pointer shadow-3xs">
              구성 저장하기
            </button>
            <button onClick={handleResetFilters} className="text-xs px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg font-semibold border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs">
              <RefreshCw size={12} /> 초기화 및 해제
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <MultiSelectDropdown label="정책사업명" options={uniquePolicies} selected={filterPolicy} onChange={val => { setFilterPolicy(val); setFilterUnit([]); setFilterDetail([]); setFilterStat([]); }} />
          <MultiSelectDropdown label="단위사업명" options={unitOptions} selected={filterUnit} onChange={val => { setFilterUnit(val); setFilterDetail([]); setFilterStat([]); }} disabled={unitOptions.length === 0} />
          <MultiSelectDropdown label="세부사업명" options={detailOptions} selected={filterDetail} onChange={val => { setFilterDetail(val); setFilterStat([]); }} disabled={detailOptions.length === 0} />
          <MultiSelectDropdown label="통계목" options={statOptions} selected={filterStat} onChange={val => setFilterStat(val)} disabled={statOptions.length === 0} />
        </div>
      </div>

      {/* Overall Summary (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        
        {/* Card 1: Total Budget */}
        <div className="glass-panel-dark rounded-[2rem] p-6 flex flex-col h-full justify-between shadow-2xs hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-semibold text-slate-400 tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50"></span> 전체 예산 현황
            </span>
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-indigo-400 group-hover:scale-110 transition-transform duration-300">
              <CircleDollarSign size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3 font-mono">
              {formatN(filteredStats.totalBudget)}
              <span className="text-sm font-medium text-slate-400 ml-1">원</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/80 text-xs text-slate-300 font-medium">
              총 집행액 <span className="font-semibold text-white ml-1">{formatN(filteredStats.totalSpent)}</span>원
            </div>
          </div>
        </div>
        
        {/* Card 2: General Account */}
        <div className="glass-panel rounded-[2rem] p-6 flex flex-col h-full justify-between shadow-2xs hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-semibold text-blue-600 tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50"></span> 일반 계좌 (일상경비 제외)
            </span>
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-100 text-blue-500 group-hover:scale-110 transition-transform duration-300">
              <Wallet size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight mb-3 font-mono">
              {formatN(filteredStats.remaining - filteredStats.dailyExpenseRemaining)}
              <span className="text-sm font-bold text-gray-500 ml-1">원 잔여</span>
            </div>
            <div className="flex justify-between items-center text-xs bg-gray-50/80 px-3 py-2 rounded-xl border border-gray-100 text-gray-500 font-medium">
              <span>일반 지출</span>
              <span className="font-semibold text-gray-700">{formatN(filteredStats.totalSpent - filteredStats.dailyExpenseIssued)}원</span>
            </div>
          </div>
        </div>

        {/* Card 3: Daily Expense Issuance */}
        <div className="glass-panel rounded-[2rem] p-5 flex flex-col h-full justify-between shadow-2xs hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex justify-between items-start mb-3">
            <span className="text-sm font-semibold text-amber-600 tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50"></span> 일상경비 이체내역
            </span>
            <div className="flex gap-2 items-center">
              <button 
                onClick={() => setShowDailyStatModal(true)} 
                className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 px-2 py-1 rounded-lg transition-colors font-bold border border-amber-200 flex items-center gap-1 cursor-pointer shadow-3xs"
              >
                통계목별
              </button>
              <div className="p-2 rounded-xl bg-amber-50 border border-amber-100 text-amber-500 group-hover:scale-110 transition-transform duration-300">
                <Receipt size={18} />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="bg-gray-50/80 rounded-xl p-2 border border-gray-100 flex justify-between items-center text-xs">
              <span className="text-gray-500 font-bold">교부액 (원금)</span>
              <span className="font-semibold text-gray-700 font-mono">{formatN(filteredStats.dailyExpenseIssued)}원</span>
            </div>
            <div className="bg-gray-50/80 rounded-xl p-2 border border-gray-100 flex justify-between items-center text-xs">
              <span className="text-gray-500 font-bold">실지출액</span>
              <span className="font-semibold text-gray-700 font-mono">{formatN(filteredStats.dailyExpenseSpent)}원</span>
            </div>
            <div className="bg-amber-50/80 rounded-xl p-2 border border-amber-100 flex justify-between items-center text-xs shadow-3xs">
              <span className="text-amber-800 font-bold">가용 잔액</span>
              <span className="font-bold text-amber-700 font-mono">{formatN(filteredStats.dailyExpenseRemaining)}원</span>
            </div>
          </div>
        </div>

        {/* Card 4: Total Available Remaining */}
        <div className="bg-gradient-to-br from-teal-700 to-emerald-800 rounded-[2rem] p-6 flex flex-col h-full justify-between shadow-2xs hover:shadow-lg hover:shadow-teal-600/25 hover:-translate-y-1 transition-all duration-300 group border border-teal-600/50">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-semibold text-teal-100 tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-300 shadow-sm shadow-teal-300/50"></span> 총 가용 잔액
            </span>
            <div className="flex gap-2 items-center">
              <button 
                onClick={() => setShowLedgerModal(true)} 
                className="flex items-center gap-1 bg-teal-800 hover:bg-teal-900 text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors font-bold border border-teal-600 shadow-3xs cursor-pointer"
              >
                <Search size={12} /> 상세 대조
              </button>
              <div className="p-2 rounded-xl bg-teal-800/80 border border-teal-600 text-teal-300 group-hover:scale-110 transition-transform duration-300">
                <ShieldCheck size={18} />
              </div>
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight drop-shadow-sm mb-3 font-mono">
              {formatN(filteredStats.remaining)}
              <span className="text-sm font-semibold text-teal-200 ml-1">원</span>
            </div>
            <div className="text-[11px] text-teal-100 font-medium bg-teal-900/40 p-2 rounded-xl border border-teal-600/30 border-dashed">
              원장대조 버튼으로 영수증 누락을 확인하세요.
            </div>
          </div>
        </div>
      </div>

      {/* Categories */}
      {categories.length === 0 ? (
        <Card><div className="px-5 py-10 text-center text-sm text-[var(--color-text-tertiary)]">예산 과목을 추가해 보세요</div></Card>
      ) : (
        <div className="space-y-3">
          {groupedByPolicy.length === 0 && <div className="text-center text-sm text-gray-500 py-8">선택된 필터에 해당하는 예산 과목이 없습니다.</div>}
          {groupedByPolicy.map(group => (
            <PolicyGroupCard
              key={group.policyName}
              group={group}
              entries={entries}
              getCategoryStats={getCategoryStats}
              deleteCategory={deleteCategory}
              deleteEntry={deleteEntry}
              openEditCat={handleEditCategory}
              openAddCat={handleAddCategory}
              openEditEntry={openEditEntry}
              openBatchEdit={openBatchEdit}
              updateCategory={updateCategory}
              hidePolicyHeader={filterDetail.length > 0}
            />
          ))}
        </div>
      )}

      {/* Law & Ordinance Search API Integration */}
      <LawSearchPanel />

      {/* Category Modal */}
      <CategoryEditModal
        isOpen={showCatModal}
        onClose={() => {
          setShowCatModal(false);
          if (returnToEntryModal) { setShowEntryModal(true); setReturnToEntryModal(false); }
        }}
        categoriesLength={categories.length}
        initialData={catModalInitialData}
        onSave={handleSaveCategory}
      />

      {/* Batch Edit Modal */}
      <BatchEditModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        title={batchTitle}
        categories={batchCats}
        onApply={handleApplyBatchEdit}
      />

      {/* Expense Entry Modal */}
      <ExpenseEntryModal
        isOpen={showEntryModal}
        onClose={() => setShowEntryModal(false)}
        categories={categories}
        entries={entries}
        getCategoryStats={getCategoryStats}
        initialData={entryModalInitialData}
        onSave={handleSaveEntry}
        onOpenCategoryModal={() => {
          setShowEntryModal(false);
          setReturnToEntryModal(true);
          setCatModalInitialData(null);
          setShowCatModal(true);
        }}
      />

      {/* Ledger Modal */}
      <LedgerModal
        isOpen={showLedgerModal}
        onClose={() => setShowLedgerModal(false)}
        categories={categories}
        entries={entries}
        getCategoryStats={getCategoryStats}
        onSettle={handleSettleEntry}
      />

      {/* Daily Expense Stat Modal */}
      <DailyExpenseStatModal
        isOpen={showDailyStatModal}
        onClose={() => setShowDailyStatModal(false)}
        categories={filteredCategoriesTree}
        getCategoryStats={getCategoryStats}
      />
    </div>
  );
}
