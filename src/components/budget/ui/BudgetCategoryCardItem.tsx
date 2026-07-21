'use client';

import React, { useState, useMemo } from 'react';
import { BudgetCategory, BudgetEntry } from '@/types';
import { CategoryStats } from '@/hooks/useBudget';
import { ChevronDown, Pencil, Trash2, ArrowUp, ArrowDown, FileCheck } from 'lucide-react';

function formatN(n: number) { return n.toLocaleString('ko-KR'); }

export interface BudgetCategoryCardItemProps {
  cat: BudgetCategory;
  stats: CategoryStats | null;
  catEntries: BudgetEntry[];
  isFirst: boolean;
  isLast: boolean;
  onSwapCat?: (dir: -1 | 1) => void;
  onEditCat: (cat: BudgetCategory) => void;
  onDeleteCat: (id: string) => void;
  onEditEntry: (entry: BudgetEntry) => void;
}

export const BudgetCategoryCardItem = React.memo<BudgetCategoryCardItemProps>(({
  cat,
  stats,
  catEntries,
  isFirst,
  isLast,
  onSwapCat,
  onEditCat,
  onDeleteCat,
  onEditEntry
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const { generalEntries, dailyExpenseEntries, totalIssuance, totalDailyExpense, dailyRemaining } = useMemo(() => {
    const gen = catEntries
      .filter(e => e.actionType !== 'issuance' && e.actionType !== 'daily_expense')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const issuances = catEntries.filter(e => e.actionType === 'issuance');
    const dailyExpenses = catEntries.filter(e => e.actionType === 'daily_expense');

    const combinedDaily = [...issuances, ...dailyExpenses].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const totIssuance = issuances.reduce((acc, e) => acc + e.amount, 0);
    const totDailyExp = dailyExpenses.reduce((acc, e) => acc + e.amount, 0);
    const dailyRem = totIssuance - totDailyExp;

    return {
      generalEntries: gen,
      dailyExpenseEntries: combinedDaily,
      totalIssuance: totIssuance,
      totalDailyExpense: totDailyExp,
      dailyRemaining: dailyRem
    };
  }, [catEntries]);

  if (!stats) return null;

  return (
    <div className="group/item relative bg-white border border-slate-200/80 rounded-2xl p-4 hover:bg-slate-50 hover:border-indigo-300/60 hover:shadow-3xs transition-all duration-200">
      <div className={`flex items-center justify-between ${isExpanded ? 'mb-3' : 'mb-0'}`}>
        <div 
          className="text-[15px] font-bold flex items-center gap-2.5 text-gray-800 cursor-pointer hover:text-[var(--color-primary)] transition-colors select-none" 
          onClick={() => setIsExpanded(prev => !prev)}
        >
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: cat.color || '#4A6CF7' }} />
          <div className="line-clamp-1 flex items-center gap-1.5">
            {cat.formationItem && <span className="text-gray-500 font-medium opacity-90">[{cat.formationItem}]</span>}
            <span>{cat.statItem || cat.name}</span>
            {cat.managementProject && <span className="text-gray-600 font-bold">({cat.managementProject})</span>}
            <div className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
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
          {onSwapCat && !isFirst && (
            <button onClick={(e) => { e.stopPropagation(); onSwapCat(-1); }} className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600" title="위로 이동"><ArrowUp size={13} /></button>
          )}
          {onSwapCat && !isLast && (
            <button onClick={(e) => { e.stopPropagation(); onSwapCat(1); }} className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600" title="아래로 이동"><ArrowDown size={13} /></button>
          )}
          <button onClick={() => onEditCat(cat)} className="p-1 rounded hover:bg-slate-100 text-gray-500" title="수정"><Pencil size={13} /></button>
          <button onClick={() => onDeleteCat(cat.id)} className="p-1 rounded hover:bg-red-50 text-gray-500 hover:text-red-500" title="삭제"><Trash2 size={13} /></button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-3 pt-3 border-t border-slate-100">
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
                {cat.subItems.map((sub, subIdx) => (
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
                          {sub.calculations.map((calc, cIdx) => (
                            <div key={cIdx} className="flex flex-col px-3 py-1 border-b border-slate-200/20 last:border-0 last:pb-0">
                              <div className="flex justify-between items-center">
                                <div className="flex gap-2 items-center flex-1 min-w-0">
                                  {calc.name && <span className="font-semibold text-slate-700 truncate">{calc.name}</span>}
                                  {calc.calculation && <span className="font-mono text-slate-400 truncate">({calc.calculation})</span>}
                                </div>
                                <span className="font-mono font-medium text-slate-600 shrink-0 ml-3">{formatN(calc.amount)}원</span>
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
                          ))}
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
                ))}
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
                {generalEntries.map(e => (
                  <div key={e.id} className="flex justify-between items-center text-[15.5px] hover:bg-white/60 p-1.5 rounded transition-colors cursor-pointer border border-transparent hover:border-blue-200" onClick={(evt) => { evt.stopPropagation(); onEditEntry(e); }}>
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
                {dailyExpenseEntries.map(e => (
                  <div key={e.id} className="flex justify-between items-center text-[15.5px] hover:bg-white/60 p-1.5 rounded transition-colors cursor-pointer border border-transparent hover:border-emerald-200" onClick={(evt) => { evt.stopPropagation(); onEditEntry(e); }}>
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
      )}
    </div>
  );
});

BudgetCategoryCardItem.displayName = 'BudgetCategoryCardItem';
