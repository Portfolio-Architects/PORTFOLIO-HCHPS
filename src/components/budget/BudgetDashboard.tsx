'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BudgetCategory, BudgetEntry, BudgetActionType, generateId } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Modal } from '@/components/ui/modal';
import { Plus, Pencil, Trash2, CheckCircle2, AlertOctagon, ShieldAlert, RefreshCw, Search, FilePlus2, ChevronDown, X } from 'lucide-react';
import { replaceAll } from '@/lib/sheets-api';
import { MultiSelectDropdown } from './ui/MultiSelectDropdown';
import { PolicyGroupCard, ACTION_TYPE_CONFIG } from './ui/PolicyGroupCard';
import { useBudgetAI } from './model/useBudgetAI';
import { BudgetRules } from '@/lib/budget-rules';
import { LedgerModal } from './ui/LedgerModal';

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
  const [catFormationCode, setCatFormationCode] = useState('');
  const [catFormationName, setCatFormationName] = useState('');
  const [catStatCode, setCatStatCode] = useState('');
  const [catStatName, setCatStatName] = useState('');
  const [catBudgetType, setCatBudgetType] = useState<'본예산' | '간주예산' | '추경'>('본예산');
  const [catFundingSplits, setCatFundingSplits] = useState<{source: string, amount: string}[]>([{source: '구비(자체)', amount: ''}]);

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchCats, setBatchCats] = useState<BudgetCategory[]>([]);
  const [batchFundingSplits, setBatchFundingSplits] = useState<{source: string, ratio: string}[]>([{source: '', ratio: ''}]);
  const [batchBudgetType, setBatchBudgetType] = useState('');
  const [batchTitle, setBatchTitle] = useState('');

  const [filterPolicy, setFilterPolicy] = useState<string[]>([]);
  const [filterUnit, setFilterUnit] = useState<string[]>([]);
  const [filterDetail, setFilterDetail] = useState<string[]>([]);
  const [filterStat, setFilterStat] = useState<string[]>([]);


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
    onSuccess: (dataArray) => {
      let addedCount = 0;
      dataArray.forEach(data => {
        if (!data.categoryId || !data.amount) return;
        addEntry({
          categoryId: data.categoryId,
          amount: Number(data.amount.replace(/,/g, '')),
          date: data.date || new Date().toISOString().split('T')[0],
          purpose: data.purpose || '자동 스캔 예상내역',
          docRegNum: data.docNum,
          actionType: actionType, // 모달에서 현재 선택중인 탭의 속성(일반지출/교부/일상경비 등)을 상속
          isPlanned: true,
          isSettled: false
        });
        addedCount++;
      });
      if (addedCount > 0) {
        // 성공 시 따로 단일 상태(단일 폼)를 채우지 않고 즉시 리스트로 밀어넣음.
        setShowLedgerModal(true); // 장부 모달을 열어 바로 확인할 수 있게 유도
      }
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

  const handleSettle = (plannedEntryId: string, actualAmount: number) => {
    const plannedEntry = entries.find(e => e.id === plannedEntryId);
    if (!plannedEntry) return;

    updateEntry(plannedEntryId, { isSettled: true });
    
    // Create the actual settled entry matching the planned entry details
    addEntry({
      categoryId: plannedEntry.categoryId,
      amount: actualAmount,
      date: new Date().toISOString().split('T')[0],
      purpose: plannedEntry.purpose,
      actionType: plannedEntry.actionType || 'general', // 원본 계획서의 탭 속성을 그대로 물려받음
      relatedPlanId: plannedEntryId,
      docRegNum: plannedEntry.docRegNum,
      isPlanned: false, 
      isSettled: false
    });
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow";
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const targetBudget = Number(catBudget.replace(/,/g, ''));
    if (!targetBudget) return;

    const combinedFormation = catFormationCode ? `${catFormationCode} ${catFormationName}`.trim() : catFormationName;
    const combinedStat = catStatCode ? `${catStatCode} ${catStatName}`.trim() : catStatName;
    const finalName = combinedStat || combinedFormation || '무명 예산과목';
    
    const hasAmounts = catFundingSplits.some(s => s.amount);
    const totalAmount = catFundingSplits.reduce((sum, s) => sum + Number((s.amount || '0').replace(/,/g, '')), 0);
    
    if (hasAmounts && totalAmount > 0 && Math.abs(totalAmount - targetBudget) > 10) {
      alert(`입력하신 재원 금액 합계(${totalAmount.toLocaleString()}원)가 총 예산액(${targetBudget.toLocaleString()}원)과 일치하지 않습니다.`);
      return;
    }

    const finalFunding = catFundingSplits.map(s => {
      const amt = Number((s.amount || '0').replace(/,/g, ''));
      if (amt === 0) return '';
      const r = targetBudget > 0 ? (amt / targetBudget) * 100 : 0;
      const ratioStr = r.toFixed(2);
      return `${s.source} (${ratioStr}%)`;
    }).filter(Boolean).join(', ') || '구비(자체)';

    const finalSplitsArray = catFundingSplits.map(s => ({
      source: s.source,
      amount: Number((s.amount || '0').replace(/,/g, ''))
    })).filter(s => s.amount > 0);

    if (editCatId) {
      updateCategory(editCatId, { name: finalName, totalBudget: targetBudget, policyProject: catPolicy, unitProject: catUnit, detailedProject: catDetail, formationItem: combinedFormation, statItem: combinedStat, budgetType: catBudgetType, fundingSource: finalFunding, fundingSplits: finalSplitsArray });
    } else {
      addCategory({ name: finalName, totalBudget: targetBudget, color: COLORS[categories.length % COLORS.length], policyProject: catPolicy, unitProject: catUnit, detailedProject: catDetail, formationItem: combinedFormation, statItem: combinedStat, budgetType: catBudgetType, fundingSource: finalFunding, fundingSplits: finalSplitsArray });
    }
    setCatBudget('');

    setCatPolicy(''); setCatUnit(''); setCatDetail(''); setCatFormationCode(''); setCatFormationName(''); setCatStatCode(''); setCatStatName(''); setCatBudgetType('본예산'); setCatFundingSplits([{source: '구비(자체)', amount: ''}]);
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

    // 예산 지침 컴플라이언스 룰 검증
    const validation = BudgetRules.validateEntryCompliance(entryPurpose, targetCat?.name || '');
    if (!validation.valid && validation.type === 'error') {
      alert('Error: ' + validation.message);
      return;
    }
    if (validation.type === 'confirm') {
      if (!window.confirm(validation.message!)) return;
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

  const openEditCat = useCallback((cat: BudgetCategory) => {
    setCatBudget(cat.totalBudget ? cat.totalBudget.toLocaleString() : '');
    setCatPolicy(cat.policyProject || ''); setCatUnit(cat.unitProject || '');
    setCatDetail(cat.detailedProject || ''); 
    const formationStr = cat.formationItem || '';
    const codeMatch = formationStr.match(/^(\d{3})\s*(.+)$/);
    if (codeMatch) {
      setCatFormationCode(codeMatch[1]);
      setCatFormationName(codeMatch[2]);
    } else {
      setCatFormationCode(formationStr.slice(0,3).replace(/\D/g, ''));
      setCatFormationName(formationStr.replace(/^\d+\s*/, '').trim() || formationStr);
    }
    const statStr = cat.statItem || '';
    const statMatch = statStr.match(/^([\d-]+)\s*(.+)$/);
    if (statMatch) {
      setCatStatCode(statMatch[1]);
      setCatStatName(statMatch[2]);
    } else {
      setCatStatCode(statStr.replace(/[^\d-]/g, ''));
      setCatStatName(statStr.replace(/^[\d-]+\s*/, '').trim() || statStr);
    }
    setCatBudgetType(cat.budgetType || '본예산');
    
    if (cat.fundingSplits && cat.fundingSplits.length > 0) {
      setCatFundingSplits(cat.fundingSplits.map(s => ({ source: s.source, amount: s.amount ? s.amount.toLocaleString() : '' })));
    } else {
      const rawFunding = cat.fundingSource || '구비(자체)';
      const parsedSplits = [];
      const parts = rawFunding.split(',');
      for (const p of parts) {
        const match = p.trim().match(/(.+) \((.+)%\)/);
        if (match) {
          const ratioObj = Number(match[2]);
          const computedAmount = cat.totalBudget > 0 ? (cat.totalBudget * ratioObj) / 100 : 0;
          parsedSplits.push({ source: match[1].trim(), amount: computedAmount > 0 ? Math.round(computedAmount).toLocaleString() : '' });
        } else if (p.trim()) {
          parsedSplits.push({ source: p.trim(), amount: cat.totalBudget > 0 ? cat.totalBudget.toLocaleString() : '' });
        }
      }
      if (parsedSplits.length === 0) parsedSplits.push({ source: '구비(자체)', amount: '' });
      setCatFundingSplits(parsedSplits);
    }
    setEditCatId(cat.id); setShowCatModal(true);
  }, []);

  const openAddCat = useCallback((template: Partial<BudgetCategory>) => {
    setCatBudget(template.totalBudget ? template.totalBudget.toLocaleString() : '');
    setCatPolicy(template.policyProject || ''); setCatUnit(template.unitProject || '');
    setCatDetail(template.detailedProject || ''); 
    const formationStr = template.formationItem || '';
    const codeMatch = formationStr.match(/^(\d{3})\s*(.+)$/);
    if (codeMatch) {
      setCatFormationCode(codeMatch[1]);
      setCatFormationName(codeMatch[2]);
    } else {
      setCatFormationCode(formationStr.slice(0,3).replace(/\D/g, ''));
      setCatFormationName(formationStr.replace(/^\d+\s*/, '').trim() || formationStr);
    }
    const statStr = template.statItem || '';
    const statMatch = statStr.match(/^([\d-]+)\s*(.+)$/);
    if (statMatch) {
      setCatStatCode(statMatch[1]);
      setCatStatName(statMatch[2]);
    } else {
      setCatStatCode(statStr.replace(/[^\d-]/g, ''));
      setCatStatName(statStr.replace(/^[\d-]+\s*/, '').trim() || statStr);
    }
    setCatBudgetType(template.budgetType || '본예산');
    
    if (template.fundingSplits && template.fundingSplits.length > 0) {
      setCatFundingSplits(template.fundingSplits.map(s => ({ source: s.source, amount: s.amount ? s.amount.toLocaleString() : '' })));
    } else {
      const rawFunding = template.fundingSource || '구비(자체)';
      const parsedSplits = [];
      const parts = rawFunding.split(',');
      for (const p of parts) {
        const match = p.trim().match(/(.+) \((.+)%\)/);
        if (match) {
          const ratioObj = Number(match[2]);
          const computedAmount = template.totalBudget ? (template.totalBudget * ratioObj) / 100 : 0;
          parsedSplits.push({ source: match[1].trim(), amount: computedAmount > 0 ? Math.round(computedAmount).toLocaleString() : '' });
        } else if (p.trim()) {
          parsedSplits.push({ source: p.trim(), amount: template.totalBudget ? template.totalBudget.toLocaleString() : '' });
        }
      }
      if (parsedSplits.length === 0) parsedSplits.push({ source: '구비(자체)', amount: '' });
      setCatFundingSplits(parsedSplits);
    }
    setEditCatId(null); setShowCatModal(true);
  }, []);

  const openBatchEdit = useCallback((title: string, cats: BudgetCategory[]) => {
    if (!cats.length) return;
    setBatchCats(cats);
    setBatchTitle(title);
    setBatchFundingSplits([{source: '', ratio: ''}]);
    setBatchBudgetType('');
    setShowBatchModal(true);
  }, []);

  const handleApplyBatchEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm(`선택된 [${batchTitle}] 내 ${batchCats.length}개 과목을 일괄 수정하시겠습니까?`)) return;

    const hasBatchRatios = batchFundingSplits.some(s => s.ratio);
    const totalRatio = batchFundingSplits.reduce((sum, s) => sum + Number(s.ratio || 0), 0);

    if (hasBatchRatios && Math.abs(totalRatio - 100) > 0.01) {
      alert(`입력하신 전체 재원 비율의 합계(${totalRatio.toFixed(2)}%)가 100%가 되지 않습니다. 정확히 100%로 분할해주세요.`);
      return;
    }

    batchCats.forEach(c => {
      const updates: Partial<BudgetCategory> = {};
      if (batchBudgetType !== '') Object.assign(updates, { budgetType: batchBudgetType });
      
      if (hasBatchRatios) {
         // Apply exact ratio to child category precise amounts
         const newSplitsArray = batchFundingSplits.map(br => ({
            source: br.source,
            amount: Math.round(c.totalBudget * (Number(br.ratio) / 100))
         })).filter(s => s.amount > 0);
         
         const newFundingString = newSplitsArray.map(s => {
            const r = c.totalBudget > 0 ? (s.amount / c.totalBudget) * 100 : 0;
            return `${s.source} (${r.toFixed(2)}%)`;
         }).filter(Boolean).join(', ') || '구비(자체)';
         
         Object.assign(updates, { fundingSource: newFundingString, fundingSplits: newSplitsArray });
      }
      
      if (Object.keys(updates).length > 0) {
        updateCategory(c.id, updates);
      }
    });

    setShowBatchModal(false);
  };

  const openEntryModal = () => {
    setEditEntryId(null);
    setShowEntryModal(true);
  };

  const handleInlineAddCat = () => {
    setShowEntryModal(false);
    setReturnToEntryModal(true);
    setEditCatId(null);
    setCatPolicy(''); setCatUnit(''); setCatDetail(''); setCatFormationCode(''); setCatFormationName(''); setCatStatCode(''); setCatStatName(''); setCatBudget(''); setCatFundingSplits([{source: '구비(자체)', amount: ''}]);
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
  const uniquePolicies = useMemo(() => {
    return Array.from(new Set(categories.map(c => c.policyProject).filter(Boolean))).map(policy => {
      const sum = categories.filter(c => c.policyProject === policy).reduce((a, b) => a + b.totalBudget, 0);
      return { value: policy as string, suffix: `${formatN(sum)}원` };
    });
  }, [categories]);
  
  const unitOptions = useMemo(() => {
    const list = categories.filter(c => filterPolicy.length === 0 || filterPolicy.includes(c.policyProject || ''));
    return Array.from(new Set(list.map(c => c.unitProject).filter(Boolean))).map(unit => {
      const sum = list.filter(c => c.unitProject === unit).reduce((a, b) => a + b.totalBudget, 0);
      return { value: unit as string, suffix: `${formatN(sum)}원` };
    });
  }, [categories, filterPolicy]);
  
  const detailOptions = useMemo(() => {
    const list = categories.filter(c => (filterPolicy.length === 0 || filterPolicy.includes(c.policyProject || '')) && (filterUnit.length === 0 || filterUnit.includes(c.unitProject || '')));
    return Array.from(new Set(list.map(c => c.detailedProject).filter(Boolean))).map(detail => {
      const sum = list.filter(c => c.detailedProject === detail).reduce((a, b) => a + b.totalBudget, 0);
      return { value: detail as string, suffix: `${formatN(sum)}원` };
    });
  }, [categories, filterPolicy, filterUnit]);
  
  const statOptions = useMemo(() => {
    const list = categories.filter(c => (filterPolicy.length === 0 || filterPolicy.includes(c.policyProject || '')) && (filterUnit.length === 0 || filterUnit.includes(c.unitProject || '')) && (filterDetail.length === 0 || filterDetail.includes(c.detailedProject || '')));
    return Array.from(new Set(list.map(c => c.statItem).filter(Boolean))).map(stat => {
      const sum = list.filter(c => c.statItem === stat).reduce((a, b) => a + b.totalBudget, 0);
      return { value: stat as string, suffix: `${formatN(sum)}원` };
    });
  }, [categories, filterPolicy, filterUnit, filterDetail]);

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
    let totalPlanned = 0;

    let dailyExpenseIssued = 0;
    let dailyExpenseSpent = 0;
    let dailyExpenseRemaining = 0;

    filteredCategoriesTree.forEach(cat => {
      const catStats = getCategoryStats(cat.id);
      if (catStats) {
        totalBudget += catStats.totalBudget;
        remaining += catStats.remaining;
        totalSpent += catStats.spent;
        totalPlanned += catStats.planned;
        dailyExpenseIssued += catStats.dailyExpenseIssued;
        dailyExpenseSpent += catStats.dailyExpenseSpent;
        dailyExpenseRemaining += catStats.dailyExpenseRemaining;
      }
    });

    return { totalBudget, remaining, totalSpent, totalPlanned, dailyExpenseIssued, dailyExpenseSpent, dailyExpenseRemaining };
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
          <div className="text-[13px] font-bold text-blue-600 mb-3 tracking-wide flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> 일반 계좌</div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-800 tracking-tight mb-1">{formatN(filteredStats.remaining)}<span className="text-base font-bold text-gray-500 ml-1">잔여</span></div>
            <div className="flex flex-col gap-1 mt-3">
              <div className="flex justify-between items-center text-[13px] bg-gray-50 px-3 py-2 rounded border border-gray-100">
                <span className="text-gray-500 font-medium">일반 지출</span>
                <span className="font-bold text-gray-700">{formatN(filteredStats.totalSpent - filteredStats.dailyExpenseIssued)}원</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Daily Expense Issuance */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col h-full justify-between">
          <div className="text-[13px] font-bold text-amber-600 mb-3 tracking-wide flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> 일상경비 이체내역</div>
          <div className="flex flex-col gap-2 mt-1">
            <div className="bg-gray-50 rounded p-3 border border-gray-100">
              <div className="text-[11px] text-amber-600 font-bold mb-0.5">교부액 (이체원금)</div>
              <div className="text-lg font-black text-gray-800 tracking-tight">{formatN(filteredStats.dailyExpenseIssued)}<span className="text-xs font-semibold text-gray-500 ml-1">원</span></div>
            </div>
            <div className="bg-gray-50 rounded p-3 border border-gray-100 flex justify-between items-end">
              <div className="text-[11px] text-gray-500 font-bold mb-0.5">실지출액</div>
              <div className="text-[15px] font-bold text-gray-700">{formatN(filteredStats.dailyExpenseSpent)}<span className="text-[10px] text-gray-400 ml-1">원</span></div>
            </div>
          </div>
        </div>

        {/* Card 4: Daily Expense Remaining */}
        <div className="bg-teal-700 rounded-xl border border-teal-800 p-5 flex flex-col h-full justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[13px] font-bold text-teal-50 tracking-wide flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-300"></div> 가용 잔액
            </div>
            <button onClick={() => setShowLedgerModal(true)} className="flex items-center gap-1.5 text-[12px] bg-teal-800 hover:bg-teal-900 text-white px-3 py-1.5 rounded transition-colors font-bold border border-teal-600">
              <Search size={14} /> 상세 대조
            </button>
          </div>
          <div>
            <div className="text-3xl font-black text-white tracking-tight">{formatN(filteredStats.dailyExpenseRemaining)}<span className="text-base font-semibold text-teal-100 ml-1">원</span></div>
            <div className="mt-2 text-[11px] text-teal-200 font-medium">원장대조 버튼으로 영수증 누락을 확인하세요.</div>
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
              openAddCat={openAddCat}
              openEditEntry={openEditEntry}
              openBatchEdit={openBatchEdit}
              updateCategory={updateCategory}
              hidePolicyHeader={filterDetail.length > 0}
            />
          ))}
        </div>
      )}

      {/* Category Modal */}
      <Modal isOpen={showCatModal} onClose={() => { 
        setShowCatModal(false); 
        if (returnToEntryModal) { setShowEntryModal(true); setReturnToEntryModal(false); } 
      }} title={editCatId ? '예산 과목 수정' : '새 예산 과목'} size="xl">
        <form onSubmit={handleAddCategory} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">정책사업명</label><input type="text" value={catPolicy} onChange={e => setCatPolicy(e.target.value)} className={inputClass} placeholder="예: 건강도시조성" /></div>
            <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">단위사업명</label><input type="text" value={catUnit} onChange={e => setCatUnit(e.target.value)} className={inputClass} placeholder="예: 찾아가는 보건소" /></div>
            <div className="col-span-2"><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">세부사업명</label><input type="text" value={catDetail} onChange={e => setCatDetail(e.target.value)} className={inputClass} placeholder="예: 방문간호운영" /></div>
            
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 flex justify-between">
                <span>총 예산액 (원) *</span>
                <span className="text-xs font-bold text-blue-600 border border-blue-200 bg-blue-50 px-2 rounded-full">수동 입력 필수</span>
              </label>
              <input type="text" value={catBudget} onChange={e => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setCatBudget(val ? Number(val).toLocaleString() : '');
              }} className={`${inputClass} text-lg font-bold text-gray-900 pr-10`} required placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">편성목 *</label>
              <div className="flex gap-2">
                <input type="text" value={catFormationCode} onChange={e => setCatFormationCode(e.target.value.replace(/\D/g, '').slice(0, 3))} className={`${inputClass} text-center font-mono`} style={{ width: '80px', flex: '0 0 80px' }} required placeholder="예: 201" maxLength={3} />
                <input type="text" value={catFormationName} onChange={e => setCatFormationName(e.target.value)} className={inputClass} style={{ flex: 1 }} required placeholder="예: 일반운영비" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">통계목 *</label>
              <div className="flex gap-2">
                <input type="text" value={catStatCode} onChange={e => setCatStatCode(e.target.value.replace(/[^0-9-]/g, '').slice(0, 6))} className={`${inputClass} text-center font-mono`} style={{ width: '80px', flex: '0 0 80px' }} required placeholder="예: 01" maxLength={6} />
                <input type="text" value={catStatName} onChange={e => setCatStatName(e.target.value)} className={inputClass} style={{ flex: 1 }} required placeholder="예: 사무관리비" />
              </div>
            </div>
            
            <div className="col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2.5 flex justify-between items-center">
                <span className="font-bold flex items-center gap-1.5"><ShieldAlert size={14} className="text-gray-400"/> 재원 구분 및 금액 분할 *</span>
                {(() => {
                  const tb = Number(catBudget.replace(/,/g, ''));
                  const totalAmt = catFundingSplits.reduce((sum, s) => sum + Number((s.amount || '0').replace(/,/g, '')), 0);
                  const isMatch = tb > 0 && totalAmt === tb;
                  return (
                    <span className={`text-[11px] px-2 py-0.5 rounded font-bold ${isMatch ? 'text-green-700 bg-green-100' : 'text-red-600 bg-red-100'}`}>
                      {isMatch ? '금액 일치 정상' : `확인중 (${totalAmt.toLocaleString()}원)`}
                    </span>
                  );
                })()}
              </label>
              <div className="space-y-2.5">
                {catFundingSplits.map((split, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select value={split.source} onChange={e => {
                      const newSplits = [...catFundingSplits];
                      newSplits[idx].source = e.target.value;
                      setCatFundingSplits(newSplits);
                    }} className={`${inputClass} font-medium`} style={{ width: '140px', flex: '0 0 140px' }}>
                      <option value="구비(자체)">구비(자체)</option>
                      <option value="국비">국비</option>
                      <option value="시비">시비</option>
                      <option value="기금">기금</option>
                      <option value="특교">특교</option>
                      <option value="국비 매칭">국비 매칭</option>
                      <option value="시비 매칭">시비 매칭</option>
                    </select>
                    
                    <div className="relative flex-1">
                      <input type="text" value={split.amount} onChange={e => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        const newSplits = [...catFundingSplits];
                        newSplits[idx].amount = val ? Number(val).toLocaleString() : '';
                        setCatFundingSplits(newSplits);
                      }} className={`${inputClass} pr-8 text-right font-bold text-gray-800`} placeholder="금액 입력" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium pointer-events-none">원</span>
                    </div>

                    <div className="w-16 shrink-0 flex items-center justify-center">
                      <span className="text-[13px] font-black text-[var(--color-primary)]">
                        {(() => {
                           const a = Number((split.amount || '0').replace(/,/g, ''));
                           const b = Number(catBudget.replace(/,/g, ''));
                           if (b === 0) return '0%';
                           const r = (a / b) * 100;
                           return r.toFixed(2) + '%';
                        })()}
                      </span>
                    </div>
                    {catFundingSplits.length > 1 ? (
                      <button type="button" onClick={() => {
                        const newSplits = catFundingSplits.filter((_, i) => i !== idx);
                        setCatFundingSplits(newSplits);
                      }} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors" title="이 재원 삭제"><X size={16}/></button>
                    ) : (
                      <div className="w-8 shrink-0"></div>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setCatFundingSplits([...catFundingSplits, {source: '구비(자체)', amount: ''}])} className="text-[13px] text-blue-600 font-bold hover:underline flex items-center gap-1 mt-1.5 px-1 py-1 rounded hover:bg-blue-50 transition-colors">+ 재원 추가</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">예산 구분</label>
              <div className="flex gap-4">
                {['본예산', '간주예산', '추경'].map(type => (
                  <label key={type} className="flex items-center gap-1.5 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded-md transition-colors">
                    <input type="radio" name="catBudgetType" value={type} checked={catBudgetType === type} onChange={() => setCatBudgetType(type as any)} className="text-[var(--color-primary)] border-gray-300 focus:ring-[var(--color-primary)]" />
                    {type}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <button type="submit" className="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-lg hover:bg-opacity-90 transition-colors font-bold w-full shadow-md shadow-blue-500/20 cursor-pointer text-sm">
            {editCatId ? '예산 과목 저장' : '예산 과목 등록'}
          </button>
        </form>
      </Modal>

      {/* Batch Edit Modal */}
      <Modal isOpen={showBatchModal} onClose={() => setShowBatchModal(false)} title={`[${batchTitle}] 일괄 수정`} size="md">
        <form onSubmit={handleApplyBatchEdit} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded-lg text-sm font-medium mb-2 leading-relaxed">
             해당 그룹에 속한 <b>{batchCats.length}개</b>의 모든 하위 과목 예산/재원 구분을 일괄 변경합니다.<br/>
             <span className="text-xs text-blue-500 mt-1 block">* 혼합 재원 사업의 경우 '변경 안함'을 선택하면 기존 정보를 유지할 수 있습니다.</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">새로운 예산 구분 적용</label>
            <select value={batchBudgetType} onChange={e => setBatchBudgetType(e.target.value as any)} className={inputClass}>
              <option value="">(변경 안함 - 개별 정보 유지)</option>
              <option value="본예산">본예산</option>
              <option value="간주예산">간주예산</option>
              <option value="추경">추경</option>
            </select>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center mb-4">
               <div className="text-sm font-semibold text-blue-800">일괄 적용 대상 총 예산액</div>
               <div className="text-xl font-black text-blue-900 mt-1">{batchCats.reduce((sum, c) => sum + c.totalBudget, 0).toLocaleString()} <span className="text-sm font-bold text-blue-700">원</span></div>
               <div className="text-[11px] text-blue-600 mt-1 text-left bg-blue-100/50 p-2 rounded">일괄 적용 기능은 총 예산액을 몰라도 쉽게 입력할 수 있도록 <b>퍼센트(%)</b>로 입력받습니다. 여기서 입력하신 비율이 하위 {batchCats.length}개 단위/통계목들의 각 예산액 규모에 비례해 정확한 금액으로 자동 하향 분배 지정됩니다. 변경을 원하지 않으면 비워두세요.</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 bg-slate-100 p-2 rounded flex justify-between items-center">
              <span>새로운 재원 구분 및 퍼센트 분할 (옵션)</span>
            </label>
            <div className="space-y-2 mt-2">
              {batchFundingSplits.map((split, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select 
                    value={split.source}
                    onChange={(e) => {
                      const newSplits = [...batchFundingSplits];
                      newSplits[i].source = e.target.value;
                      setBatchFundingSplits(newSplits);
                    }}
                    className={inputClass}
                    style={{ flex: 1 }}
                  >
                    <option value="">필요시 선택</option>
                    <option value="기금">기금</option>
                    <option value="시비">시비</option>
                    <option value="구비(자체)">구비(자체)</option>
                    <option value="국비">국비</option>
                    <option value="특교">특교</option>
                  </select>
                  <div className="relative" style={{ flex: 2 }}>
                    <input 
                      type="number" 
                      step="0.01"
                      value={split.ratio}
                      onChange={(e) => {
                         const newSplits = [...batchFundingSplits];
                         newSplits[i].ratio = e.target.value;
                         setBatchFundingSplits(newSplits);
                      }}
                      className={`${inputClass} pr-10 text-right font-bold`}
                      placeholder="(기존 비율 유지)" 
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[15px] font-black text-blue-500">%</span>
                  </div>
                  {i === batchFundingSplits.length - 1 ? (
                     <button type="button" onClick={() => setBatchFundingSplits([...batchFundingSplits, {source: '시비', ratio: ''}])} className="text-blue-500 p-1 hover:bg-blue-50 rounded"><Plus size={16}/></button>
                  ) : (
                     <button type="button" onClick={() => setBatchFundingSplits(batchFundingSplits.filter((_, idx) => idx !== i))} className="text-red-400 p-1 hover:bg-red-50 rounded"><X size={16}/></button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-2">
            <button type="button" onClick={() => setShowBatchModal(false)} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm">취소</button>
            <button type="submit" className="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-lg hover:bg-opacity-90 transition-colors font-bold shadow-md shadow-blue-500/20 cursor-pointer text-sm">일괄 적용</button>
          </div>
        </form>
      </Modal>

      {/* Entry Modal */}
      <Modal isOpen={showEntryModal} onClose={() => setShowEntryModal(false)} title="지출 등록" size="sm" footer={(() => {
              const os = filteredStats;
              return (
                <div className="grid grid-cols-2 gap-3 w-full border-t pt-4 mt-2">
                  <div className="bg-gray-50 p-2 rounded text-center">
                    <div className="text-[10px] text-gray-500">가배정(품의)</div>
                    <div className="text-sm font-bold text-amber-600">{formatN(os.totalPlanned)}</div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded text-center">
                    <div className="text-[10px] text-gray-500">실가용 잔액</div>
                    <div className="text-sm font-bold text-emerald-600">{formatN(os.remaining - os.totalPlanned)}</div>
                  </div>
                </div>
              );
            })()}>
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
                {categories.map(c => <option key={c.id} value={c.id}>[{c.fundingSource || '자체'}] {c.name}</option>)}
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

      <LedgerModal 
        isOpen={showLedgerModal} 
        onClose={() => setShowLedgerModal(false)}
        categories={categories}
        entries={entries}
        getCategoryStats={getCategoryStats}
        onSettle={handleSettle}
      />
    </div>
  );
}
