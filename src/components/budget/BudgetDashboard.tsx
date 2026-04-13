'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { BudgetCategory, BudgetEntry, BudgetActionType, generateId } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Modal } from '@/components/ui/modal';
import { Plus, Pencil, Trash2, CheckCircle2, AlertOctagon, ShieldAlert, RefreshCw, Search, FilePlus2, ChevronDown } from 'lucide-react';
import { replaceAll } from '@/lib/sheets-api';
import { MultiSelectDropdown } from './ui/MultiSelectDropdown';
import { PolicyGroupCard, ACTION_TYPE_CONFIG } from './ui/PolicyGroupCard';
import { useBudgetAI } from './model/useBudgetAI';

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
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [catName, setCatName] = useState('');
  const [catBudget, setCatBudget] = useState('');
  
  const [catPolicy, setCatPolicy] = useState('');
  const [catUnit, setCatUnit] = useState('');
  const [catDetail, setCatDetail] = useState('');
  const [catStat, setCatStat] = useState('');

  const [filterPolicy, setFilterPolicy] = useState<string[]>([]);
  const [filterUnit, setFilterUnit] = useState<string[]>([]);
  const [filterDetail, setFilterDetail] = useState<string[]>([]);
  const [filterStat, setFilterStat] = useState<string[]>([]);

  const [nationalFund, setNationalFund] = useState('');
  const [localFund, setLocalFund] = useState('');
  
  const [entryAmount, setEntryAmount] = useState('');
  const [entryPurpose, setEntryPurpose] = useState('');
  const [entryDocNum, setEntryDocNum] = useState('');
  const [entryMemo, setEntryMemo] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editEntryId, setEditEntryId] = useState<string | null>(null);
  const [returnToEntryModal, setReturnToEntryModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [actionType, setActionType] = useState<BudgetActionType>('general');

  const [isLoaded, setIsLoaded] = useState(false);

  // Auto-Migration for Legacy Nomenclature
  useEffect(() => {
    let migrated = false;
    categories.forEach(cat => {
      let updatedName = cat.name;
      if (updatedName && updatedName.includes('건강생활실천공통')) {
        updatedName = updatedName.replace('건강생활실천공통', '건강생활실천사업(건강증진)');
      }
      if (updatedName && updatedName.includes('건강생활실천(건강증진)')) {
        updatedName = updatedName.replace('건강생활실천(건강증진)', '건강생활실천사업(건강증진)');
      }
      
      if (cat.name !== updatedName) {
        updateCategory(cat.id, { ...cat, name: updatedName });
        migrated = true;
      }
    });
    if (migrated) console.info('[Migration] Legacy category nomenclature updated.');
  }, [categories, updateCategory]);

  const { isParsingPdf, handlePdfUpload } = useBudgetAI({
    categories,
    onSuccess: (data) => {
      if (data.categoryId) setSelectedCatId(data.categoryId);
      if (data.amount) setEntryAmount(data.amount);
      if (data.purpose) setEntryPurpose(data.purpose);
      if (data.docNum) setEntryDocNum(data.docNum);
      if (data.date) setEntryDate(data.date);
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('hchps-budget-filters-v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.policy)) setFilterPolicy(parsed.policy);
        if (Array.isArray(parsed.unit)) setFilterUnit(parsed.unit);
        if (Array.isArray(parsed.detail)) setFilterDetail(parsed.detail);
        if (Array.isArray(parsed.stat)) setFilterStat(parsed.stat);
      }
    } catch (e) {}
    setIsLoaded(true);
  }, []);

  const handleSaveFilters = () => {
    localStorage.setItem('hchps-budget-filters-v2', JSON.stringify({
      policy: filterPolicy,
      unit: filterUnit,
      detail: filterDetail,
      stat: filterStat
    }));
    alert('✅ 현재 필터링 상태가 저장되었습니다. 앞으로 페이지 접속 시 이 필터가 유지됩니다.');
  };

  const handleResetFilters = () => {
    setFilterPolicy([]);
    setFilterUnit([]);
    setFilterDetail([]);
    setFilterStat([]);
    localStorage.removeItem('hchps-budget-filters-v2');
  };
  const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow";
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim() || !catBudget) return;

    // 매칭비율 3:7 검증 로직 (전체 예산 입력 & 국비/시비 입력 시)
    if (nationalFund && localFund) {
      const nat = Number(nationalFund);
      const loc = Number(localFund);
      const total = Number(catBudget);
      if (nat + loc !== total) {
        alert('Error: 국비와 지방비의 합이 총 예산과 일치하지 않습니다.');
        return;
      }
      const natRatio = nat / total;
      if (Math.abs(natRatio - 0.3) > 0.05) {
        alert('Warning: 서울시 통합건강증진사업 지침에 따른 [국비 30% : 지방비 70%] 매칭 비율을 충족하지 않습니다. 계속 진행하시겠습니까?');
      }
    }

    if (editCatId) {
      updateCategory(editCatId, { name: catName, totalBudget: Number(catBudget), policyProject: catPolicy, unitProject: catUnit, detailedProject: catDetail, statItem: catStat });
    } else {
      addCategory({ name: catName, totalBudget: Number(catBudget), color: COLORS[categories.length % COLORS.length], policyProject: catPolicy, unitProject: catUnit, detailedProject: catDetail, statItem: catStat });
    }
    setCatName(''); setCatBudget(''); setNationalFund(''); setLocalFund('');
    setCatPolicy(''); setCatUnit(''); setCatDetail(''); setCatStat('');
    setEditCatId(null); setShowCatModal(false);
  };

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryAmount || !entryPurpose.trim() || !selectedCatId) return;
    
    // 예산 지침 컴플라이언스 룰 검증
    const targetCat = categories.find(c => c.id === selectedCatId);
    const stats = targetCat ? getCategoryStats(targetCat.id) : null;
    const reqAmount = Number(entryAmount.replace(/,/g, ''));
    
    // 0. 중복 지출 방지 (최근 7일 내 동일 예산과목 & 동일 금액)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const isDuplicate = !editEntryId && entries.some(e => 
      e.categoryId === selectedCatId && 
      e.amount === reqAmount &&
      e.date >= sevenDaysAgo
    );

    if (isDuplicate) {
      if (!window.confirm(`[경고] 최근 7일 내에 동일한 금액(${formatN(reqAmount)}원)이 같은 과목으로 지출된 이력이 있습니다.\n중복 등록입니까? 그래도 진행하시겠습니까?`)) {
        return;
      }
    }

    // 1. 가용 잔액 확인
    if (stats) {
      let adjRemaining = stats.remaining;
      let adjDailyRemaining = stats.dailyExpenseRemaining;

      if (editEntryId) {
        const original = entries.find(e => e.id === editEntryId);
        // 만약 수정 모드이고, 대상 과목이 바뀌지 않았다면 기존 금액을 잔액에 환원 파싱함 (=수정된 차액만 검증)
        if (original && original.categoryId === selectedCatId) {
          if (original.actionType === 'general' || original.actionType === 'issuance') {
            adjRemaining += original.amount;
          } else if (original.actionType === 'daily_expense') {
            adjDailyRemaining += original.amount;
          }
        }
      }

      if (actionType === 'general' || actionType === 'issuance') {
        if (reqAmount > adjRemaining) {
          alert(`Error: 일반 예산 잔액이 부족합니다. (현재 가용 실 잔액: ${formatN(adjRemaining)}원)`);
          return;
        }
      } else if (actionType === 'daily_expense') {
        if (reqAmount > adjDailyRemaining) {
          alert(`Error: 일상경비 통장 가용 잔액이 부족합니다. (현재 가용 잔액: ${formatN(adjDailyRemaining)}원)`);
          return;
        }
      }
    }

    // 2. 금지 비목 차단 (블랙리스트)
    if (entryPurpose.includes('자산취득') || entryPurpose.includes('컴퓨터') || entryPurpose.includes('장비') || targetCat?.name.includes('자산취득비') || targetCat?.name.includes('인건비')) {
      alert('Error: 통합건강증진사업 지침상 자산취득성 사업비 및 인건비 편성이 불가합니다.');
      return;
    }

    // 3. 오분류 방지
    if (entryPurpose.includes('자문료') || entryPurpose.includes('속기료') || entryPurpose.includes('사례금') || entryPurpose.includes('수수료')) {
      if (!targetCat?.name.includes('일반수용비') && !targetCat?.name.includes('210-01')) {
        alert("Error: 지침 위반. 전문가 자문 등은 반드시 '일반수용비(210-01목)'로 집행해야 합니다.");
        return;
      }
    }

    // 4. 편법 지출 방지 경고
    if (entryPurpose.includes('일용임금') || entryPurpose.includes('행정보조')) {
      if (!window.confirm("Warning: 계속 고용 금지 및 중복 계상 금지 지침 재확인 요망. 불필요한 일용인력 계속 고용은 감사 대상입니다. 계속 진행할까요?")) {
        return;
      }
    }

    if (editEntryId) {
      updateEntry(editEntryId, {
        categoryId: selectedCatId,
        amount: reqAmount,
        date: entryDate,
        purpose: entryPurpose,
        memo: entryMemo,
        actionType,
        docRegNum: entryDocNum,
      });
    } else {
      addEntry({
        categoryId: selectedCatId,
        amount: reqAmount,
        date: entryDate,
        purpose: entryPurpose,
        memo: entryMemo,
        actionType,
        docRegNum: entryDocNum,
      });
    }
    closeEntryModal();
  };

  const closeEntryModal = () => {
    setEntryAmount(''); setEntryPurpose(''); setEntryMemo(''); setEntryDocNum(''); setEditEntryId(null); setShowEntryModal(false);
  };

  const openEditCat = (cat: BudgetCategory) => {
    setCatName(cat.name); setCatBudget(cat.totalBudget.toString());
    setCatPolicy(cat.policyProject || ''); setCatUnit(cat.unitProject || '');
    setCatDetail(cat.detailedProject || ''); setCatStat(cat.statItem || '');
    setEditCatId(cat.id); setShowCatModal(true);
  };

  const openEntryModal = () => {
    setEditEntryId(null);
    setShowEntryModal(true);
  };

  const handleInlineAddCat = () => {
    setShowEntryModal(false);
    setReturnToEntryModal(true);
    setEditCatId(null);
    setCatName(''); setCatPolicy(''); setCatUnit(''); setCatDetail(''); setCatStat(''); setCatBudget('');
    setShowCatModal(true);
  };

  const handleInlineEditCat = () => {
    const cat = categories.find(c => c.id === selectedCatId);
    if (!cat) return;
    setShowEntryModal(false);
    setReturnToEntryModal(true);
    openEditCat(cat);
  };

  const handleInlineDeleteCat = () => {
    if (!selectedCatId) return;
    if (window.confirm("정말 이 예산 과목을 삭제하시겠습니까? 관련 지출 항목들도 모두 삭제됩니다.")) {
      deleteCategory(selectedCatId);
      setSelectedCatId('');
    }
  };

  const openEditEntry = (entry: BudgetEntry) => {
    setEditEntryId(entry.id);
    setSelectedCatId(entry.categoryId);
    setEntryAmount(entry.amount.toLocaleString('ko-KR'));
    setEntryDate(entry.date);
    setEntryPurpose(entry.purpose);
    setEntryMemo(entry.memo || '');
    setEntryDocNum(entry.docRegNum || '');
    setActionType(entry.actionType || 'general');
    setShowEntryModal(true);
  };

  const currentMonth = new Date().getMonth() + 1;
  const isEndOfYearApproaching = currentMonth >= 11;
  
  // 위험 사업 추출 (집행률 70% 미만이면서 하반기, 또는 연말인데 가용액 10% 이상인 경우)
  const riskCategories = useMemo(() => {
    return categories.map(cat => {
      const st = getCategoryStats(cat.id);
      if (!st) return null;
      if (currentMonth >= 9 && st.usageRate < 70) return { cat, st, reason: '3분기 집행률 70% 미만' };
      if (isEndOfYearApproaching && (st.remaining / st.totalBudget) >= 0.1) return { cat, st, reason: '회계연도 마감 임박 (가용 잔액 10% 초과)' };
      return null;
    }).filter(Boolean);
  }, [categories, getCategoryStats, currentMonth, isEndOfYearApproaching]);

  // Hierarchical Filter Calculation
  const uniquePolicies = useMemo(() => Array.from(new Set(categories.map(c => c.policyProject).filter(Boolean))), [categories]);
  const unitOptions = useMemo(() => Array.from(new Set(categories.filter(c => filterPolicy.length === 0 || filterPolicy.includes(c.policyProject || '')).map(c => c.unitProject).filter(Boolean))), [categories, filterPolicy]);
  const detailOptions = useMemo(() => Array.from(new Set(categories.filter(c => (filterPolicy.length === 0 || filterPolicy.includes(c.policyProject || '')) && (filterUnit.length === 0 || filterUnit.includes(c.unitProject || ''))).map(c => c.detailedProject).filter(Boolean))), [categories, filterPolicy, filterUnit]);
  const statOptions = useMemo(() => Array.from(new Set(categories.filter(c => (filterPolicy.length === 0 || filterPolicy.includes(c.policyProject || '')) && (filterUnit.length === 0 || filterUnit.includes(c.unitProject || '')) && (filterDetail.length === 0 || filterDetail.includes(c.detailedProject || ''))).map(c => c.statItem).filter(Boolean))), [categories, filterPolicy, filterUnit, filterDetail]);

  const filteredCategoriesTree = useMemo(() => {
    return categories.filter(c => {
      if (filterPolicy.length > 0 && !filterPolicy.includes(c.policyProject || '')) return false;
      if (filterUnit.length > 0 && !filterUnit.includes(c.unitProject || '')) return false;
      if (filterDetail.length > 0 && !filterDetail.includes(c.detailedProject || '')) return false;
      if (filterStat.length > 0 && !filterStat.includes(c.statItem || '')) return false;
      return true;
    });
  }, [categories, filterPolicy, filterUnit, filterDetail, filterStat]);

  const groupedByPolicy = useMemo(() => {
    const groups: { policyName: string; cats: BudgetCategory[] }[] = [];
    filteredCategoriesTree.forEach(cat => {
      const policy = cat.policyProject || '분류되지 않음';
      let group = groups.find(g => g.policyName === policy);
      if (!group) {
        group = { policyName: policy, cats: [] };
        groups.push(group);
      }
      group.cats.push(cat);
    });
    return groups;
  }, [filteredCategoriesTree]);

  // Dynamic stats based on selected filters
  const filteredStats = useMemo(() => {
    let totalBudget = 0;
    let remaining = 0;
    let totalSpent = 0;

    let dailyExpenseIssued = 0;
    let dailyExpenseSpent = 0;
    let dailyExpenseRemaining = 0;

    filteredCategoriesTree.forEach(cat => {
      const catStats = getCategoryStats(cat.id);
      if (catStats) {
        totalBudget += catStats.totalBudget;
        remaining += catStats.remaining;
        totalSpent += catStats.spent;
        dailyExpenseIssued += catStats.dailyExpenseIssued;
        dailyExpenseSpent += catStats.dailyExpenseSpent;
        dailyExpenseRemaining += catStats.dailyExpenseRemaining;
      }
    });

    return { totalBudget, remaining, totalSpent, dailyExpenseIssued, dailyExpenseSpent, dailyExpenseRemaining };
  }, [filteredCategoriesTree, getCategoryStats, entries]);

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
          <button onClick={() => openEntryModal()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer" disabled={categories.length === 0}>
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
          <MultiSelectDropdown label="정책사업명" options={uniquePolicies as string[]} selected={filterPolicy} onChange={val => { setFilterPolicy(val); setFilterUnit([]); setFilterDetail([]); setFilterStat([]); }} />
          <MultiSelectDropdown label="단위사업명" options={unitOptions as string[]} selected={filterUnit} onChange={val => { setFilterUnit(val); setFilterDetail([]); setFilterStat([]); }} disabled={unitOptions.length === 0} />
          <MultiSelectDropdown label="세부사업명" options={detailOptions as string[]} selected={filterDetail} onChange={val => { setFilterDetail(val); setFilterStat([]); }} disabled={detailOptions.length === 0} />
          <MultiSelectDropdown label="통계목" options={statOptions as string[]} selected={filterStat} onChange={val => setFilterStat(val)} disabled={statOptions.length === 0} />
        </div>
      </div>

      {/* Overall Summary (4 Premium Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        
        {/* Card 1: Total Budget */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-lg border border-slate-700/50 p-5 group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-slate-700/30 blur-2xl group-hover:bg-slate-600/40 transition-all duration-500"></div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="text-[13px] font-medium text-slate-400 mb-3 tracking-wide flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div> 전체 예산 현황</div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">{formatN(filteredStats.totalBudget)}<span className="text-lg font-medium text-slate-400 ml-1">원</span></div>
              <div className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-[13px] text-slate-300 font-medium backdrop-blur-sm shadow-inner">
                총 지출액 <span className="font-bold text-white ml-1">{formatN(filteredStats.totalSpent)}</span>원
              </div>
            </div>
          </div>
        </div>
        
        {/* Card 2: General Account */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-2xl shadow-sm border border-blue-200/60 p-5 group hover:shadow-md transition-all duration-300 hover:border-blue-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-400/20 to-transparent rounded-full blur-xl transform translate-x-4 -translate-y-4"></div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="text-[13px] font-bold text-blue-700 mb-3 tracking-wide flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> 일반 계좌</div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-gray-800 tracking-tight mb-1">{formatN(filteredStats.remaining)}<span className="text-base font-bold text-gray-500 ml-1">잔여</span></div>
              <div className="flex flex-col gap-1 mt-3">
                <div className="flex justify-between items-center text-[13px] bg-white/50 px-3 py-2 rounded-lg border border-blue-100">
                  <span className="text-gray-500 font-medium">일반 지출</span>
                  <span className="font-bold text-gray-700">{formatN(filteredStats.totalSpent - filteredStats.dailyExpenseIssued)}원</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Daily Expense Issuance */}
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50/40 rounded-2xl shadow-sm border border-amber-200/60 p-5 group hover:shadow-md transition-all duration-300 hover:border-amber-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-400/20 to-transparent rounded-full blur-xl transform translate-x-4 -translate-y-4"></div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="text-[13px] font-bold text-amber-700 mb-3 tracking-wide flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse"></div> 일상경비 이체내역</div>
            <div className="flex flex-col gap-2 mt-1">
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-amber-100 shadow-[0_2px_8px_rgba(245,158,11,0.05)]">
                <div className="text-[11px] text-amber-600 font-bold mb-0.5">교부액 (이체원금)</div>
                <div className="text-lg font-black text-gray-800 tracking-tight">{formatN(filteredStats.dailyExpenseIssued)}<span className="text-xs font-semibold text-gray-500 ml-1">원</span></div>
              </div>
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-amber-100 shadow-[0_2px_8px_rgba(245,158,11,0.05)] flex justify-between items-end">
                <div className="text-[11px] text-gray-500 font-bold mb-0.5">실지출액</div>
                <div className="text-[15px] font-bold text-gray-700">{formatN(filteredStats.dailyExpenseSpent)}<span className="text-[10px] text-gray-400 ml-1">원</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Daily Expense Remaining */}
        <div className="relative overflow-hidden bg-gradient-to-br from-teal-500 to-emerald-700 rounded-2xl shadow-lg border border-teal-600/50 p-5 group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-8 -translate-y-8 group-hover:bg-white/20 transition-all duration-500"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-teal-900/30 rounded-full blur-xl transform -translate-x-8 translate-y-8"></div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[13px] font-bold text-teal-50 tracking-wide flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-teal-300 animate-pulse"></div> 가용 잔액
              </div>
              <button onClick={() => setShowLedgerModal(true)} className="flex items-center gap-1.5 text-[12px] bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-full transition-all duration-200 font-bold backdrop-blur-md border border-white/20 shadow-sm hover:shadow">
                <Search size={14} /> 상세 대조
              </button>
            </div>
            <div>
              <div className="text-3xl font-black text-white tracking-tight drop-shadow-md">{formatN(filteredStats.dailyExpenseRemaining)}<span className="text-base font-semibold text-teal-100 ml-1">원</span></div>
              <div className="mt-2 text-[11px] text-teal-50/80 font-medium">원장대조 버튼으로 영수증 누락을 확인하세요.</div>
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
              openEditCat={openEditCat}
              openEditEntry={openEditEntry}
            />
          ))}
        </div>
      )}

      {/* Category Modal */}
      <Modal isOpen={showCatModal} onClose={() => { 
        setShowCatModal(false); 
        if (returnToEntryModal) { setShowEntryModal(true); setReturnToEntryModal(false); } 
      }} title={editCatId ? '예산 과목 수정' : '새 예산 과목'} size="lg">
        <form onSubmit={handleAddCategory} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">정책사업명</label><input type="text" value={catPolicy} onChange={e => setCatPolicy(e.target.value)} className={inputClass} placeholder="예: 건강도시조성" /></div>
            <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">단위사업명</label><input type="text" value={catUnit} onChange={e => setCatUnit(e.target.value)} className={inputClass} placeholder="예: 찾아가는 보건소" /></div>
            <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">세부사업명</label><input type="text" value={catDetail} onChange={e => setCatDetail(e.target.value)} className={inputClass} placeholder="예: 방문간호운영" /></div>
            <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">통계목</label><input type="text" value={catStat} onChange={e => setCatStat(e.target.value)} className={inputClass} placeholder="예: 일반수용비(210-01)" /></div>
          </div>
          
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">별칭명 (단축 과목명) *</label><input type="text" value={catName} onChange={e => setCatName(e.target.value)} className={inputClass} required placeholder="예: 방문간호 일반수용비" /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">총 예산액 (원) *</label><input type="number" value={catBudget} onChange={e => setCatBudget(e.target.value)} className={inputClass} required placeholder="0" /></div>
          
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
             <div className="text-xs font-bold text-gray-600 mb-2">보건복지부 / 수도권 비율 매칭 검증 (선택)</div>
             <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[11px] text-gray-500 mb-1">국비 (30%)</label><input type="number" value={nationalFund} onChange={e => setNationalFund(e.target.value)} className={inputClass} placeholder="입력" /></div>
                <div><label className="block text-[11px] text-gray-500 mb-1">지방비 (70%)</label><input type="number" value={localFund} onChange={e => setLocalFund(e.target.value)} className={inputClass} placeholder="입력" /></div>
             </div>
          </div>

          <button type="submit" className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">{editCatId ? '수정' : '추가'}</button>
        </form>
      </Modal>

      {/* Entry Modal */}
      <Modal isOpen={showEntryModal} onClose={() => setShowEntryModal(false)} title="지출 등록" size="sm">
        <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
          {(Object.keys(ACTION_TYPE_CONFIG) as BudgetActionType[]).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setActionType(type)}
              className={`flex-1 flex flex-col items-center gap-1 py-1.5 px-1 rounded-md text-[13px] font-bold transition-all ${actionType === type ? 'bg-white text-gray-900 shadow font-black' : 'text-gray-500 hover:bg-gray-200'}`}
            >
              {ACTION_TYPE_CONFIG[type].label}
            </button>
          ))}
        </div>
        <form onSubmit={handleAddEntry} className="space-y-4">
          
          {/* AI Parser Widget */}
          <div className="relative border border-dashed border-blue-200 bg-blue-50/50 rounded-xl p-4 text-center hover:bg-blue-50 transition-colors">
             <input type="file" accept="application/pdf" onChange={handlePdfUpload} disabled={isParsingPdf} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
             <div className="flex flex-col items-center justify-center pointer-events-none">
                {isParsingPdf ? (
                   <div className="flex flex-col items-center gap-2">
                     <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                     <span className="text-xs text-blue-600 font-bold animate-pulse">AI 모델로 실시간 분석 중...</span>
                   </div>
                ) : (
                   <>
                     <div className="text-blue-400 mb-1.5"><FilePlus2 size={24} className="mx-auto" /></div>
                     <div className="text-[13px] font-bold text-blue-800">스마트 파일 인식 (PDF 업로드)</div>
                     <div className="text-[11px] text-blue-600/70">이곳에 품의서를 끌어다 놓으면 폼이 자동으로 채워집니다.</div>
                   </>
                )}
             </div>
          </div>

          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">예산 과목 *</label>
            <div className="flex items-center gap-2">
              <select value={selectedCatId} onChange={e => setSelectedCatId(e.target.value)} className={`${inputClass} flex-1`} required>
                <option value="">선택</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="button" onClick={handleInlineAddCat} className="p-2.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="과목 추가">
                <Plus size={16} />
              </button>
              <button type="button" onClick={handleInlineEditCat} disabled={!selectedCatId} className="p-2.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors" title="과목 수정">
                <Pencil size={16} />
              </button>
              <button type="button" onClick={handleInlineDeleteCat} disabled={!selectedCatId} className="p-2.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors" title="과목 삭제">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">금액 (원) *</label>
             <input type="text" value={entryAmount} onChange={e => {
               const raw = e.target.value.replace(/[^0-9]/g, '');
               setEntryAmount(raw ? Number(raw).toLocaleString('ko-KR') : '');
             }} className={inputClass} required placeholder="0" />
          </div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">품의 내용 *</label><input type="text" value={entryPurpose} onChange={e => setEntryPurpose(e.target.value)} className={inputClass} required placeholder="어떤 지출을 승인받을 건지" /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">시행 문서 번호</label><input type="text" value={entryDocNum} onChange={e => setEntryDocNum(e.target.value)} className={inputClass} placeholder="예: 찾아가는보건팀-1234 (선택)" /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">날짜</label><input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className={inputClass} /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">메모</label><input type="text" value={entryMemo} onChange={e => setEntryMemo(e.target.value)} className={inputClass} placeholder="추가 메모 (선택)" /></div>
          <button
            type="submit"
            className={`w-full px-4 py-2.5 rounded-lg text-white text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-sm ${
              actionType === 'general' ? 'bg-blue-600' : actionType === 'issuance' ? 'bg-amber-500' : 'bg-teal-600'
            }`}
          >
            {ACTION_TYPE_CONFIG[actionType].label} 등록
          </button>
        </form>
      </Modal>

      {/* Ledger Modal Component */}
      <Modal isOpen={showLedgerModal} onClose={() => setShowLedgerModal(false)} title="일상경비 원장 교차 검증" size="2xl">
        <div className="space-y-4">
          <div className="p-4 bg-teal-50 border border-teal-100 rounded-lg text-[15px] text-teal-800 font-medium leading-relaxed">
            💡 일상경비가 <span className="font-bold underline text-teal-900">한 번이라도 교부되거나 지출된</span> 예산 과목들만 보여줍니다.<br/>
            좌우 T계정 내역을 대조하여 영수증 처리가 누락되었거나 교부를 받지 못한 건을 찾아내세요.
          </div>
          
          <div className="h-[65vh] overflow-y-auto space-y-4 pr-2 scrollbar-hide">
            {categories
              .map(cat => {
                const stats = getCategoryStats(cat.id);
                const catEntries = entries.filter(e => e.categoryId === cat.id);
                const issuances = catEntries.filter(e => e.actionType === 'issuance').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const dailyExpenses = catEntries.filter(e => e.actionType === 'daily_expense').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                return { cat, stats, issuances, dailyExpenses };
              })
              .filter(data => data.issuances.length > 0 || data.dailyExpenses.length > 0)
              .map((data, idx) => (
                <div key={data.cat.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow transition-shadow">
                  <details className="group marker:content-['']" open={idx === 0}>
                    <summary className="flex items-center justify-between p-4 bg-gray-50/50 cursor-pointer hover:bg-gray-100 transition-colors list-none">
                      <div className="flex flex-col gap-2">
                        <div className="text-[17px] font-bold text-gray-800">
                          {data.cat.name} 
                          <span className="text-[13px] font-medium text-gray-500 ml-2 border border-gray-200 bg-white px-2 py-0.5 rounded">
                            {data.cat.unitProject}
                          </span>
                        </div>
                        <div className="flex gap-4 text-[14px] font-semibold mt-1">
                          <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100">교부액: {formatN(data.stats?.dailyExpenseIssued || 0)}</span>
                          <span className="text-teal-600 bg-teal-50 px-2 py-1 rounded border border-teal-100">지출액: {formatN(data.stats?.dailyExpenseSpent || 0)}</span>
                          <span className={`px-2 py-1 rounded border ${
                            (data.stats?.dailyExpenseRemaining || 0) < 0 
                              ? 'text-red-600 bg-red-50 border-red-100' 
                              : 'text-blue-700 bg-blue-50 border-blue-100'
                          }`}>
                            잔액: {formatN(data.stats?.dailyExpenseRemaining || 0)}
                          </span>
                        </div>
                      </div>
                      <ChevronDown size={24} className="text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0" />
                    </summary>
                    <div className="p-4 grid grid-cols-2 gap-6 border-t border-gray-200 bg-white">
                      {/* Left: Issuance */}
                      <div>
                        <div className="text-[14px] font-bold text-amber-700 mb-3 border-b border-amber-200 pb-2 flex justify-between">
                          <span>교부(입금) 내역</span>
                          <span className="bg-amber-100 text-amber-800 px-2 rounded-md">{data.issuances.length}건</span>
                        </div>
                        <ul className="space-y-2.5">
                          {data.issuances.length === 0 && <li className="text-[13px] text-gray-400 text-center py-6 bg-gray-50 rounded border border-dashed border-gray-200 font-medium">내역 없음</li>}
                          {data.issuances.map(e => (
                            <li key={e.id} className="flex justify-between items-center text-[13px] bg-amber-50/50 hover:bg-amber-50 p-3 rounded-lg border border-amber-100 transition-colors shadow-sm">
                              <div className="flex flex-col gap-1 truncate pr-2">
                                <span className="text-gray-500 font-semibold">{e.date.replace(/-/g, '.')}</span>
                                <span className="font-bold text-gray-800 truncate" title={e.purpose}>{e.purpose}</span>
                              </div>
                              <span className="font-bold text-amber-600 shrink-0 text-[14px]">{formatN(e.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {/* Right: Daily Expense */}
                      <div>
                        <div className="text-[14px] font-bold text-teal-700 mb-3 border-b border-teal-200 pb-2 flex justify-between">
                          <span>지출(출금) 내역</span>
                          <span className="bg-teal-100 text-teal-800 px-2 rounded-md">{data.dailyExpenses.length}건</span>
                        </div>
                        <ul className="space-y-2.5">
                          {data.dailyExpenses.length === 0 && <li className="text-[13px] text-gray-400 text-center py-6 bg-gray-50 rounded border border-dashed border-gray-200 font-medium">내역 없음</li>}
                          {data.dailyExpenses.map(e => (
                            <li key={e.id} className="flex justify-between items-center text-[13px] bg-teal-50/50 hover:bg-teal-50 p-3 rounded-lg border border-teal-100 transition-colors shadow-sm">
                              <div className="flex flex-col gap-1 truncate pr-2">
                                <span className="text-gray-500 font-semibold">{e.date.replace(/-/g, '.')}</span>
                                <span className="font-bold text-gray-800 truncate" title={e.purpose}>{e.purpose}</span>
                              </div>
                              <span className="font-bold text-teal-600 shrink-0 text-[14px]">{formatN(e.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </details>
                </div>
              ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
