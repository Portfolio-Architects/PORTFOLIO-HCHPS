'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BudgetCategory, BudgetEntry, BudgetActionType, generateId } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Modal } from '@/components/ui/modal';
import { Plus, Pencil, Trash2, CheckCircle2, AlertOctagon, ShieldAlert, RefreshCw, Search, FilePlus2, ChevronDown, ChevronLeft, ChevronRight, X, FileCheck, Upload } from 'lucide-react';
import { replaceAll } from '@/lib/sheets-api';
import { MultiSelectDropdown } from './ui/MultiSelectDropdown';
import { PolicyGroupCard, ACTION_TYPE_CONFIG } from './ui/PolicyGroupCard';
import { BudgetRules } from '@/lib/budget-rules';
import { LedgerModal } from './ui/LedgerModal';
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
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [catName, setCatName] = useState('');
  const [catBudget, setCatBudget] = useState('');
  
  const [catPolicy, setCatPolicy] = useState('');
  const [catUnit, setCatUnit] = useState('');
  const [catDetail, setCatDetail] = useState('');
  const [catManagement, setCatManagement] = useState('');
  const [catFormationCode, setCatFormationCode] = useState('');
  const [catFormationName, setCatFormationName] = useState('');
  const [catStatCode, setCatStatCode] = useState('');
  const [catStatName, setCatStatName] = useState('');
  const [catBudgetType, setCatBudgetType] = useState<'본예산' | '간주예산' | '추경'>('본예산');
  const [catFundingSplits, setCatFundingSplits] = useState<{source: string, amount: string}[]>([{source: '구비', amount: ''}]);
  const [catSubItems, setCatSubItems] = useState<{id?: string, prefix: string, name: string, calculation: string, amount: string, isCustomFunding: boolean, isLocked?: boolean, fundingSplits: {source: string, amount: string}[], calculations: {id?: string, name?: string, calculation: string, amount: string, isCustomFunding?: boolean, isLocked?: boolean, fundingSplits?: {source: string, amount: string}[]}[]}[]>([{prefix: '', name: '', calculation: '', amount: '', isCustomFunding: false, fundingSplits: [{source: '구비', amount: ''}], calculations: []}]);

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
  const [entryLinkedSubItemId, setEntryLinkedSubItemId] = useState('');

  const [isLoaded, setIsLoaded] = useState(false);
  const migrationRan = React.useRef({ legacy: false, settle: false });

  // Auto-Migration for Legacy Nomenclature
  useEffect(() => {
    if (migrationRan.current.legacy) return;
    if (categories.length === 0) return;
    
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
    if (migrated) {
      console.info('[Migration] Legacy category nomenclature updated.');
    }
    migrationRan.current.legacy = true;
  }, [categories, updateCategory]);

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
  }, []); // Run ONLY once on mount

  useEffect(() => {
    if (migrationRan.current.settle) return;
    // [Migration] 자동 정산 전 누락된 가지출 건 복구 스크립트
    if (entries.length > 0 && categories.length > 0) {
      let needsMigration = false;
      entries.forEach(plan => {
        if (plan.isPlanned && !plan.isSettled) {
          // 같은 과목 & 같은 금액의 실지출 건이 있는지 탐색
          const matchedActual = entries.find(actual => 
            !actual.isPlanned && 
            actual.amount === plan.amount && 
            actual.categoryId === plan.categoryId &&
            actual.actionType !== 'issuance'
          );
          if (matchedActual) {
            updateEntry(plan.id, { isSettled: true });
            needsMigration = true;
          }
        }
      });
      if (needsMigration) {
        console.info('[Migration] 누락된 과거 가지출(품의) 건이 자동 정산 백그라운드 처리되었습니다.');
      }
      migrationRan.current.settle = true;
    }
  }, [entries, categories, updateEntry]);

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
    }).filter(Boolean).join(', ') || '구비';

    const finalSplitsArray = catFundingSplits.map(s => ({
      source: s.source,
      amount: Number((s.amount || '0').replace(/,/g, ''))
    })).filter(s => s.amount > 0);


    const finalSubItemsArray = catSubItems.map(s => {
      const calcArray = (s.calculations || []).map(calc => {
        const res: {id: string, name?: string, calculation: string, amount: number, isCustomFunding?: boolean, fundingSplits?: {source: string, amount: number}[], isLocked?: boolean} = {
          id: (calc as any).id || crypto.randomUUID(),
          calculation: calc.calculation,
          amount: Number((calc.amount || '0').replace(/,/g, ''))
        };
        if (calc.name) res.name = calc.name;
        if (calc.isLocked !== undefined) res.isLocked = calc.isLocked;
        if (calc.isCustomFunding) {
          res.isCustomFunding = true;
          res.fundingSplits = calc.fundingSplits && calc.fundingSplits.length > 0 ? calc.fundingSplits.map(fs => ({source: fs.source, amount: Number((fs.amount || '0').replace(/,/g, ''))})).filter(fs => fs.amount > 0) : undefined;
        }
        return res;
      }).filter(c => c.calculation.trim() !== '' || c.amount > 0);
      
      const isParent = calcArray.length > 0;
      const computedAmount = isParent ? calcArray.reduce((sum, c) => sum + c.amount, 0) : Number((s.amount || '0').replace(/,/g, ''));

      return {
        id: (s as any).id || crypto.randomUUID(),
        prefix: s.prefix || undefined,
        name: s.name,
        calculation: isParent ? undefined : s.calculation,
        amount: computedAmount,
        isCustomFunding: s.isCustomFunding,
        isLocked: s.isLocked,
        calculations: isParent ? calcArray : undefined,
        fundingSplits: s.isCustomFunding && s.fundingSplits && s.fundingSplits.length > 0 ? s.fundingSplits.map(fs => ({
          source: fs.source,
          amount: Number((fs.amount || '0').replace(/,/g, ''))
        })).filter(fs => fs.amount > 0) : undefined
      };
    }).filter(s => s.name.trim() !== '' || (s.prefix && s.prefix.trim() !== '') || s.amount > 0 || (s.calculations && s.calculations.length > 0) || (s.calculation && s.calculation.trim() !== ''));

    if (editCatId) {
      updateCategory(editCatId, { name: finalName, totalBudget: targetBudget, policyProject: catPolicy, unitProject: catUnit, detailedProject: catDetail, managementProject: catManagement || undefined, subItems: finalSubItemsArray, formationItem: combinedFormation, statItem: combinedStat, budgetType: catBudgetType, fundingSource: finalFunding, fundingSplits: finalSplitsArray });
    } else {
      addCategory({ name: finalName, totalBudget: targetBudget, color: COLORS[categories.length % COLORS.length], policyProject: catPolicy, unitProject: catUnit, detailedProject: catDetail, managementProject: catManagement || undefined, subItems: finalSubItemsArray, formationItem: combinedFormation, statItem: combinedStat, budgetType: catBudgetType, fundingSource: finalFunding, fundingSplits: finalSplitsArray });
    }
    setCatBudget('');

    setCatPolicy(''); setCatUnit(''); setCatDetail(''); setCatManagement(''); setCatFormationCode(''); setCatFormationName(''); setCatStatCode(''); setCatStatName(''); setCatBudgetType('본예산'); setCatFundingSplits([{source: '구비', amount: ''}]); setCatSubItems([{prefix: '', name: '', calculation: '', amount: '', isCustomFunding: false, isLocked: false, fundingSplits: [{source: '구비', amount: ''}], calculations: []}]);
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
    // eslint-disable-next-line react-hooks/purity
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
          setEntryError(`일반 예산 잔액이 부족합니다. (현재 가용 실 잔액: ${formatN(adjRemaining)}원)`.trim());
          return;
        }
      } else if (actionType === 'daily_expense') {
        if (reqAmount > adjDailyRemaining) {
          setEntryError(`일상경비 통장 가용 잔액이 부족합니다. (현재 가용 잔액: ${formatN(adjDailyRemaining)}원)`.trim());
          return;
        }
      }

      // 2. 세부 항목 1:1 잔액 통제 검증 (Sub-Item Strict Tracking)
      if (entryLinkedSubItemId && targetCat?.subItems) {
        let subItemName = '';
        let targetAmount = 0;
        let isLocked = false;
        
        for (const sub of targetCat.subItems) {
          if (sub.id === entryLinkedSubItemId) {
            subItemName = sub.name; targetAmount = sub.amount; isLocked = sub.isLocked || false;
            break;
          }
          if (sub.calculations) {
            for (const calc of sub.calculations) {
              if (calc.id === entryLinkedSubItemId) {
                subItemName = calc.name || sub.name; targetAmount = calc.amount; isLocked = calc.isLocked || sub.isLocked || false;
                break;
              }
            }
          }
          if (subItemName) break;
        }

        if (subItemName) {
           if (isLocked) {
             setEntryError(`[${subItemName}] 항목은 예산 잠금(사용 불가) 상태이므로 지출할 수 없습니다.`.trim());
             return;
           }

           const spentOnSubItem = entries.filter(e => e.categoryId === selectedCatId && e.linkedSubItemId === entryLinkedSubItemId && !e.isPlanned && e.id !== editEntryId).reduce((sum, e) => sum + e.amount, 0);
           const plannedOnSubItem = entries.filter(e => e.categoryId === selectedCatId && e.linkedSubItemId === entryLinkedSubItemId && e.isPlanned && !e.isSettled && e.id !== editEntryId).reduce((sum, e) => sum + e.amount, 0);
           
           const subItemRemaining = targetAmount - spentOnSubItem - plannedOnSubItem;
           
           if (reqAmount > subItemRemaining) {
             setEntryError(`[${subItemName}] 항목의 예산 한도가 부족합니다.\n\n해당 세부 항목 배정액: ${formatN(targetAmount)}원\n세부 항목 가용 잔액: ${formatN(subItemRemaining)}원\n\n(참고: 통계목 전체 잔액이 남아있더라도 세부 항목 예산을 섞어 쓸 수 없습니다)`.trim());
             return;
           }
        }
      }
    }

    // 예산 지침 컴플라이언스 룰 검증
    const validation = BudgetRules.validateEntryCompliance(entryPurpose, targetCat?.name || '');
    if (!validation.valid && validation.type === 'error') {
      setEntryError(validation.message || "요청을 처리할 수 없습니다.");
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
        linkedSubItemId: (entryLinkedSubItemId && entryLinkedSubItemId !== 'UNLINKED') ? entryLinkedSubItemId : undefined,
      });
    } else {
      let linkedPlanId = undefined;
      
      // 자동 정산(Auto-settle) 로직: 동일 과목, 동일 금액의 미정산 원인행위(품의)가 있다면 자동으로 연결하고 정산 완료 처리
      const matchingPlan = entries.find(e => 
        e.categoryId === selectedCatId && 
        e.isPlanned && 
        !e.isSettled && 
        e.amount === reqAmount &&
        (!entryLinkedSubItemId || e.linkedSubItemId === entryLinkedSubItemId)
      );
      
      if (matchingPlan) {
        updateEntry(matchingPlan.id, { isSettled: true });
        linkedPlanId = matchingPlan.id;
        // 사용자에게 자동 정산되었음을 작게 알림
        console.log(`[Auto-Settle] 원인행위(${matchingPlan.purpose})가 자동 정산 및 연결되었습니다.`);
      }

      addEntry({
        categoryId: selectedCatId,
        amount: reqAmount,
        date: entryDate,
        purpose: entryPurpose,
        memo: entryMemo,
        actionType,
        docRegNum: entryDocNum,
        relatedPlanId: linkedPlanId,
        linkedSubItemId: (entryLinkedSubItemId && entryLinkedSubItemId !== 'UNLINKED') ? entryLinkedSubItemId : undefined,
      });
    }
    closeEntryModal();
  };

  const closeEntryModal = () => {
    setEntryError(null);
    setEntryAmount(''); setEntryPurpose(''); setEntryMemo(''); setEntryDocNum(''); setEntryLinkedSubItemId(''); setEditEntryId(null); setShowEntryModal(false);
  };

  const openEditCat = useCallback((cat: BudgetCategory) => {
    setCatBudget(cat.totalBudget ? cat.totalBudget.toLocaleString() : '');
    setCatPolicy(cat.policyProject || ''); setCatUnit(cat.unitProject || '');
    setCatDetail(cat.detailedProject || ''); 
    setCatManagement(cat.managementProject || '');
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
      const rawFunding = cat.fundingSource || '구비';
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
      if (parsedSplits.length === 0) parsedSplits.push({ source: '구비', amount: '' });
      setCatFundingSplits(parsedSplits);
    }
    
    if (cat.subItems && cat.subItems.length > 0) {
      setCatSubItems(cat.subItems.map(s => ({ 
        id: s.id,
        prefix: s.prefix || '', 
        name: s.name, 
        calculation: s.calculation || '', 
        amount: s.amount ? s.amount.toLocaleString() : '', 
        isCustomFunding: s.isCustomFunding || false,
        isLocked: s.isLocked || false,
        fundingSplits: s.fundingSplits && s.fundingSplits.length > 0 ? s.fundingSplits.map(fs => ({ source: fs.source, amount: fs.amount ? fs.amount.toLocaleString() : '' })) : [{source: '구비', amount: ''}],
        calculations: s.calculations ? s.calculations.map(c => ({ id: c.id, name: c.name || undefined, calculation: c.calculation || "", amount: c.amount ? c.amount.toLocaleString() : "", isCustomFunding: c.isCustomFunding || false, isLocked: c.isLocked || false, fundingSplits: c.fundingSplits && c.fundingSplits.length > 0 ? c.fundingSplits.map(fs => ({source: fs.source, amount: fs.amount ? fs.amount.toLocaleString() : ""})) : [{source: "구비", amount: ""}] })) : []
      })));
    } else {
      setCatSubItems([{prefix: '', name: '', calculation: '', amount: '', isCustomFunding: false, fundingSplits: [{source: '구비', amount: ''}], calculations: []}]);
    }
    
    setEditCatId(cat.id); setShowCatModal(true);
  }, []);

  const openAddCat = useCallback((template: Partial<BudgetCategory>) => {
    setCatBudget(template.totalBudget ? template.totalBudget.toLocaleString() : '');
    setCatPolicy(template.policyProject || ''); setCatUnit(template.unitProject || '');
    setCatDetail(template.detailedProject || ''); 
    setCatManagement(template.managementProject || '');
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
      const rawFunding = template.fundingSource || '구비';
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
      if (parsedSplits.length === 0) parsedSplits.push({ source: '구비', amount: '' });
      setCatFundingSplits(parsedSplits);
    }
    
    if (template.subItems && template.subItems.length > 0) {
      setCatSubItems(template.subItems.map(s => ({ 
        prefix: s.prefix || '', 
        name: s.name, 
        calculation: s.calculation || '', 
        amount: s.amount ? s.amount.toLocaleString() : '', 
        isCustomFunding: s.isCustomFunding || false,
        fundingSplits: s.fundingSplits && s.fundingSplits.length > 0 ? s.fundingSplits.map(fs => ({ source: fs.source, amount: fs.amount ? fs.amount.toLocaleString() : '' })) : [{source: '구비', amount: ''}],
        calculations: s.calculations ? s.calculations.map(c => ({ name: c.name || undefined, calculation: c.calculation || "", amount: c.amount ? c.amount.toLocaleString() : "", isCustomFunding: c.isCustomFunding || false, fundingSplits: c.fundingSplits && c.fundingSplits.length > 0 ? c.fundingSplits.map(fs => ({source: fs.source, amount: fs.amount ? fs.amount.toLocaleString() : ""})) : [{source: "구비", amount: ""}] })) : []
      })));
    } else {
      setCatSubItems([{prefix: '', name: '', calculation: '', amount: '', isCustomFunding: false, fundingSplits: [{source: '구비', amount: ''}], calculations: []}]);
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
         }).filter(Boolean).join(', ') || '구비';
         
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
    setCatPolicy(''); setCatUnit(''); setCatDetail(''); setCatManagement(''); setCatFormationCode(''); setCatFormationName(''); setCatStatCode(''); setCatStatName(''); setCatBudget(''); setCatFundingSplits([{source: '구비', amount: ''}]); setCatSubItems([{prefix: '', name: '', calculation: '', amount: '', isCustomFunding: false, isLocked: false, fundingSplits: [{source: '구비', amount: ''}], calculations: []}]);
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
    setEntryLinkedSubItemId(entry.linkedSubItemId || '');
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
            <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">세부사업명</label><input type="text" value={catDetail} onChange={e => setCatDetail(e.target.value)} className={inputClass} placeholder="예: 방문간호운영" /></div>
            <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">관리사업명 (선택)</label><input type="text" value={catManagement} onChange={e => setCatManagement(e.target.value)} className={inputClass} placeholder="예: 구강보건 (재원분리용)" /></div>

            <div className="col-span-2 mb-2">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2">예산 구분</label>
              <div className="flex gap-4">
                {['본예산', '간주예산', '추경'].map(type => (
                  <label key={type} className="flex items-center gap-1.5 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded-md transition-colors">
                    <input type="radio" name="catBudgetType" value={type} checked={catBudgetType === type} onChange={() => setCatBudgetType(type as any)} className="text-[var(--color-primary)] border-gray-300 focus:ring-[var(--color-primary)]" />
                    {type}
                  </label>
                ))}
              </div>
            </div>
            
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
                      <option value="국비">국비</option>
<option value="기금">기금</option>
<option value="시비">시비</option>
<option value="구비">구비</option>
<option value="특교">특교</option>
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
                <button type="button" onClick={() => setCatFundingSplits([...catFundingSplits, {source: '구비', amount: ''}])} className="text-[13px] text-blue-600 font-bold hover:underline flex items-center gap-1 mt-1.5 px-1 py-1 rounded hover:bg-blue-50 transition-colors">+ 재원 추가</button>
              </div>
            </div>
<div className="col-span-2 bg-indigo-50 p-4 rounded-xl border border-indigo-100 mt-2">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2.5 flex justify-between items-center">
                <span className="font-bold flex items-center gap-1.5 text-indigo-800"><FileCheck size={14} className="text-indigo-400"/> 세부 산출 내역 (옵션)</span>
                {(() => {
                  const tb = Number(catBudget.replace(/,/g, ''));
                  const totalSub = catSubItems.reduce((sum, s) => {
                    if (s.calculations && s.calculations.length > 0) {
                      return sum + s.calculations.reduce((subSum, c) => subSum + Number((c.amount || '0').replace(/,/g, '')), 0);
                    }
                    return sum + Number((s.amount || '0').replace(/,/g, ''));
                  }, 0);
                  const isMatch = tb > 0 && totalSub === tb;
                  if (totalSub === 0 && catSubItems.length <= 1 && (!catSubItems[0] || !catSubItems[0].amount)) return null;
                  return (
                    <span className={`text-[11px] px-2 py-0.5 rounded font-bold ${isMatch ? 'text-green-700 bg-green-100' : 'text-amber-600 bg-amber-100'}`}>
                      {isMatch ? '총액 일치 정상' : `부분 합산중 (${totalSub.toLocaleString()}원)`}
                    </span>
                  );
                })()}
              </label>
              <div className="space-y-2.5">
{catSubItems.map((sub, idx) => {
                  const hasCalculations = sub.calculations && sub.calculations.length > 0;
                  const autoComputedAmount = hasCalculations ? sub.calculations.reduce((s, c) => s + Number((c.amount || '0').replace(/,/g, '')), 0) : null;
                  const displayAmount = hasCalculations ? autoComputedAmount?.toLocaleString() : sub.amount;

                  return (
                  <div key={idx} className="flex flex-col gap-2 transition-all duration-200 bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm relative mb-2">
                    <div className="flex gap-2 items-center">
                      <input type="text" value={sub.prefix} onChange={e => {
                          const newSubs = [...catSubItems];
                          newSubs[idx].prefix = e.target.value;
                          setCatSubItems(newSubs);
                      }} onBlur={e => {
                          const val = e.target.value.trim();
                          if (/^\d+$/.test(val)) {
                              const newSubs = [...catSubItems];
                              newSubs[idx].prefix = val + ')';
                              setCatSubItems(newSubs);
                          }
                      }} className={`${inputClass} text-center font-bold text-[12px] px-1 shadow-inner`} style={{ flex: '0 0 45px' }} placeholder="1)" />
                      
                      <input type="text" value={sub.name} onChange={e => {
                          const newSubs = [...catSubItems];
                          newSubs[idx].name = e.target.value;
                          setCatSubItems(newSubs);
                      }} className={`${inputClass} text-[13px] font-bold outline-none ring-0 shadow-inner`} style={{ flex: 1 }} placeholder="항목 본명칭 (예: 어린이신체활동증진)" />
                      
                      {!hasCalculations && (
                        <input type="text" value={sub.calculation || ''} onChange={e => {
                            const newSubs = [...catSubItems];
                            newSubs[idx].calculation = e.target.value;
                            setCatSubItems(newSubs);
                        }} onBlur={e => {
                            const calcStr = e.target.value;
                            if (!calcStr || !calcStr.includes('*')) return;
                            const parts = calcStr.split('*');
                            let total = 1; let valid = false;
                            for (const p of parts) {
                               const isPct = p.includes('%');
                               const numStr = p.replace(/[^0-9.]/g, '');
                               if (numStr) {
                                  const num = parseFloat(numStr);
                                  total *= isPct ? (num / 100) : num;
                                  valid = true;
                               }
                            }
                            if (valid) {
                               const newSubs = [...catSubItems];
                               newSubs[idx].amount = Math.round(total).toLocaleString();
                               setCatSubItems(newSubs);
                            }
                        }} className={`${inputClass} text-[12px] font-mono shadow-inner`} style={{ flex: '0 0 160px' }} placeholder="단일 산출식 (선택)" />
                      )}

                      <div className="relative shrink-0" style={{ flex: '0 0 110px' }}>
                        <input type="text" value={displayAmount || ''} onChange={e => {
                          if (hasCalculations) return; // ReadOnly
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          const newSubs = [...catSubItems];
                          newSubs[idx].amount = val ? Number(val).toLocaleString() : '';
                          setCatSubItems(newSubs);
                        }} className={`${inputClass} pr-7 text-right font-bold transition-colors ${hasCalculations ? 'bg-indigo-50/50 text-indigo-700 pointer-events-none cursor-default shadow-none border-indigo-100' : 'text-gray-900 bg-white shadow-inner'}`} placeholder={hasCalculations ? "자동 합산" : "금액"} readOnly={hasCalculations || false} />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[11px] font-bold pointer-events-none">원</span>
                      </div>

                      <label className="flex items-center gap-1 cursor-pointer shrink-0 ml-1 bg-gray-50 px-2 py-1.5 rounded border border-gray-100 hover:bg-gray-100 transition-colors">
                         <input type="checkbox" checked={sub.isCustomFunding || false} onChange={e => {
                             const newSubs = [...catSubItems];
                             newSubs[idx].isCustomFunding = e.target.checked;
                             if (e.target.checked && (!newSubs[idx].fundingSplits || newSubs[idx].fundingSplits.length === 0)) {
                               newSubs[idx].fundingSplits = [{source: '구비', amount: ''}];
                             }
                             setCatSubItems(newSubs);
                         }} className="w-3.5 h-3.5 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer" title="이 항목 전체를 개별재원으로 지정" />
                         <span className={`text-[11px] font-extrabold tracking-tight ${sub.isCustomFunding ? 'text-teal-600' : 'text-gray-400'}`}>개별재원</span>
                      </label>

                      <label className={`flex items-center gap-1 cursor-pointer shrink-0 ml-1 px-2 py-1.5 rounded transition-colors border ${sub.isLocked ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}>
                         <input type="checkbox" checked={sub.isLocked || false} onChange={e => {
                             const newSubs = [...catSubItems];
                             newSubs[idx].isLocked = e.target.checked;
                             if (e.target.checked && newSubs[idx].calculations) {
                               newSubs[idx].calculations.forEach(c => c.isLocked = false);
                             }
                             setCatSubItems(newSubs);
                         }} className="w-3.5 h-3.5 rounded border-red-300 focus:ring-red-500 cursor-pointer text-red-500" title="이 항목 예산 지출 방지(잠금) 설정" />
                         <span className={`text-[11px] font-extrabold tracking-tight ${sub.isLocked ? 'text-red-600' : 'text-gray-400'}`}>🔒 잠금</span>
                      </label>

                      {catSubItems.length > 1 ? (
                        <button type="button" onClick={() => {
                          const newSubs = catSubItems.filter((_, i) => i !== idx);
                          setCatSubItems(newSubs);
                        }} className="p-1 px-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded transition-colors ml-1 border border-transparent hover:border-red-100" title="이 최상위 항목 완전 삭제"><X size={16}/></button>
                      ) : (
                        <div className="w-[30px] shrink-0 ml-1"></div>
                      )}
                    </div>

                    {/* Sub-calculations Area */}
                    <div className="ml-[53px] pl-2.5 border-l-[3px] border-indigo-100 py-1 flex flex-col gap-1.5 min-h-[30px]">
                       {sub.calculations && sub.calculations.map((calc, cIdx) => (
                         <div key={cIdx} className="flex flex-col gap-1 w-full border-b border-indigo-50 border-dashed pb-2 mb-1 last:border-0 last:pb-0 last:mb-0">
                           <div className="flex gap-2 items-center group relative w-full">
                             <span className="text-indigo-200 text-[11px] shrink-0 font-bold ml-1 select-none pr-1">↳</span>
                             
                             <input type="text" value={calc.name || ''} onChange={e => {
                                const newSubs = [...catSubItems];
                                newSubs[idx].calculations[cIdx].name = e.target.value;
                                setCatSubItems(newSubs);
                             }} className={`${inputClass} text-[12px] bg-white border-transparent focus:border-indigo-300 shadow-sm`} style={{ flex: '1 0 auto', maxWidth: '200px' }} placeholder="세부 산출명 (예: 식비)" />
                             
                             <input type="text" value={calc.calculation || ''} onChange={e => {
                                const newSubs = [...catSubItems];
                                newSubs[idx].calculations[cIdx].calculation = e.target.value;
                                setCatSubItems(newSubs);
                             }} onBlur={e => {
                                const calcStr = e.target.value;
                                if (!calcStr || !calcStr.includes('*')) return;
                                const parts = calcStr.split('*');
                                let total = 1; let valid = false;
                                for (const p of parts) {
                                   const isPct = p.includes('%');
                                   const numStr = p.replace(/[^0-9.]/g, '');
                                   if (numStr) {
                                      const num = parseFloat(numStr);
                                      total *= isPct ? (num / 100) : num;
                                      valid = true;
                                   }
                                }
                                if (valid) {
                                   const newSubs = [...catSubItems];
                                   newSubs[idx].calculations[cIdx].amount = Math.round(total).toLocaleString();
                                   setCatSubItems(newSubs);
                                }
                             }} className={`${inputClass} text-[12px] font-mono bg-white border-transparent focus:border-indigo-300 shadow-sm`} style={{ flex: '1' }} placeholder="상세식 (예: 8,000*30)" />
                             
                             <div className="relative shrink-0" style={{ flex: '0 0 130px' }}>
                               <input type="text" value={calc.amount || ''} onChange={e => {
                                 const val = e.target.value.replace(/[^0-9]/g, '');
                                 const newSubs = [...catSubItems];
                                 newSubs[idx].calculations[cIdx].amount = val ? Number(val).toLocaleString() : '';
                                 setCatSubItems(newSubs);
                               }} className={`${inputClass} pr-7 text-[15px] text-right font-extrabold text-slate-700 bg-white border-transparent focus:border-indigo-300 shadow-sm tracking-tight`} placeholder="금액" />
                               <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[11px] font-bold pointer-events-none">원</span>
                             </div>

                             <label className="flex items-center gap-1 cursor-pointer shrink-0 ml-1 whitespace-nowrap">
                                <input type="checkbox" checked={calc.isCustomFunding || false} onChange={e => {
                                    const newSubs = [...catSubItems];
                                    newSubs[idx].calculations[cIdx].isCustomFunding = e.target.checked;
                                    if (e.target.checked && (!newSubs[idx].calculations[cIdx].fundingSplits || newSubs[idx].calculations[cIdx].fundingSplits.length === 0)) {
                                      newSubs[idx].calculations[cIdx].fundingSplits = [{source: '구비', amount: ''}];
                                    }
                                    setCatSubItems(newSubs);
                                }} className="w-3.5 h-3.5 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer" title="이 세부 항목을 개별재원으로 지정" />
                                <span className={`text-[11px] font-extrabold tracking-tight ${calc.isCustomFunding ? 'text-teal-600' : 'text-gray-400'}`}>재원구분</span>
                             </label>
                             
                             <label className={`flex items-center gap-1 cursor-pointer shrink-0 ml-1 px-1.5 py-1 rounded transition-colors border ${calc.isLocked ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'bg-transparent border-transparent hover:bg-gray-100'}`}>
                                <input type="checkbox" checked={calc.isLocked || false} onChange={e => {
                                    const newSubs = [...catSubItems];
                                    newSubs[idx].calculations[cIdx].isLocked = e.target.checked;
                                    setCatSubItems(newSubs);
                                }} disabled={sub.isLocked} className="w-3.5 h-3.5 text-red-500 rounded border-red-300 focus:ring-red-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" title={sub.isLocked ? "상위 그룹이 이미 잠겨 있습니다" : "이 상세 내역 지출 방지(잠금) 설정"} />
                                <span className={`text-[11px] font-extrabold tracking-tight ${calc.isLocked ? 'text-red-600' : 'text-gray-400'} ${sub.isLocked ? 'opacity-50' : ''}`}>🔒 잠금</span>
                             </label>
                             
                             <button type="button" onClick={() => {
                                const newSubs = [...catSubItems];
                                newSubs[idx].calculations = newSubs[idx].calculations.filter((_, i) => i !== cIdx);
                                setCatSubItems(newSubs);
                             }} className="p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded transition-colors ml-1" title="상세 산출내역 삭제"><X size={14}/></button>
                           </div>

                           {calc.isCustomFunding && (
                             <div className="ml-[25px] flex flex-col gap-1.5 mt-0.5 pb-1">
                               {calc.fundingSplits && calc.fundingSplits.map((split, fIdx) => (
                                 <div key={fIdx} className="flex items-center gap-1.5 bg-teal-50/50 p-1.5 rounded-md border border-teal-100 w-max shrink-0">
                                   <select value={split.source} onChange={e => {
                                     const newSubs = [...catSubItems];
                                     newSubs[idx].calculations[cIdx].fundingSplits![fIdx].source = e.target.value;
                                     setCatSubItems(newSubs);
                                   }} className="px-2 py-1 text-[12px] bg-white border border-teal-200 rounded font-medium text-teal-800 w-[80px] outline-none">
                                     <option value="국비">국비</option>
                                     <option value="기금">기금</option>
                                     <option value="시비">시비</option>
                                     <option value="구비">구비</option>
                                     <option value="특교">특교</option>
                                   </select>
                                   <div className="relative w-[130px]">
                                     <input type="text" value={split.amount} onChange={e => {
                                       const val = e.target.value.replace(/[^0-9]/g, '');
                                       const newSubs = [...catSubItems];
                                       newSubs[idx].calculations[cIdx].fundingSplits![fIdx].amount = val ? Number(val).toLocaleString() : '';
                                       setCatSubItems(newSubs);
                                     }} className="w-full px-2 py-1.5 text-[12px] text-right bg-white border border-teal-200 rounded font-bold text-teal-900 pr-5 outline-none shadow-sm" placeholder="금액" />
                                     <span className="absolute right-2 top-1/2 -translate-y-1/2 text-teal-500 text-[10px] pointer-events-none">원</span>
                                   </div>
                                   <span className="text-[11px] font-bold text-teal-600 ml-1 w-[40px] inline-block text-right pr-1">
                                     {(() => {
                                        const itemAmt = Number((String(calc.amount) || '0').replace(/,/g, ''));
                                        const fAmt = Number((split.amount || '0').replace(/,/g, ''));
                                        if (itemAmt === 0) return '0%';
                                        return ((fAmt / itemAmt) * 100).toFixed(0) + '%';
                                     })()}
                                   </span>
                                   {(calc.fundingSplits && calc.fundingSplits.length > 1) ? (
                                     <button type="button" onClick={() => {
                                       const newSubs = [...catSubItems];
                                       newSubs[idx].calculations[cIdx].fundingSplits = newSubs[idx].calculations[cIdx].fundingSplits!.filter((_, i) => i !== fIdx);
                                       setCatSubItems(newSubs);
                                     }} className="text-red-400 hover:text-red-600 rounded transition-colors ml-1 p-0.5" title="재원 삭제"><X size={14}/></button>
                                   ) : (
                                     <div className="w-[18px] ml-1"></div>
                                   )}
                                 </div>
                               ))}
                               <div className="flex items-center w-full max-w-[215px] mt-0.5">
                                 <button type="button" onClick={() => {
                                    const newSubs = [...catSubItems];
                                    if (!newSubs[idx].calculations[cIdx].fundingSplits) newSubs[idx].calculations[cIdx].fundingSplits = [];
                                    newSubs[idx].calculations[cIdx].fundingSplits.push({source: '구비', amount: ''});
                                    setCatSubItems(newSubs);
                                 }} className="text-[10px] text-teal-600 font-bold hover:bg-teal-50 px-1.5 py-1 rounded transition-colors flex-shrink-0">+ 비율 추가</button>

                                 <div className="ml-auto text-[10px] font-bold text-right pl-2">
                                    {(() => {
                                      const itemAmt = Number((String(calc.amount) || '0').replace(/,/g, ''));
                                      const fTotal = (calc.fundingSplits || []).reduce((sum, f) => sum + Number((f.amount || '0').replace(/,/g, '')), 0);
                                      if (itemAmt > 0 && fTotal === itemAmt) return <span className="text-teal-600">금액 일치 정상</span>;
                                      return <span className="text-red-500">진행중 ({fTotal.toLocaleString()}원)</span>;
                                    })()}
                                 </div>
                               </div>
                             </div>
                           )}
                         </div>
                       ))}
                       <div className="flex">
                         <button type="button" onClick={() => {
                            const newSubs = [...catSubItems];
                            if (!newSubs[idx].calculations) newSubs[idx].calculations = [];
                            newSubs[idx].calculations.push({ name: '', calculation: '', amount: '' });
                            setCatSubItems(newSubs);
                         }} className="text-[11px] text-indigo-500 font-bold hover:bg-indigo-50 px-2 py-1 rounded transition-colors flex items-center gap-1">+ 종속 산출내역 한 줄 추가</button>
                       </div>
                    </div>

                    {/* Custom Funding Block */}
                    {sub.isCustomFunding && (
                      <div className="mt-1 pt-2 border-t border-gray-100 flex flex-col pl-[53px]">
                        <div className="text-[11px] text-teal-700 font-bold mb-1.5 flex items-center gap-1">
                          ↳ 이 항목(총 {displayAmount || '0'}원)에 대한 개별 재원 매칭
                        </div>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {sub.fundingSplits && sub.fundingSplits.map((split, fIdx) => (
                            <div key={fIdx} className="flex flex-col gap-0.5 relative group bg-teal-50/50 p-1 rounded border border-teal-100">
                              <div className="flex items-center gap-1">
                                <select value={split.source} onChange={e => {
                                  const newSubs = [...catSubItems];
                                  newSubs[idx].fundingSplits[fIdx].source = e.target.value;
                                  setCatSubItems(newSubs);
                                }} className="px-1.5 py-1 text-[11px] bg-white border border-teal-200 rounded font-medium text-teal-800 w-[70px] outline-none">
                                  <option value="국비">국비</option>
<option value="기금">기금</option>
<option value="시비">시비</option>
<option value="구비">구비</option>
<option value="특교">특교</option>
                                </select>
                                <div className="relative w-[100px]">
                                  <input type="text" value={split.amount} onChange={e => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    const newSubs = [...catSubItems];
                                    newSubs[idx].fundingSplits[fIdx].amount = val ? Number(val).toLocaleString() : '';
                                    setCatSubItems(newSubs);
                                  }} className="w-full px-2 py-1 text-[11px] text-right bg-white border border-teal-200 rounded font-bold text-teal-900 pr-5 outline-none shadow-sm" placeholder="분할 금액" />
                                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-teal-500 text-[9px] pointer-events-none">원</span>
                                </div>
                                <span className="text-[10px] font-bold text-teal-600 ml-0.5 w-[30px] inline-block text-right pr-1">
                                  {(() => {
                                     const itemAmt = Number((String(displayAmount) || '0').replace(/,/g, ''));
                                     const fAmt = Number((split.amount || '0').replace(/,/g, ''));
                                     if (itemAmt === 0) return '0%';
                                     return ((fAmt / itemAmt) * 100).toFixed(1) + '%';
                                  })()}
                                </span>
                                {(sub.fundingSplits && sub.fundingSplits.length > 1) ? (
                                  <button type="button" onClick={() => {
                                    const newSubs = [...catSubItems];
                                    newSubs[idx].fundingSplits = newSubs[idx].fundingSplits.filter((_, i) => i !== fIdx);
                                    setCatSubItems(newSubs);
                                  }} className="p-1 text-red-400 hover:bg-white rounded transition-colors" title="재원 삭제"><X size={12}/></button>
                                ) : (
                                  <div className="w-[20px]"></div>
                                )}
                              </div>
                            </div>
                          ))}
                          
                          <button type="button" onClick={() => {
                             const newSubs = [...catSubItems];
                             if (!newSubs[idx].fundingSplits) newSubs[idx].fundingSplits = [];
                             newSubs[idx].fundingSplits.push({source: '구비', amount: ''});
                             setCatSubItems(newSubs);
                          }} className="text-[10px] text-teal-600 font-bold hover:bg-teal-50 px-2 py-1.5 rounded transition-colors h-[28px]">+ 비율 추가</button>

                          <div className="ml-auto text-[10px] font-bold">
                             {(() => {
                               const itemAmt = Number((String(displayAmount) || '0').replace(/,/g, ''));
                               const fTotal = (sub.fundingSplits || []).reduce((sum, f) => sum + Number((f.amount || '0').replace(/,/g, '')), 0);
                               if (itemAmt > 0 && fTotal === itemAmt) return <span className="text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">결과 정상 일치</span>;
                               return <span className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">합산 진행중 ({fTotal.toLocaleString()}원)</span>;
                             })()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
                <button type="button" onClick={() => setCatSubItems([...catSubItems, {prefix: '', name: '', calculation: '', amount: '', isCustomFunding: false, isLocked: false, fundingSplits: [{source: '구비', amount: ''}], calculations: []}])} className="text-[13px] text-indigo-600 font-bold hover:underline flex items-center gap-1 mt-1.5 px-1 py-1 rounded hover:bg-indigo-100 transition-colors">+ 산출내역 한 줄 추가</button>
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
                    <option value="국비">국비</option>
                    <option value="기금">기금</option>
                    <option value="시비">시비</option>
                    <option value="구비">구비</option>
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
        
        <div className="flex items-center justify-between bg-blue-50/50 p-2.5 rounded-lg border border-blue-100 mb-4 cursor-pointer hover:bg-blue-50 transition-colors" onClick={() => document.getElementById('expense-pdf-upload')?.click()}>
          <div className="flex items-center gap-2">
            <div className="bg-blue-100 p-1.5 rounded-md text-blue-600"><Upload size={16} /></div>
            <div>
              <div className="text-xs font-bold text-blue-900">📄 영수증/결재문서 PDF 자동 인식 (AI 파싱)</div>
              <div className="text-[10px] text-blue-600 mt-0.5">파일을 첨부하면 금액과 예산과목을 자동으로 추출합니다.</div>
            </div>
          </div>
          <input 
            id="expense-pdf-upload"
            type="file" 
            accept=".pdf" 
            className="hidden" 
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const arrBuf = await file.arrayBuffer();
                const text = await extractTextFromPdfBuffer(arrBuf);
                
                // 파싱: 금액 추출
                const amtMatch = extractAmount(text);
                if (amtMatch && !entryAmount) setEntryAmount(amtMatch.amount.toLocaleString('ko-KR'));
                
                // 파싱: 예산과목 추출
                if (!selectedCatId && text.trim().length >= 2) {
                  const sortedCats = [...categories].sort((a,b) => b.name.length - a.name.length);
                  const matchedCat = sortedCats.find(c => 
                    text.includes(c.name) || 
                    (c.statItem && text.includes(c.statItem)) ||
                    (c.subItems && c.subItems.some(sub => sub.name && sub.name.length >= 3 && text.includes(sub.name)))
                  );
                  if (matchedCat) setSelectedCatId(matchedCat.id);
                }
                
                // 보조 지표: 문서 내용을 품의 내용에 일부 채워줌
                // 보조 지표: 문서 내용을 품의 내용에 채워줌 (기안/결재선 제외 정책)
                if (!entryPurpose) {
                   const excludeKeywords = ['결재', '날짜', '팀장', '과장', '소장', '전결', '대결', '기안자', '협조자', '결 재', '수신', '발신', '담당자', '문서번호', '시행일자', '공개여부', '건강증진'];
                   const titleCandidates = text.split('\n').map(l => l.trim()).filter(l => 
                     l.length > 5 && 
                     !excludeKeywords.some(kw => l.includes(kw))
                   );
                   
                   // 보통 공문서/품의서 제목은 이런 단어로 끝나는 경향이 큼
                   let bestTitle = titleCandidates.find(l => 
                     l.endsWith('건') || l.endsWith('계획') || l.endsWith('보고') || 
                     l.endsWith('지급') || l.endsWith('요청') || l.endsWith('안내') || 
                     l.endsWith('품의') || l.endsWith('결과')
                   );
                   
                   if (!bestTitle) bestTitle = titleCandidates[0]; // 없으면 유효한 첫 문장
                   if (bestTitle) setEntryPurpose(bestTitle.slice(0, 50));
                }
                if (!entryMemo) {
                   setEntryMemo("PDF 스캔 데이터 적용 완료");
                }
                
                alert("PDF 로드 및 파싱 완료!");
              } catch (err) {
                alert("PDF 파싱 에러: " + err);
              }
              // input 초기화 (같은 파일 재업로드시 동작 보장)
              if (e.target) e.target.value = '';
            }}
          />
        </div>
        
        {entryError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-bold shadow-sm flex items-center justify-between mb-4">
            <div>{entryError.split('\n').map((line, i) => <span key={i}>{line}<br/></span>)}</div>
          </div>
        )}
        <form onSubmit={handleAddEntry} className="space-y-4">
          
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">예산 과목 *</label>
            <div className="flex items-center gap-2">
              <select value={selectedCatId} onChange={e => setSelectedCatId(e.target.value)} className={`${inputClass} flex-1`} required>
                <option value="">선택</option>
                {categories.map(c => <option key={c.id} value={c.id}>[{c.fundingSource || '자체'}] {c.detailedProject ? `${c.detailedProject} - ` : ''}{c.name}</option>)}
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

          {(() => {
            const cat = categories.find(c => c.id === selectedCatId);
            const hasSubItems = cat?.subItems && cat.subItems.some(sub => (sub.name && sub.name.trim() !== '') || (sub.calculations && sub.calculations.length > 0));
            if (!hasSubItems) return null;

            const options: {id: string, name: string, isLocked: boolean, amount: number}[] = [];
            cat.subItems!.forEach(sub => {
              if (sub.calculations && sub.calculations.length > 0) {
                sub.calculations.forEach(calc => {
                  const cId = calc.id || calc.name || sub.name;
                  if (cId) options.push({ id: cId, name: calc.name || sub.name, isLocked: calc.isLocked || sub.isLocked || false, amount: calc.amount });
                });
              } else {
                const sId = sub.id || sub.name;
                if (sId) options.push({ id: sId, name: sub.name, isLocked: sub.isLocked || false, amount: sub.amount });
              }
            });

            return (
              <div className="bg-teal-50 p-3 rounded-lg border border-teal-200 mb-4 shadow-sm">
                <label className="block text-xs font-bold text-teal-800 mb-1.5 flex items-center gap-1">✨ 세부 예산 집중 통제</label>
                <select value={entryLinkedSubItemId} onChange={e => setEntryLinkedSubItemId(e.target.value)} className={`${inputClass} flex-1 border-teal-300 focus:ring-teal-500`} required>
                  <option value="">-- 어느 '세부 항목' 예산에서 지출하시겠습니까? --</option>
                  <option value="UNLINKED" className="text-gray-500 font-bold bg-gray-50">
                    {actionType === 'daily_expense' || actionType === 'issuance' ? '-- (일상경비 전용) 해당 과목 일상경비 집행 원장으로 연결 --' : '-- (미지정) 통계목 일반 전체 공통 예산으로 지출 --'}
                  </option>
                  {options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                </select>
              </div>
            );
          })()}

          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">금액 (원) *</label>
             <input type="text" value={entryAmount} onChange={e => {
               const raw = e.target.value.replace(/[^0-9]/g, '');
               setEntryAmount(raw ? Number(raw).toLocaleString('ko-KR') : '');
             }} className={inputClass} required placeholder="0" />
          </div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">품의 내용 *</label><input type="text" value={entryPurpose} onChange={e => {
            const val = e.target.value;
            setEntryPurpose(val);
            
            // 파싱: 금액 자동 추출
            const amtMatch = extractAmount(val);
            if (amtMatch && !entryAmount) {
              setEntryAmount(amtMatch.amount.toLocaleString('ko-KR'));
            }
            
            // 파싱: 예산 과목 자동 추출
            if (!selectedCatId && val.trim().length >= 2) {
              // 가장 긴 매칭을 우선시하도록 내림차순 정렬 검색
              const sortedCats = [...categories].sort((a,b) => b.name.length - a.name.length);
              const matchedCat = sortedCats.find(c => 
                 val.includes(c.name) || 
                 (c.statItem && val.includes(c.statItem)) ||
                 (c.subItems && c.subItems.some(sub => sub.name && sub.name.length >= 3 && val.includes(sub.name)))
              );
              if (matchedCat) {
                setSelectedCatId(matchedCat.id);
              }
            }
          }} className={inputClass} required placeholder="예: 행사운영비 15000원 결제" /></div>
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
