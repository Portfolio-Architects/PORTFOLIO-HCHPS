import React, { useState, useMemo, useCallback } from 'react';
import { BudgetCategory, BudgetEntry, BudgetActionType } from '@/types';
import { ChevronDown, ChevronUp, Pencil, Trash2, FileCheck, FilePlus2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { CategoryStats } from '@/hooks/useBudget';
import { BudgetCategoryCardItem } from './BudgetCategoryCardItem';

function formatN(n: number) { return n.toLocaleString('ko-KR'); }

export const ACTION_TYPE_CONFIG: Record<BudgetActionType, { label: string; badge: string; badgeBg: string; icon: React.ElementType }> = {
  general: { label: '일반 지출', badge: '일반', badgeBg: 'bg-blue-100 text-blue-700', icon: FileCheck },
  issuance: { label: '일상경비 교부', badge: '교부', badgeBg: 'bg-amber-100 text-amber-700', icon: FilePlus2 },
  daily_expense: { label: '일상경비 지출', badge: '경비지출', badgeBg: 'bg-teal-100 text-teal-700', icon: FileCheck },
  transfer: { label: '이용/전용', badge: '이용/전용', badgeBg: 'bg-purple-100 text-purple-700', icon: RefreshCw },
  correction: { label: '정정', badge: '정정', badgeBg: 'bg-orange-100 text-orange-700', icon: Pencil },
  settle: { label: '정산(결산)', badge: '정산', badgeBg: 'bg-gray-100 text-gray-700', icon: CheckCircle2 }
};

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
  const { policyName, cats } = group;

  // 편성목 순서 교환 (↑↓)
  const handleSwapCat = useCallback((sortedCats: BudgetCategory[], idx: number, dir: -1 | 1) => {
    if (!updateCategory) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= sortedCats.length) return;
    const currentCat = sortedCats[idx];
    const targetCat = sortedCats[targetIdx];
    if (currentCat && targetCat) {
      updateCategory(currentCat.id, { sortOrder: targetIdx });
      updateCategory(targetCat.id, { sortOrder: idx });
    }
  }, [updateCategory]);

  const { totalBudget, spent, planned, remaining, usageRate, groupEntries, entriesByCatId, groupedByDetail, groupFunding, groupTypes, catMap } = useMemo(() => {
    const tBudget = cats.reduce((s, c) => s + c.totalBudget, 0);
    let tSpent = 0; let tPlanned = 0; let tRemaining = 0;
    
    cats.forEach(c => {
      const st = getCategoryStats(c.id);
      if (st) { tSpent += st.spent; tPlanned += st.planned; tRemaining += st.remaining; }
    });
    
    const rate = tBudget > 0 ? ((tSpent + tPlanned) / tBudget) * 100 : 0;
    
    const catIdSet = new Set(cats.map(c => c.id));
    const gEntries = entries
      .filter(e => catIdSet.has(e.categoryId))
      .map(e => ({ entry: e, ts: Date.parse(e.date) || 0 }))
      .sort((a, b) => b.ts - a.ts)
      .map(item => item.entry);

    // Group entries by categoryId in O(E) time to eliminate O(C * E) complexity in render
    const entriesByCatMap: Record<string, BudgetEntry[]> = {};
    cats.forEach(c => {
      entriesByCatMap[c.id] = [];
    });
    gEntries.forEach(e => {
      if (entriesByCatMap[e.categoryId]) {
        entriesByCatMap[e.categoryId].push(e);
      }
    });

    // Build category ID lookup map in O(C)
    const categoryLookupMap: Record<string, BudgetCategory> = {};
    cats.forEach(c => {
      categoryLookupMap[c.id] = c;
    });

    // Group by detailedProject in O(C)
    const groupsMap: Record<string, BudgetCategory[]> = {};
    cats.forEach(cat => {
      const detail = cat.detailedProject || '분류되지 않은 세부사업';
      if (!groupsMap[detail]) {
        groupsMap[detail] = [];
      }
      groupsMap[detail].push(cat);
    });
    
    const groups = Object.keys(groupsMap).map(detail => ({
      detailName: detail,
      cats: groupsMap[detail]
    }));
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

    return { 
      totalBudget: tBudget, 
      spent: tSpent, 
      planned: tPlanned, 
      remaining: tRemaining, 
      usageRate: rate, 
      groupEntries: gEntries, 
      entriesByCatId: entriesByCatMap, 
      groupedByDetail: groups, 
      groupFunding, 
      groupTypes, 
      catMap: categoryLookupMap 
    };
  }, [cats, entries, getCategoryStats]);

  const visibleGroupEntries = useMemo(() => {
    return showAllEntries ? groupEntries : groupEntries.slice(0, 6);
  }, [groupEntries, showAllEntries]);

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
      
      {(hidePolicyHeader || isOpen) && (
        <div className={`px-5 py-3 transition-all duration-300 ease-in-out divide-y divide-gray-100 ${hidePolicyHeader ? 'px-1 pt-1 border border-slate-200 rounded-xl bg-white shadow-sm' : ''}`}>
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
                    const isFirst = catIdx === 0;
                    const isLast = catIdx === detailGroup.cats.length - 1;
                    const catEntries = entriesByCatId[cat.id] || [];

                    return (
                      <BudgetCategoryCardItem
                        key={cat.id}
                        cat={cat}
                        stats={stats}
                        catEntries={catEntries}
                        isFirst={isFirst}
                        isLast={isLast}
                        onSwapCat={updateCategory ? (dir) => handleSwapCat(detailGroup.cats, catIdx, dir) : undefined}
                        onEditCat={openEditCat}
                        onDeleteCat={deleteCategory}
                        onEditEntry={openEditEntry}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
          
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
                {visibleGroupEntries.map(entry => {
                  const cfg = ACTION_TYPE_CONFIG[entry.actionType || 'general'] || ACTION_TYPE_CONFIG['general'];
                  const parentCat = catMap[entry.categoryId];
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
                           <button onClick={() => openEditEntry(entry)} className="p-1 rounded hover:bg-slate-100 text-gray-500" title="수정"><Pencil size={13} /></button>
                           <button onClick={() => { if(window.confirm('이 지출 내역을 정말 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.')) deleteEntry(entry.id) }} className="p-1 rounded hover:bg-red-50 text-gray-500 hover:text-red-500" title="삭제"><Trash2 size={13} /></button>
                         </div>
                       </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

PolicyGroupCard.displayName = "PolicyGroupCard";
