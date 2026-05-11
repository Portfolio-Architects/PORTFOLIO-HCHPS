'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BudgetCategory, BudgetEntry, BudgetActionType, generateId } from '@/types';
import { useBudgetFilters } from '@/hooks/useBudgetFilters';
import { Card, CardContent } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Modal } from '@/components/ui/modal';
import { Plus, Pencil, Trash2, CheckCircle2, AlertOctagon, ShieldAlert, RefreshCw, Search, FilePlus2, ChevronDown, ChevronLeft, ChevronRight, X, FileCheck, Upload } from 'lucide-react';
import { replaceAll } from '@/lib/sheets-api';
import { MultiSelectDropdown } from './ui/MultiSelectDropdown';
import { PolicyGroupCard, ACTION_TYPE_CONFIG } from './ui/PolicyGroupCard';
import { BudgetRules } from '@/lib/budget-rules';
import { LedgerModal } from './ui/LedgerModal';
import { CategoryEditModal } from './ui/CategoryEditModal';
import { BatchEditModal } from './ui/BatchEditModal';
import { ExpenseEntryModal } from './ui/ExpenseEntryModal';
import { extractAmount } from '@/lib/korean-nlp';
import { extractTextFromPdfBuffer } from '@/lib/pdf-parser';

interface BudgetDashboardProps {
  categories: BudgetCategory[];
  entries: BudgetEntry[];
  addCategory: (cat: Omit<BudgetCategory, 'id'>) => BudgetCategory;
  updateCategory: (id: string, updates: Partial<BudgetCategory>) => void;
  deleteCategory: (id: string) => void;
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
  addKnowledge?: (k: { title: string; content: string; category: string; tags: string[] }) => void;
}

function formatN(n: number) { return n.toLocaleString('ko-KR'); }

const COLORS = [
  '#4F46E5', '#059669', '#EAB308', '#DC2626', '#7C3AED', '#0891B2', '#EA580C', '#BE185D', '#16A34A', '#2563EB', '#9333EA', '#B45309', '#0284C7', '#86198F', '#4D7C0F'
];

export function BudgetDashboard(props: BudgetDashboardProps) {
  const { categories, entries, addCategory, updateCategory, deleteCategory, addEntry, updateEntry, deleteEntry, getCategoryStats, overallStats } = props;

  const [showCatModal, setShowCatModal] = useState(false);
  const [catModalInitialData, setCatModalInitialData] = useState<Partial<BudgetCategory> | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryModalInitialData, setEntryModalInitialData] = useState<Partial<BudgetEntry> | null>(null);
  const [selectedCatId, setSelectedCatId] = useState<string>('');

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchCats, setBatchCats] = useState<BudgetCategory[]>([]);
  const [batchTitle, setBatchTitle] = useState('');
  
  const [returnToEntryModal, setReturnToEntryModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);

  const {
    filterPolicy, setFilterPolicy,
    filterUnit, setFilterUnit,
    filterDetail, setFilterDetail,
    filterStat, setFilterStat,
    isLoaded,
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
      addCategory(updates as any);
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
      <div className="bg-[var(--color-card)] border border-[var(--color-border-light)] p-3 rounded-xl shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="text-sm font-bold text-gray-700">다중 필터링 시스템</div>
          <div className="flex items-center gap-2">
            <button onClick={handleSaveFilters} className="text-xs px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg font-medium hover:bg-blue-100 transition-colors">
              구성 저장하기
            </button>
            <button onClick={handleResetFilters} className="text-xs px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center gap-1.5">
              <RefreshCw size={14} /> 초기화 및 해제
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
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 flex flex-col h-full justify-between">
          <div className="text-[13px] font-medium text-slate-400 mb-3 tracking-wide flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div> 전체 예산 현황</div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">{formatN(filteredStats.totalBudget)}<span className="text-lg font-medium text-slate-400 ml-1">원</span></div>
            <div className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-slate-700 border border-slate-600 text-[13px] text-slate-200 font-medium">
              총 지출액 <span className="font-bold text-white ml-1">{formatN(filteredStats.totalSpent)}</span>원
            </div>
          </div>
        </div>
        
        {/* Card 2: General Account */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col h-full justify-between">
          <div className="text-[13px] font-bold text-blue-600 mb-3 tracking-wide flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> 일반 계좌 (일상경비 제외)</div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-800 tracking-tight mb-1">{formatN(filteredStats.remaining - filteredStats.dailyExpenseRemaining)}<span className="text-base font-bold text-gray-500 ml-1">잔여</span></div>
            <div className="flex flex-col gap-1 mt-3">
              <div className="flex justify-between items-center text-[13px] bg-gray-50 px-3 py-2 rounded border border-gray-100">
                <span className="text-gray-500 font-medium">일반 지출</span>
                <span className="font-bold text-gray-700">{formatN(filteredStats.totalSpent - filteredStats.dailyExpenseIssued)}원</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Daily Expense Issuance */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col h-full justify-between">
          <div className="text-[13px] font-bold text-amber-600 mb-2 tracking-wide flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> 일상경비 이체내역</div>
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="bg-gray-50 rounded p-2.5 border border-gray-100 flex justify-between items-center">
              <div className="text-[11px] text-gray-500 font-bold">교부액 (원금)</div>
              <div className="text-[13px] font-bold text-gray-700">{formatN(filteredStats.dailyExpenseIssued)}원</div>
            </div>
            <div className="bg-gray-50 rounded p-2.5 border border-gray-100 flex justify-between items-center">
              <div className="text-[11px] text-gray-500 font-bold">실지출액</div>
              <div className="text-[13px] font-bold text-gray-700">{formatN(filteredStats.dailyExpenseSpent)}원</div>
            </div>
            <div className="bg-amber-50 rounded p-2.5 border border-amber-200 flex justify-between items-center shadow-sm">
              <div className="text-[11px] text-amber-800 font-bold">가용 잔액</div>
              <div className="text-[14px] font-black text-amber-700">{formatN(filteredStats.dailyExpenseRemaining)}원</div>
            </div>
          </div>
        </div>

        {/* Card 4: Total Available Remaining */}
        <div className="bg-teal-700 rounded-xl border border-teal-800 p-5 flex flex-col h-full justify-between shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[14px] font-bold text-teal-50 tracking-wide flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-300"></div> 총 가용 잔액
            </div>
            <button onClick={() => setShowLedgerModal(true)} className="flex items-center gap-1.5 text-[12px] bg-teal-800 hover:bg-teal-900 text-white px-3 py-1.5 rounded transition-colors font-bold border border-teal-600 shadow-sm">
              <Search size={14} /> 상세 대조
            </button>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-sm">{formatN(filteredStats.remaining)}<span className="text-xl font-semibold text-teal-100 ml-1">원</span></div>
            <div className="mt-3 text-[11px] text-teal-100 font-medium bg-teal-800/50 p-2 rounded border border-teal-600/50 border-dashed">원장대조 버튼으로 영수증 누락을 확인하세요.</div>
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
      />
    </div>
  );
}
