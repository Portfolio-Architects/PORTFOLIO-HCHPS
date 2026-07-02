import React, { useState, useMemo, useCallback } from 'react';
import { BudgetCategory, BudgetEntry, BudgetActionType } from '@/types';
import { ChevronDown, ChevronUp, Pencil, Trash2, FileCheck, FilePlus2, ArrowUp, ArrowDown, RefreshCw, CheckCircle2 } from 'lucide-react';

function formatN(n: number) { return n.toLocaleString('ko-KR'); }

export const ACTION_TYPE_CONFIG: Record<BudgetActionType, { label: string; badge: string; badgeBg: string; icon: React.ElementType }> = {
  general: { label: '일반 지출', badge: '일반', badgeBg: 'bg-blue-100 text-blue-700', icon: FileCheck },
  issuance: { label: '일상경비 교부', badge: '교부', badgeBg: 'bg-amber-100 text-amber-700', icon: FilePlus2 },
  daily_expense: { label: '일상경비 지출', badge: '경비지출', badgeBg: 'bg-teal-100 text-teal-700', icon: FileCheck },
  transfer: { label: '이용/전용', badge: '이용/전용', badgeBg: 'bg-purple-100 text-purple-700', icon: RefreshCw },
  correction: { label: '정정', badge: '정정', badgeBg: 'bg-orange-100 text-orange-700', icon: Pencil },
  settle: { label: '정산(결산)', badge: '정산', badgeBg: 'bg-gray-100 text-gray-700', icon: CheckCircle2 }
};

import { CategoryStats } from '@/hooks/useBudget';

export const PolicyGroupCard = React.memo(({
  group,
  entries,
  getCategoryStats,
  deleteCategory,
  deleteEntry,
  openEditCat,
  openAddCat,
  openEditEntry,
  openBatchEdit,
  updateCategory,
  hidePolicyHeader = false
}: {
  group: { policyName: string; cats: BudgetCategory[] };
  entries: BudgetEntry[];
  getCategoryStats: (id: string) => CategoryStats | null;
  deleteCategory: (id: string) => void;
  deleteEntry: (id: string) => void;
  openEditCat: (cat: BudgetCategory) => void;
  openAddCat?: (template: Partial<BudgetCategory>) => void;
  openEditEntry: (entry: BudgetEntry) => void;
  openBatchEdit?: (title: string, cats: BudgetCategory[]) => void;
  updateCategory?: (id: string, updates: Partial<BudgetCategory>) => void;
  hidePolicyHeader?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAllEntries, setShowAllEntries] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const { policyName, cats } = group;

  // 편성목 순서 교환 (↑↓)
  const handleSwapCat = useCallback((sortedCats: BudgetCategory[], idx: number, dir: -1 | 1) => {
    if (!updateCategory) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= sortedCats.length) return;
    // 현재 배열의 인덱스를 sortOrder로 할당 (교환)
    sortedCats.forEach((c, i) => {
      let newOrder = i;
      if (i === idx) newOrder = targetIdx;
      else if (i === targetIdx) newOrder = idx;
      updateCategory(c.id, { sortOrder: newOrder });
    });
  }, [updateCategory]);

  const { totalBudget, spent, planned, remaining, usageRate, groupEntries, groupedByDetail, groupFunding, groupTypes } = useMemo(() => {
    const tBudget = cats.reduce((s, c) => s + c.totalBudget, 0);
    let tSpent = 0; let tPlanned = 0; let tRemaining = 0;
    
    cats.forEach(c => {
      const st = getCategoryStats(c.id);
      if (st) { tSpent += st.spent; tPlanned += st.planned; tRemaining += st.remaining; }
    });
    
    const rate = tBudget > 0 ? ((tSpent + tPlanned) / tBudget) * 100 : 0;
    
    const catIds = cats.map(c => c.id);
    const gEntries = entries
      .filter(e => catIds.includes(e.categoryId))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Group by detailedProject
    const groups: { detailName: string; cats: BudgetCategory[] }[] = [];
    cats.forEach(cat => {
      const detail = cat.detailedProject || '분류되지 않은 세부사업';
      let g = groups.find(g => g.detailName === detail);
      if (!g) {
        g = { detailName: detail, cats: [] };
        groups.push(g);
      }
      g.cats.push(cat);
    });
    // Sort cats within each group by sortOrder
    groups.forEach(g => {
      g.cats.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
    });

    const groupFundingSet = new Set<string>();
    cats.forEach(c => {
       if (c.fundingSource) {
          const clean = c.fundingSource.replace(/\([^)]+\)/g, '');
          clean.split(',').forEach(p => {
             const t = p.trim();
             if (t && t !== '구비' && t !== '구비') groupFundingSet.add(t);
          });
       }
    });
    const groupFunding = Array.from(groupFundingSet);
    const groupTypes = Array.from(new Set(cats.map(c => c.budgetType).filter(t => t && t !== '본예산')));

    return { totalBudget: tBudget, spent: tSpent, planned: tPlanned, remaining: tRemaining, usageRate: rate, groupEntries: gEntries, groupedByDetail: groups, groupFunding, groupTypes };
  }, [cats, entries, getCategoryStats]);

  return (
    <div className={`glass-panel rounded-[2rem] mb-5 last:mb-0 transition-all duration-300 shadow-2xs ${hidePolicyHeader ? '' : 'border border-slate-200/60 hover:border-indigo-400/50 hover:shadow-md hover:shadow-indigo-500/5'}`}>
      {!hidePolicyHeader && (
      <div 
        className="px-5 py-4 flex flex-col gap-3 cursor-pointer group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-slate-100 shadow-3xs" style={{ backgroundColor: cats[0]?.color ? `${cats[0].color}15` : '#f8fafc' }}>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cats[0]?.color || 'var(--color-primary)' }} />
            </div>
            <div>
               <h3 className="font-bold text-[18px] text-gray-800 tracking-tight group-hover:text-[var(--color-primary)] transition-colors flex items-center gap-1.5 flex-wrap">
                 {policyName}
                 {groupTypes.map(t => (
                   <span key={t} className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${t === '간주예산' ? 'bg-purple-50/80 text-purple-700 border-purple-200/60 shadow-3xs' : 'bg-rose-50/80 text-rose-700 border-rose-200/60 shadow-3xs'}`}>{t}</span>
                 ))}
                 {groupFunding.map(f => (
                   <span key={f} className="text-[11px] font-semibold px-2 py-0.5 rounded-lg border bg-teal-50/80 text-teal-700 border-teal-200/60 shadow-3xs">{f}</span>
                 ))}
               </h3>
               <div className="text-[12px] text-gray-500 font-semibold mt-0.5 tracking-tight">단위사업 {cats.length}개 그룹</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isOpen ? 'bg-indigo-50 text-indigo-500' : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100'}`}>
               {isOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
             </div>
          </div>
        </div>
        
        <div className="bg-slate-50/60 rounded-2xl p-4 flex flex-col gap-3 border border-slate-200/20">
          <div className="flex justify-between items-end">
            <div className="flex flex-col">
               <span className="text-slate-500 font-bold text-[14px] mb-1">총 예산 대비 사용액</span>
               <span className="font-extrabold text-slate-800 font-mono tracking-tight text-[21px]">{formatN(spent + planned)} <span className="text-[14px] text-slate-400 font-medium mx-1">/</span> <span className="text-slate-600 font-bold text-[18px]">{formatN(totalBudget)}</span></span>
            </div>
            <div className="flex flex-col items-end">
               <span className="text-slate-500 font-bold text-[14px] mb-1">총 잔여액</span>
               <span className="font-extrabold text-[var(--color-primary)] text-[25px] font-mono tracking-tight">{formatN(remaining)}<span className="text-[15px] font-bold ml-0.5">원</span></span>
            </div>
          </div>
          <div className="h-2 w-full bg-slate-200/40 rounded-full overflow-hidden border border-slate-100 relative">
             <div 
               className={`h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden ${
                 usageRate >= 95 
                   ? 'bg-gradient-to-r from-red-500 to-rose-600' 
                   : usageRate >= 80 
                     ? 'bg-gradient-to-r from-amber-400 to-amber-600' 
                     : 'bg-gradient-to-r from-blue-500 to-indigo-600'
               }`} 
               style={{ width: `${Math.min(100, usageRate)}%` }}
             >
               <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
             </div>
          </div>
          {planned > 0 && <div className="text-[11px] text-amber-700 font-bold bg-amber-50/80 px-2 py-1 rounded-lg inline-block self-start border border-amber-200/60 shadow-3xs">📋 품의 진행/예정: {formatN(planned)}원</div>}
        </div>
      </div>
      )}
      
        <div 
          className={`px-5 transition-all duration-500 ease-in-out overflow-hidden divide-y divide-gray-100 ${
            hidePolicyHeader 
              ? 'px-1 pt-1 border border-slate-200 rounded-xl bg-white shadow-sm py-3' 
              : (isOpen ? 'max-h-[25000px] opacity-100 py-3' : 'max-h-0 opacity-0 py-0 pointer-events-none')
          }`}
        >
          {groupedByDetail.map(detailGroup => {
            const detailTotalBudget = detailGroup.cats.reduce((sum, c) => sum + c.totalBudget, 0);
            const detailDailyIssued = detailGroup.cats.reduce((sum, c) => {
              const st = getCategoryStats(c.id);
              return sum + (st ? st.dailyExpenseIssued : 0);
            }, 0);
            const detailDailySpent = detailGroup.cats.reduce((sum, c) => {
              const st = getCategoryStats(c.id);
              return sum + (st ? st.dailyExpenseSpent : 0);
            }, 0);
            const detailDailyRemaining = detailGroup.cats.reduce((sum, c) => {
              const st = getCategoryStats(c.id);
              return sum + (st ? st.dailyExpenseRemaining : 0);
            }, 0);

            const detailFundingSet = new Set<string>();
            detailGroup.cats.forEach(c => {
               if (c.fundingSource) {
                  const clean = c.fundingSource.replace(/구비\(자체\)/g, '구비').replace(/\([^)]+\)/g, '');
                  clean.split(',').forEach(p => {
                     const t = p.trim();
                     if (t && t !== '구비' && t !== '구비') detailFundingSet.add(t);
                  });
               }
            });
            const detailFunding = Array.from(detailFundingSet);
            const detailTypes = Array.from(new Set(detailGroup.cats.map(c => c.budgetType).filter(t => t && t !== '본예산')));
            return (
            <div key={detailGroup.detailName} className="py-3 first:pt-0">
              <div className={`flex items-center gap-2 ${hidePolicyHeader ? 'mb-4 border-b border-slate-100 pb-4 px-3 pt-2' : 'mb-2.5'}`}>
                <div className={`${hidePolicyHeader ? 'w-8 h-8' : 'w-5 h-5'} rounded bg-[var(--color-primary)]/10 flex items-center justify-center`}>
                  <div className={`${hidePolicyHeader ? 'w-3.5 h-3.5' : 'w-2 h-2'} rounded-full bg-[var(--color-primary)]`} />
                </div>
                <div className={`flex items-center gap-2 font-semibold text-gray-800 flex-wrap ${hidePolicyHeader ? 'text-xl tracking-tight' : 'text-[17px]'}`}>
                  {detailGroup.detailName}
                  {policyName && (
                    <span className={`font-bold rounded-lg border bg-indigo-50/80 text-indigo-700 border-indigo-200/60 shadow-3xs ${hidePolicyHeader ? 'text-xs px-2 py-0.5' : 'text-[11px] px-1.5 py-0.5'}`}>
                      정책: {policyName}
                    </span>
                  )}
                  {detailGroup.cats[0]?.unitProject && (
                    <span className={`font-bold rounded-lg border bg-slate-50 text-slate-600 border-slate-200 shadow-3xs ${hidePolicyHeader ? 'text-xs px-2 py-0.5' : 'text-[11px] px-1.5 py-0.5'}`}>
                      단위: {detailGroup.cats[0].unitProject}
                    </span>
                  )}
                  {detailTypes.map(t => (
                    <span key={t} className={`font-semibold rounded-lg border shadow-3xs ${hidePolicyHeader ? 'text-xs px-2 py-0.5' : 'text-[11px] px-1.5 py-0.5'} ${t === '간주예산' ? 'bg-purple-50/80 text-purple-700 border-purple-200/60' : 'bg-rose-50/80 text-rose-700 border-rose-200/60'}`}>{t}</span>
                  ))}
                  {detailFunding.map(f => (
                    <span key={f} className={`font-semibold rounded-lg border bg-teal-50/80 text-teal-700 border-teal-200/60 shadow-3xs ${hidePolicyHeader ? 'text-xs px-2 py-0.5' : 'text-[11px] px-1.5 py-0.5'}`}>{f}</span>
                  ))}
                  <span className={`font-bold text-blue-700 bg-blue-50/80 rounded-lg border border-blue-100/60 mr-2 font-mono tabular-nums shadow-3xs ${hidePolicyHeader ? 'text-sm px-2.5 py-0.5' : 'text-[13px] px-2 py-0.5'}`}>{formatN(detailTotalBudget)}원</span>
                  {detailDailyIssued > 0 && (
                    <span className={`font-bold text-amber-700 bg-amber-50 border border-amber-200 mr-2 font-mono tabular-nums shadow-3xs flex items-center gap-1 ${hidePolicyHeader ? 'text-xs px-2.5 py-0.5' : 'text-[12px] px-2 py-0.5'}`}>
                      🪙 일상경비: 교부 {formatN(detailDailyIssued)}원 | 지출 {formatN(detailDailySpent)}원 (잔액 <strong className="text-amber-800">{formatN(detailDailyRemaining)}원</strong>)
                    </span>
                  )}
                  {openAddCat && (
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        openAddCat({ 
                          policyProject: policyName, 
                          unitProject: detailGroup.cats[0]?.unitProject, 
                          detailedProject: detailGroup.detailName,
                          budgetType: (detailTypes[0] as '본예산' | '추경') || '본예산',
                          fundingSource: detailFunding[0] || '구비'
                        }); 
                      }} 
                      className="p-1 rounded cursor-pointer hover:bg-slate-200 text-gray-500 hover:text-blue-600 transition-colors"
                      title="이 세부사업에 새 통계목 추가"
                    >
                      <FilePlus2 size={13} />
                    </button>
                  )}
                  {openBatchEdit && (
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        openBatchEdit(detailGroup.detailName, detailGroup.cats);
                      }} 
                      className="ml-1 text-[11px] font-semibold px-2 py-0.5 rounded border bg-indigo-50 text-indigo-700 border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors flex items-center gap-1 shadow-sm"
                      title="이 세부사업 내 모든 통계목에 동일한 재원비율 일괄 할당"
                    >
                      <Pencil size={11} /> 비율 모괄 설정
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-3 pl-2">
                {detailGroup.cats.map((cat, catIdx) => {
                  const stats = getCategoryStats(cat.id);
                  if (!stats) return null;
                  const isFirst = catIdx === 0;
                  const isLast = catIdx === detailGroup.cats.length - 1;
                  
                  const catEntries = groupEntries.filter(e => e.categoryId === cat.id);
                  const generalEntries = catEntries.filter(e => {
                    const isIssuedOrDaily = e.actionType === 'issuance' || e.actionType === 'daily_expense';
                    return !isIssuedOrDaily;
                  });
                  const issuanceEntries = catEntries.filter(e => e.actionType === 'issuance');
                  const dailyExpenseEntries = catEntries.filter(e => e.actionType === 'daily_expense');
                  const totalIssuance = issuanceEntries.reduce((acc, e) => acc + e.amount, 0);
                  const totalDailyExpense = dailyExpenseEntries.reduce((acc, e) => acc + e.amount, 0);
                  const dailyRemaining = totalIssuance - totalDailyExpense;
                  return (
                    <div key={cat.id} className="group/item relative bg-white border border-slate-200/80 rounded-2xl p-4 hover:bg-slate-50 hover:border-indigo-300/60 hover:shadow-3xs transition-all duration-200">
                      <div className={`flex items-center justify-between ${expandedCats[cat.id] ? 'mb-3' : 'mb-0'}`}>
                        <div className="text-[15px] font-bold flex items-center gap-2.5 text-gray-800 cursor-pointer hover:text-[var(--color-primary)] transition-colors select-none" onClick={() => { setExpandedCats(prev => ({ ...prev, [cat.id]: !prev[cat.id] })) }}>
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: cat.color || '#4A6CF7' }}/>
                          <div className="line-clamp-1 flex items-center gap-1.5">
                            {cat.formationItem && <span className="text-gray-500 font-medium opacity-90">[{cat.formationItem}]</span>}
                            <span>{cat.statItem || cat.name}</span>
                            {cat.managementProject && <span className="text-gray-600 font-bold">({cat.managementProject})</span>}
                            <div className={`text-gray-400 transition-transform ${expandedCats[cat.id] ? 'rotate-180' : ''}`}>
                               <ChevronDown size={14} />
                            </div>
                          </div>
                          {cat.budgetType && cat.budgetType !== '본예산' && (
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg ml-1 flex-shrink-0 border shadow-3xs ${cat.budgetType === '간주예산' ? 'bg-purple-50/80 text-purple-700 border-purple-200/60' : 'bg-rose-50/80 text-rose-700 border-rose-200/60'}`}>
                              {cat.budgetType}
                            </span>
                          )}
                          {cat.fundingSource && cat.fundingSource.replace(/구비\(자체\)/g, '구비') !== '구비' && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg ml-0.5 flex-shrink-0 border bg-teal-50/80 text-teal-700 border-teal-200/60 shadow-3xs">
                              {cat.fundingSource.replace(/구비\(자체\)/g, '구비')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity flex-shrink-0 absolute right-2 top-2 bg-white rounded-lg p-1 border border-slate-200 z-10 shadow-sm">
                          {updateCategory && !isFirst && (
                            <button onClick={(e) => { e.stopPropagation(); handleSwapCat(detailGroup.cats, catIdx, -1); }} className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600" title="위로 이동"><ArrowUp size={13} /></button>
                          )}
                          {updateCategory && !isLast && (
                            <button onClick={(e) => { e.stopPropagation(); handleSwapCat(detailGroup.cats, catIdx, 1); }} className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600" title="아래로 이동"><ArrowDown size={13} /></button>
                          )}
                          <button onClick={() => openEditCat(cat)} className="p-1 rounded hover:bg-slate-100 text-gray-500"><Pencil size={13} /></button>
                          <button onClick={() => deleteCategory(cat.id)} className="p-1 rounded hover:bg-red-50 text-gray-500 hover:text-red-500"><Trash2 size={13} /></button>
                        </div>
                      </div>
                      <div 
                        className={`transition-all duration-500 ease-in-out overflow-hidden ${
                          expandedCats[cat.id]
                            ? 'max-h-[8000px] opacity-100 mt-3 space-y-3'
                            : 'max-h-0 opacity-0 mt-0 pointer-events-none'
                        }`}
                      >
                        <div className="flex items-center justify-between bg-slate-50/70 rounded-xl p-3 mb-3 border border-slate-100">
                          <div className="flex flex-col">
                             <span className="text-gray-500 font-bold mb-1 text-[13px]">사용 (집행+품의)</span>
                             <span className="text-gray-800 font-semibold tracking-tight text-base font-mono tabular-nums">{formatN(stats.spent + stats.planned)} <span className="text-gray-400 font-medium mx-0.5">/</span> {formatN(stats.totalBudget)}</span>
                          </div>
                          <div className="flex flex-col items-end">
                             <span className="text-gray-500 font-bold mb-1 text-[13px]">잔여금액</span>
                             <span className="text-blue-600 font-bold tracking-tight text-[17px] font-mono tabular-nums">{formatN(stats.remaining)}원</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 px-1 mb-3">
                           <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden flex shadow-inner border border-slate-200/30 relative">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden ${(stats.usageRate || 0) >= 95 ? 'bg-gradient-to-r from-red-500 to-rose-500' : (stats.usageRate || 0) >= 80 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`} 
                                style={{ width: `${Math.min(100, stats.usageRate || 0)}%` }} 
                              >
                                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                              </div>
                           </div>
                           <span className="text-[12.5px] font-semibold text-slate-600 w-12 text-right tracking-tight font-mono tabular-nums">{(stats.usageRate || 0).toFixed(1)}%</span>
                        </div>
                           {cat.subItems && cat.subItems.length > 0 && (
                             <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-3xs">
                               <div className="text-[15px] font-bold text-slate-800 mb-2.5 flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-slate-400 rounded-full"/> 산출 기초 (세부 항목)</div>
                               <div className="space-y-2 pl-2">
                                 {cat.subItems.map((sub, subIdx) => {
                                    return (
                                    <div key={subIdx} className="flex flex-col gap-1.5 border-b border-gray-100 border-dashed pb-3 last:border-0 last:pb-0 transition-all">
                                      <div className="flex flex-col">
                                        <div className="flex justify-between items-start">
                                          <div className="flex items-center gap-1.5">
                                             {sub.prefix && <span className="text-[15px] bg-gray-100 border border-gray-200 text-gray-500 font-bold px-1.5 rounded">{sub.prefix}</span>}
                                             <span className="text-[18px] text-gray-800 font-semibold tracking-tight">{sub.name}</span>
                                          </div>
                                          <div className="flex flex-col items-end gap-0.5 shrink-0 ml-3">
                                            {sub.amount > 0 && <span className="font-semibold text-slate-800 tracking-tight text-[17px] font-mono tabular-nums">{formatN(sub.amount)}원</span>}
                                          </div>
                                        </div>
                                        
                                        {!sub.calculations || sub.calculations.length === 0 ? (
                                          sub.calculation && <div className="text-[13px] text-gray-500 font-mono tracking-tight mt-0.5 ml-1">{sub.calculation}</div>
                                        ) : (
                                          <div className="mt-2 mb-1 bg-slate-50/50 border-l-[3px] border-indigo-300 rounded-r-xl py-2 flex flex-col gap-1 ml-[5px] shadow-3xs text-[11px] text-slate-500">
                                            {sub.calculations.map((calc, cIdx) => {
                                              const targetAmount = calc.amount;
                                              return (
                                                <div key={cIdx} className="flex flex-col px-3 py-1 border-b border-slate-200/20 last:border-0 last:pb-0">
                                                  <div className="flex justify-between items-center">
                                                    <div className="flex gap-2 items-center flex-1 min-w-0">
                                                      {calc.name && <span className="font-semibold text-slate-700 truncate">{calc.name}</span>}
                                                      {calc.calculation && <span className="font-mono text-slate-400 truncate">({calc.calculation})</span>}
                                                    </div>
                                                    <span className="font-mono font-medium text-slate-600 shrink-0 ml-3">{formatN(targetAmount)}원</span>
                                                  </div>
                                                  {calc.isCustomFunding && calc.fundingSplits && calc.fundingSplits.length > 0 && (
                                                    <div className="inline-flex w-fit items-center gap-1 mt-1 bg-teal-50/75 backdrop-blur-sm p-1 rounded-md border border-teal-100/50 mr-1 whitespace-nowrap shadow-sm text-[10px]">
                                                      <span className="text-teal-600 font-bold bg-white px-1.5 py-0.5 rounded border border-teal-100 shadow-sm">개별재원</span>
                                                      {calc.fundingSplits.map((fs, fsIdx) => (
                                                        <span key={fsIdx} className="text-teal-800 font-bold flex items-center gap-1 border-r border-teal-200/40 last:border-0 pr-1.5 last:pr-0">
                                                          <span className="opacity-70 font-semibold">{fs.source.replace('구비(자체)', '구비')}</span>
                                                          <span className="font-semibold font-mono">{formatN(fs.amount)}</span>
                                                        </span>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>

                                      {sub.isCustomFunding && sub.fundingSplits && sub.fundingSplits.length > 0 && (
                                        <div className="inline-flex w-fit items-center gap-1 mt-1.5 bg-teal-50/75 backdrop-blur-sm p-1.5 rounded-md border border-teal-100/50 whitespace-nowrap shadow-sm">
                                          <span className="text-[11px] text-teal-600 font-bold bg-white px-2 py-0.5 rounded border border-teal-100 shadow-sm">개별재원</span>
                                          {sub.fundingSplits.map((fs, fsIdx) => (
                                            <span key={fsIdx} className="text-[12px] text-teal-800 font-bold flex items-center gap-1 border-r border-teal-200/40 last:border-0 pr-2 last:pr-0">
                                              <span className="opacity-70 font-semibold">{fs.source.replace('구비(자체)', '구비')}</span>
                                              <span className="font-semibold font-mono">{formatN(fs.amount)}</span>
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                 );
                                 })}
                               </div>
                             </div>
                           )}

                           
                            {generalEntries.length > 0 && (
                              <div className="bg-blue-50/40 border border-blue-200/80 rounded-2xl p-4 shadow-3xs mb-3">
                                 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2.5">
                                   <div className="text-[14px] font-bold text-blue-800 flex items-center gap-1.5">
                                      <div className="w-2 h-2 bg-blue-500 rounded-full"/> 일반 지출 (품의 및 집행) 현황
                                   </div>
                                   <div className="flex bg-white px-2.5 py-1 rounded-md border border-blue-100 shadow-sm text-[13px] gap-2 items-center flex-wrap font-mono">
                                      <span className="text-blue-700 font-bold">진행중 품의: {formatN(stats.planned)}</span>
                                      <span className="text-gray-300">|</span>
                                      <span className="text-indigo-600 font-bold">완료된 지출: {formatN(stats.generalSpent)}</span>
                                      <span className="text-gray-300">|</span>
                                      <span className="text-blue-900 font-semibold text-[14px]">일반 잔액: {formatN(stats.remaining)}</span>
                                   </div>
                                 </div>
                                 
                                 <div className="space-y-1">
                                    {generalEntries
                                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                      .map(e => (
                                       <div key={e.id} className="flex justify-between items-center text-[15.5px] hover:bg-white/60 p-1.5 rounded transition-colors cursor-pointer border border-transparent hover:border-blue-200" onClick={(evt) => { evt.stopPropagation(); openEditEntry(e); }}>
                                          <div className="flex gap-2 items-center truncate">
                                             <span className={`font-bold px-1.5 py-0.5 rounded text-[12px] ${e.isPlanned && !e.isSettled ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-blue-100 text-blue-800 border border-blue-200'}`}>
                                                {e.isPlanned && !e.isSettled ? '품의(원인행위)' : '실지출'}
                                             </span>

                                             <span className="text-blue-700/70 font-medium tracking-tight shrink-0 bg-white border border-blue-100 px-1 rounded-sm">{e.date.replace(/-/g, '.')}</span>
                                             <span className={`${e.purpose?.includes('(일상경비 교부)') ? 'text-red-500 font-extrabold' : 'text-blue-900 font-semibold'} truncate`}>
                                                {e.purpose}
                                             </span>
                                          </div>
                                          <span className="font-bold text-blue-900 tabular-nums shrink-0 font-mono">{formatN(e.amount)}원</span>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                            )}

                            {(totalIssuance > 0 || totalDailyExpense > 0) && (
                              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 shadow-sm mb-3">
                                 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2.5">
                                   <div className="text-[15px] font-bold text-emerald-800 flex items-center gap-1.5">
                                      <div className="w-2 h-2 bg-emerald-500 rounded-full"/> 일상경비 (교부액) 집행 현황
                                   </div>
                                   <div className="flex bg-white px-2.5 py-1 rounded-md border border-emerald-100 shadow-sm text-[13px] gap-2 items-center flex-wrap font-mono">
                                      <span className="text-emerald-700 font-bold">총 교부액: {formatN(totalIssuance)}</span>
                                      <span className="text-gray-300">|</span>
                                      <span className="text-rose-600 font-bold">집행액: {formatN(totalDailyExpense)}</span>
                                      <span className="text-gray-300">|</span>
                                      <span className="text-blue-700 font-semibold text-[14px]">교부잔액: {formatN(dailyRemaining)}</span>
                                   </div>
                                 </div>
                                 
                                 <div className="space-y-1">
                                    {[...issuanceEntries, ...dailyExpenseEntries]
                                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                      .map(e => (
                                       <div key={e.id} className="flex justify-between items-center text-[15.5px] hover:bg-white/60 p-1.5 rounded transition-colors cursor-pointer border border-transparent hover:border-emerald-200" onClick={(evt) => { evt.stopPropagation(); openEditEntry(e); }}>
                                          <div className="flex gap-2 items-center truncate">
                                             <span className={`font-bold px-1.5 py-0.5 rounded text-[12px] ${e.actionType === 'issuance' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                                {e.actionType === 'issuance' ? '교부' : '지출'}
                                             </span>
                                             <span className="text-emerald-700/70 font-medium tracking-tight shrink-0 bg-white border border-emerald-100 px-1 rounded-sm">{e.date.replace(/-/g, '.')}</span>
                                             <span className={`${e.purpose?.includes('(일상경비 교부)') ? 'text-red-500 font-extrabold' : 'text-emerald-900 font-semibold'} truncate`}>
                                                {e.purpose}
                                             </span>
                                          </div>
                                          <span className="font-bold text-emerald-900 tabular-nums shrink-0 font-mono">{formatN(e.amount)}원</span>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                            )}
{cat.fundingSplits && cat.fundingSplits.length > 0 && (
                             <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 shadow-inner">
                               <div className="text-[13px] font-bold text-slate-600 mb-2.5 flex items-center gap-1"><FileCheck size={12}/> 재원 분할 내역</div>
                               <div className="space-y-1.5 pl-1">
                                 {cat.fundingSplits.map((split, splitIdx) => {
                                    const splitRatio = cat.totalBudget > 0 ? (split.amount / cat.totalBudget) * 100 : 0;
                                    return (
                                     <div key={splitIdx} className="flex justify-between items-center text-[14px] border-b border-slate-200 border-dashed pb-1.5 last:border-0 last:pb-0">
                                       <div className="flex items-center gap-2">
                                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                          <span className="font-bold text-gray-700">{split.source.replace('구비(자체)', '구비')}</span>
                                          <span className="text-[12px] bg-white border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-mono">{splitRatio.toFixed(1)}%</span>
                                       </div>
                                       <span className="font-semibold text-gray-900 tracking-tight font-mono">{formatN(split.amount)}원</span>
                                     </div>
                                    );
                                 })}
                               </div>
                             </div>
                           )}
                        </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )})}
          
          {groupEntries.length > 0 && (
            <div className="pt-3 space-y-2 mt-2">
              <div className="flex items-center justify-between mb-2 ml-1">
                <div className="text-[15px] font-bold text-gray-500 uppercase tracking-wider">
                  지출 내역 {groupEntries.length > 6 ? `(총 ${groupEntries.length}건)` : ''}
                </div>
                {groupEntries.length > 6 && (
                  <button 
                    onClick={() => setShowAllEntries(prev => !prev)}
                    className="text-[13px] bg-blue-50 text-blue-600 px-2.5 py-1 rounded cursor-pointer hover:bg-blue-100 hover:text-blue-800 font-bold transition-colors"
                  >
                    {showAllEntries ? '간략히 보기' : '모두 보기'}
                  </button>
                )}
              </div>
              
              <div className={`space-y-2 ${showAllEntries ? 'max-h-[600px] overflow-y-auto pr-1 scrollbar-hide' : ''}`}>
                {(showAllEntries ? groupEntries : groupEntries.slice(0, 6)).map(entry => {
                  const cfg = ACTION_TYPE_CONFIG[entry.actionType || 'general'] || ACTION_TYPE_CONFIG['general'];
                  const parentCat = cats.find(c => c.id === entry.categoryId);
                  return (
                    <div key={entry.id} className="flex items-center text-[15px] group bg-white py-2.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors relative">
                      <div className="w-[70px] flex-shrink-0">
                        <span className={`px-2 py-1 rounded-md text-[13px] font-bold border whitespace-nowrap ${cfg.badge === '경비지출' ? 'bg-teal-50 text-teal-700 border-teal-200' : cfg.badge === '교부' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{cfg.badge}</span>
                      </div>
                      <div className="w-[180px] hidden sm:flex items-center flex-shrink-0 pr-3">
                        <span className="text-[13px] bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md whitespace-nowrap overflow-visible">
                          {parentCat?.unitProject || '알수없음'}
                        </span>
                      </div>
                      <div className="w-[90px] flex items-center flex-shrink-0 pr-3">
                        <span className="text-[13.5px] text-gray-500 font-medium tracking-tight whitespace-nowrap">
                          {entry.date.replace(/-/g, '.')}
                        </span>
                      </div>
                      <div className="w-[140px] hidden lg:flex items-center flex-shrink-0 pr-3">
                        {entry.docRegNum && (
                          <span className="text-[13px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md whitespace-nowrap">
                            {entry.docRegNum}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-[150px] pr-2">
                        <span className={`${entry.purpose?.includes('(일상경비 교부)') ? 'text-red-500 font-extrabold' : 'text-gray-800 font-semibold'} tracking-tight line-clamp-1 text-[15px]`} title={entry.purpose}>
                           {entry.purpose}
                        </span>
                      </div>
                      <div className="w-[130px] sm:w-[160px] flex items-center justify-end gap-3 flex-shrink-0">
                         <span className="font-semibold text-gray-800 tracking-tight tabular-nums whitespace-nowrap text-[15px]">{formatN(entry.amount)}원</span>
                         <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 absolute right-2 top-2 sm:relative sm:top-0 sm:right-0 bg-white sm:bg-transparent rounded p-1 sm:p-0 border border-slate-200 sm:border-none z-10 w-auto sm:w-[56px] justify-end flex-shrink-0">
                           <button onClick={() => openEditEntry(entry)} className="p-1 rounded hover:bg-slate-100 text-gray-500"><Pencil size={13} /></button>
                           <button onClick={() => { if(window.confirm('이 지출 내역을 정말 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.')) deleteEntry(entry.id) }} className="p-1 rounded hover:bg-red-50 text-gray-500 hover:text-red-500"><Trash2 size={13} /></button>
                         </div>
                       </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
    </div>
  );
});
PolicyGroupCard.displayName = "PolicyGroupCard";
