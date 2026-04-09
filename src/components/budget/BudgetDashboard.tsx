'use client';

import React, { useState, useMemo } from 'react';
import { BudgetCategory, BudgetEntry, BudgetEntryType, generateId } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Modal } from '@/components/ui/modal';
import { Plus, Pencil, Trash2, FileCheck, FilePlus2, CheckCircle2, AlertOctagon, ShieldAlert, RefreshCw } from 'lucide-react';
import { replaceAll } from '@/lib/sheets-api';

interface BudgetDashboardProps {
  categories: BudgetCategory[];
  entries: BudgetEntry[];
  addCategory: (cat: Omit<BudgetCategory, 'id'>) => BudgetCategory;
  updateCategory: (id: string, updates: Partial<BudgetCategory>) => void;
  deleteCategory: (id: string) => void;
  addEntry: (entry: Omit<BudgetEntry, 'id'>) => void;
  deleteEntry: (id: string) => void;
  getCategoryStats: (id: string) => { totalBudget: number; spent: number; planned: number; remaining: number; usageRate: number } | null;
  overallStats: { totalBudget: number; totalSpent: number; totalPlanned: number; remaining: number };
  addKnowledge?: (k: { title: string; content: string; category: string; tags: string[] }) => void;
}

function formatN(n: number) { return n.toLocaleString('ko-KR'); }

const COLORS = ['#4A6CF7', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const TYPE_CONFIG: Record<BudgetEntryType, { label: string; badge: string; badgeBg: string; icon: typeof FilePlus2 }> = {
  approval:   { label: '지출 품의', badge: '품의', badgeBg: 'bg-amber-100 text-amber-700', icon: FilePlus2 },
  resolution: { label: '지출 결의', badge: '결의', badgeBg: 'bg-blue-100 text-blue-700', icon: FileCheck },
};

export function BudgetDashboard(props: BudgetDashboardProps) {
  const { categories, entries, addCategory, updateCategory, deleteCategory, addEntry, deleteEntry, getCategoryStats, overallStats } = props;
  const [showCatModal, setShowCatModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [catName, setCatName] = useState('');
  const [catBudget, setCatBudget] = useState('');
  
  const [catPolicy, setCatPolicy] = useState('');
  const [catUnit, setCatUnit] = useState('');
  const [catDetail, setCatDetail] = useState('');
  const [catStat, setCatStat] = useState('');

  const [filterPolicy, setFilterPolicy] = useState('all');
  const [filterUnit, setFilterUnit] = useState('all');
  const [filterDetail, setFilterDetail] = useState('all');
  const [filterStat, setFilterStat] = useState('all');

  const [nationalFund, setNationalFund] = useState('');
  const [localFund, setLocalFund] = useState('');
  
  const [entryAmount, setEntryAmount] = useState('');
  const [entryPurpose, setEntryPurpose] = useState('');
  const [entryMemo, setEntryMemo] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryType, setEntryType] = useState<BudgetEntryType>('approval');
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<'all' | BudgetEntryType>('all');

  const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow";

  // Stats by type
  const typeStats = useMemo(() => {
    const approvalTotal = entries.filter(e => (e.entryType || 'resolution') === 'approval').reduce((s, e) => s + e.amount, 0);
    const resolutionTotal = entries.filter(e => (e.entryType || 'resolution') === 'resolution').reduce((s, e) => s + e.amount, 0);
    return { approvalTotal, resolutionTotal };
  }, [entries]);

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
    const reqAmount = Number(entryAmount);
    
    // 1. 가용 잔액 확인
    if (stats && reqAmount > stats.remaining) {
      alert(`Error: 잔액이 부족합니다. (현재 가용 실 잔액: ${formatN(stats.remaining)}원)`);
      return;
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

    addEntry({
      categoryId: selectedCatId,
      amount: reqAmount,
      date: entryDate,
      purpose: entryPurpose,
      memo: entryMemo,
      isPlanned: entryType === 'approval',
      entryType,
    });
    setEntryAmount(''); setEntryPurpose(''); setEntryMemo(''); setShowEntryModal(false);
  };

  const openEditCat = (cat: BudgetCategory) => {
    setCatName(cat.name); setCatBudget(cat.totalBudget.toString());
    setCatPolicy(cat.policyProject || ''); setCatUnit(cat.unitProject || '');
    setCatDetail(cat.detailedProject || ''); setCatStat(cat.statItem || '');
    setEditCatId(cat.id); setShowCatModal(true);
  };

  const openEntryModal = (type: BudgetEntryType) => {
    setEntryType(type);
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
  const unitOptions = useMemo(() => Array.from(new Set(categories.filter(c => filterPolicy === 'all' || c.policyProject === filterPolicy).map(c => c.unitProject).filter(Boolean))), [categories, filterPolicy]);
  const detailOptions = useMemo(() => Array.from(new Set(categories.filter(c => (filterPolicy === 'all' || c.policyProject === filterPolicy) && (filterUnit === 'all' || c.unitProject === filterUnit)).map(c => c.detailedProject).filter(Boolean))), [categories, filterPolicy, filterUnit]);
  const statOptions = useMemo(() => Array.from(new Set(categories.filter(c => (filterPolicy === 'all' || c.policyProject === filterPolicy) && (filterUnit === 'all' || c.unitProject === filterUnit) && (filterDetail === 'all' || c.detailedProject === filterDetail)).map(c => c.statItem).filter(Boolean))), [categories, filterPolicy, filterUnit, filterDetail]);

  const filteredCategoriesTree = useMemo(() => {
    return categories.filter(c => {
      if (filterPolicy !== 'all' && c.policyProject !== filterPolicy) return false;
      if (filterUnit !== 'all' && c.unitProject !== filterUnit) return false;
      if (filterDetail !== 'all' && c.detailedProject !== filterDetail) return false;
      if (filterStat !== 'all' && c.statItem !== filterStat) return false;
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

  const handleSeedRulesToWiki = () => {
    if (!props.addKnowledge) return;
    const ruleText = `
## 통합건강증진사업 지침 및 실무 가이드라인
1. **국시비 매칭 비율**: 국비 30%, 지방비 70% 비율 엄수
2. **금지 비목**: 자산취득비(400목), 인건비(100목) 편성 및 집행 엄격 금지 (별도 예산 활용)
3. **일반수용비 강제**: 소규모 수수료, 전문가 자문료, 속기료, 사례금은 반드시 일반수용비(210-01)로 집행
4. **인력 운용 주의**: 일용임금, 행정보조 인력 등을 편법적으로 계속 고용하거나 중복 계상하는 것을 강력히 금지함
5. **리스크 관리**: 3분기(9월) 집행률 70% 미만 사업 및 회계연도 마감 45일 전 10% 이상 남은 예산은 즉각 정리 및 추경/전용 고려
    `.trim();
    
    props.addKnowledge({
      title: "지역사회 통합건강증진사업 지출/편성 5대 원칙",
      content: ruleText,
      category: "예산지침",
      tags: ["통합건강증진", "예산", "컴플라이언스", "규정"]
    });
    alert("예산 실무 알고리즘 지침서가 사내 위키에 성공적으로 배포되었습니다!");
  };

  const handleFactoryReset = async () => {
    if (!window.confirm("주의: 현재 등록된 모든 예산 과목이 삭제되고, 엑셀 시트 분석본(정확히 6개 단위사업)으로 완전히 초기화됩니다. 계속하시겠습니까?")) return;
    
    // Inject ALL 6 precise unit projects to cascade perfectly
    const fullDefaults: BudgetCategory[] = [
      { id: generateId(), name: '행정운영경비 (인력운영비)', totalBudget: 20908048000, color: '#4A6CF7', policyProject: '행정운영경비', unitProject: '인력운영비', detailedProject: '기본 보수', statItem: '기본급' },
      { id: generateId(), name: '행정운영경비 (기본경비)', totalBudget: 14876000, color: '#3B82F6', policyProject: '행정운영경비', unitProject: '기본경비', detailedProject: '부서운영 기본수용비', statItem: '일반수용비(210-01)' },
      { id: generateId(), name: '건강증진 (보건소운영지원)', totalBudget: 1805177000, color: '#F59E0B', policyProject: '건강증진', unitProject: '보건소 운영지원', detailedProject: '보건소 기능유지 및 청사관리', statItem: '일반수용비(210-01)' },
      { id: generateId(), name: '건강증진 (사업관리)', totalBudget: 16360000, color: '#FCD34D', policyProject: '건강증진', unitProject: '건강증진사업관리', detailedProject: '의료비 지원업무 추진', statItem: '사무관리비' },
      { id: generateId(), name: '건강도시조성 (사업활성화)', totalBudget: 45860000, color: '#10B981', policyProject: '건강도시 조성', unitProject: '건강도시사업 활성화', detailedProject: '시민건강관리', statItem: '행사운영비' },
      { id: generateId(), name: '건강도시조성 (실천사업)', totalBudget: 225502000, color: '#34D399', policyProject: '건강도시 조성', unitProject: '건강생활 실천사업', detailedProject: '지역사회 건강조사', statItem: '연구용역비' },
    ];
    
    try {
      await replaceAll('BUDGET_CATEGORIES', fullDefaults);
      localStorage.setItem('hchps-budget-categories', JSON.stringify(fullDefaults));
      alert("공공행정 표준 데이터베이스(6개 카테고리) 설정이 완료되었습니다! 페이지를 새로고침합니다.");
      window.location.reload();
    } catch (e) {
      alert("오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

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
          <button onClick={handleFactoryReset} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 bg-red-50 text-sm font-bold hover:bg-red-100 transition-colors cursor-pointer tooltip" title="잔여 데이터 오류 완전 초기화">
            <RefreshCw size={16} /> 6계층 초기화
          </button>
          {props.addKnowledge && (
            <button onClick={handleSeedRulesToWiki} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/5 text-sm font-medium hover:bg-[var(--color-primary)]/10 transition-colors cursor-pointer">
              <CheckCircle2 size={16} /> 지침 위키 배포
            </button>
          )}
          <button onClick={() => { setEditCatId(null); setCatName(''); setCatBudget(''); setShowCatModal(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer">
            <Plus size={16} /> 예산 과목
          </button>
          <button onClick={() => openEntryModal('approval')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer" disabled={categories.length === 0}>
            <FilePlus2 size={16} /> 지출 품의
          </button>
          <button onClick={() => openEntryModal('resolution')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer" disabled={categories.length === 0}>
            <FileCheck size={16} /> 지출 결의
          </button>
        </div>
      </div>

      {/* Hierarchical Filters */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border-light)] p-3 rounded-xl flex flex-wrap gap-2 shadow-sm">
        <select value={filterPolicy} onChange={e => { setFilterPolicy(e.target.value); setFilterUnit('all'); setFilterDetail('all'); setFilterStat('all'); }} className="px-3 py-1.5 rounded-md border border-gray-200 text-sm focus:ring-1 focus:ring-blue-500 max-w-[200px]">
          <option value="all">정책사업명 전체</option>
          {(uniquePolicies as string[]).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterUnit} onChange={e => { setFilterUnit(e.target.value); setFilterDetail('all'); setFilterStat('all'); }} className="px-3 py-1.5 rounded-md border border-gray-200 text-sm focus:ring-1 focus:ring-blue-500 max-w-[200px]" disabled={unitOptions.length === 0}>
          <option value="all">단위사업명 전체</option>
          {(unitOptions as string[]).map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={filterDetail} onChange={e => { setFilterDetail(e.target.value); setFilterStat('all'); }} className="px-3 py-1.5 rounded-md border border-gray-200 text-sm focus:ring-1 focus:ring-blue-500 max-w-[200px]" disabled={detailOptions.length === 0}>
          <option value="all">세부사업명 전체</option>
          {(detailOptions as string[]).map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterStat} onChange={e => setFilterStat(e.target.value)} className="px-3 py-1.5 rounded-md border border-gray-200 text-sm focus:ring-1 focus:ring-blue-500 max-w-[200px]" disabled={statOptions.length === 0}>
          <option value="all">통계목 전체</option>
          {(statOptions as string[]).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Overall Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent>
          <div className="text-xs text-[var(--color-text-tertiary)]">전체 예산</div>
          <div className="text-lg font-bold mt-1">{formatN(overallStats.totalBudget)}원</div>
        </CardContent></Card>
        <Card><CardContent>
          <div className="text-xs text-[var(--color-text-tertiary)]">품의 금액</div>
          <div className="text-lg font-bold mt-1 text-amber-600">{formatN(typeStats.approvalTotal)}원</div>
        </CardContent></Card>
        <Card><CardContent>
          <div className="text-xs text-[var(--color-text-tertiary)]">결의 금액</div>
          <div className="text-lg font-bold mt-1 text-[var(--color-primary)]">{formatN(typeStats.resolutionTotal)}원</div>
        </CardContent></Card>
        <Card><CardContent>
          <div className="text-xs text-[var(--color-text-tertiary)]">잔여 예산</div>
          <div className={`text-lg font-bold mt-1 ${overallStats.remaining < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>{formatN(overallStats.remaining)}원</div>
        </CardContent></Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {([['all', '전체'], ['approval', '품의'], ['resolution', '결의']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setViewFilter(key)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              viewFilter === key
                ? 'bg-white text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {label}
            <span className="ml-1 text-[10px] opacity-60">
              ({key === 'all' ? entries.length : entries.filter(e => (e.entryType || 'resolution') === key).length})
            </span>
          </button>
        ))}
      </div>

      {/* Categories */}
      {categories.length === 0 ? (
        <Card><div className="px-5 py-10 text-center text-sm text-[var(--color-text-tertiary)]">예산 과목을 추가해 보세요</div></Card>
      ) : (
        <div className="space-y-3">
          {groupedByPolicy.length === 0 && <div className="text-center text-sm text-gray-500 py-8">선택된 필터에 해당하는 예산 과목이 없습니다.</div>}
          {groupedByPolicy.map(group => {
            const { policyName, cats } = group;
            const totalBudget = cats.reduce((s, c) => s + c.totalBudget, 0);
            let spent = 0; let planned = 0; let remaining = 0;
            
            cats.forEach(c => {
              const st = getCategoryStats(c.id);
              if (st) { spent += st.spent; planned += st.planned; remaining += st.remaining; }
            });
            const usageRate = totalBudget > 0 ? Math.round((spent / totalBudget) * 100) : 0;
            
            const catIds = cats.map(c => c.id);
            const groupEntries = entries
              .filter(e => catIds.includes(e.categoryId))
              .filter(e => viewFilter === 'all' || (e.entryType || 'resolution') === viewFilter)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            return (
              <Card key={policyName} className="overflow-hidden border border-[var(--color-border-light)] shadow-sm">
                <div className="px-5 py-4 bg-gray-50/80 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[var(--color-primary)]" />
                      <h3 className="font-bold text-[15px] text-gray-800">{policyName}</h3>
                    </div>
                    <div className="text-[11px] text-gray-400 font-medium px-2 py-0.5 rounded-full bg-gray-200">단위사업 {cats.length}개</div>
                  </div>
                  <div className="flex justify-between text-xs mb-1.5 px-1">
                    <span className="text-[var(--color-text-secondary)] font-medium">총 사용 {formatN(spent)}원 / {formatN(totalBudget)}원</span>
                    <span className="text-[var(--color-primary)] font-bold">잔여 {formatN(remaining)}원</span>
                  </div>
                  <ProgressBar value={usageRate} showLabel />
                  {planned > 0 && <div className="text-xs text-amber-600 mt-1.5 font-medium px-1">📋 품의 예정액: {formatN(planned)}원</div>}
                </div>
                
                {/* Unit Projects inside the Policy */}
                <div className="px-5 py-3 divide-y divide-gray-100">
                  {cats.map(cat => {
                    const stats = getCategoryStats(cat.id);
                    if (!stats) return null;
                    return (
                      <div key={cat.id} className="py-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="text-xs font-semibold flex items-center gap-2 text-gray-700">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }}/>
                            {cat.unitProject || cat.name}
                            <span className="text-[10px] text-gray-400 font-normal truncate max-w-[120px] sm:max-w-[200px]">({cat.name})</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEditCat(cat)} className="p-1 rounded hover:bg-gray-100 text-gray-400"><Pencil size={12} /></button>
                            <button onClick={() => deleteCategory(cat.id)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                          </div>
                        </div>
                        <div className="flex justify-between text-[11px] mb-1.5">
                          <span className="text-gray-500">사용 {formatN(stats.spent)} / {formatN(stats.totalBudget)}</span>
                          <span className="text-gray-500 font-medium">잔여 {formatN(stats.remaining)}</span>
                        </div>
                        {/* We hide the internal label since it's redundant with the large one, but use custom height */}
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                           <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, stats.usageRate)}%`, backgroundColor: cat.color }} />
                        </div>
                      </div>
                    )
                  })}
                  
                  {/* Entries for the whole Policy Project */}
                  {groupEntries.length > 0 && (
                    <div className="pt-3 space-y-2 mt-2">
                      <div className="text-[10px] font-bold text-gray-400 mb-1 ml-1 uppercase tracking-wider">최근 지출 내역</div>
                      {groupEntries.slice(0, 6).map(entry => {
                        const cfg = TYPE_CONFIG[(entry.entryType || 'resolution') as BudgetEntryType];
                        const parentCat = cats.find(c => c.id === entry.categoryId);
                        return (
                          <div key={entry.id} className="flex items-center justify-between text-xs group bg-gray-50/60 p-2 rounded-lg border border-gray-100">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${cfg.badgeBg}`}>{cfg.badge}</span>
                              <span className="text-[10px] bg-white border border-gray-200 text-gray-600 px-1 py-0.5 rounded truncate max-w-[70px] hidden sm:block">{parentCat?.unitProject || '알수없음'}</span>
                              <span className="text-[var(--color-text-secondary)] font-medium truncate">{entry.purpose}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                              <span className="font-semibold text-gray-700">{formatN(entry.amount)}원</span>
                              <button onClick={() => deleteEntry(entry.id)} className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-opacity"><Trash2 size={12} /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Category Modal */}
      <Modal isOpen={showCatModal} onClose={() => setShowCatModal(false)} title={editCatId ? '예산 과목 수정' : '새 예산 과목'} size="lg">
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
      <Modal isOpen={showEntryModal} onClose={() => setShowEntryModal(false)} title={TYPE_CONFIG[entryType].label} size="sm">
        <form onSubmit={handleAddEntry} className="space-y-4">
          {/* Type selector */}
          <div className="flex gap-2">
            {(['approval', 'resolution'] as const).map(type => {
              const cfg = TYPE_CONFIG[type];
              const Icon = cfg.icon;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setEntryType(type)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer border ${
                    entryType === type
                      ? type === 'approval'
                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                        : 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:bg-gray-50'
                  }`}
                >
                  <Icon size={14} /> {cfg.label}
                </button>
              );
            })}
          </div>

          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">예산 과목 *</label>
            <select value={selectedCatId} onChange={e => setSelectedCatId(e.target.value)} className={inputClass} required>
              <option value="">선택</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">금액 (원) *</label><input type="number" value={entryAmount} onChange={e => setEntryAmount(e.target.value)} className={inputClass} required placeholder="0" /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">{entryType === 'approval' ? '품의 내용' : '지출 목적'} *</label><input type="text" value={entryPurpose} onChange={e => setEntryPurpose(e.target.value)} className={inputClass} required placeholder={entryType === 'approval' ? '어떤 지출을 승인받을 건지' : '무엇에 사용했는지'} /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">날짜</label><input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className={inputClass} /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">메모</label><input type="text" value={entryMemo} onChange={e => setEntryMemo(e.target.value)} className={inputClass} placeholder="추가 메모 (선택)" /></div>
          <button
            type="submit"
            className={`w-full px-4 py-2.5 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer ${
              entryType === 'approval' ? 'bg-amber-500' : 'bg-[var(--color-primary)]'
            }`}
          >
            {TYPE_CONFIG[entryType].label} 등록
          </button>
        </form>
      </Modal>
    </div>
  );
}
