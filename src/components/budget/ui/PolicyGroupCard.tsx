import React, { useState, useMemo } from 'react';
import { BudgetCategory, BudgetEntry, BudgetActionType } from '@/types';
import { ChevronDown, ChevronUp, Pencil, Trash2, FileCheck, FilePlus2 } from 'lucide-react';

function formatN(n: number) { return n.toLocaleString('ko-KR'); }

export const ACTION_TYPE_CONFIG: Record<BudgetActionType, { label: string; badge: string; badgeBg: string; icon: any }> = {
  general: { label: '일반 지출', badge: '일반', badgeBg: 'bg-blue-100 text-blue-700', icon: FileCheck },
  issuance: { label: '일상경비 교부', badge: '교부', badgeBg: 'bg-amber-100 text-amber-700', icon: FilePlus2 },
  daily_expense: { label: '일상경비 지출', badge: '경비지출', badgeBg: 'bg-teal-100 text-teal-700', icon: FileCheck },
};

export const PolicyGroupCard = React.memo(({
  group,
  entries,
  getCategoryStats,
  deleteCategory,
  deleteEntry,
  openEditCat,
  openEditEntry
}: {
  group: { policyName: string; cats: BudgetCategory[] };
  entries: BudgetEntry[];
  getCategoryStats: (id: string) => { totalBudget: number; spent: number; planned: number; remaining: number; usageRate: number } | null;
  deleteCategory: (id: string) => void;
  deleteEntry: (id: string) => void;
  openEditCat: (cat: BudgetCategory) => void;
  openEditEntry: (entry: BudgetEntry) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAllEntries, setShowAllEntries] = useState(false);
  const { policyName, cats } = group;

  const { totalBudget, spent, planned, remaining, usageRate, groupEntries, groupedByDetail } = useMemo(() => {
    const tBudget = cats.reduce((s, c) => s + c.totalBudget, 0);
    let tSpent = 0; let tPlanned = 0; let tRemaining = 0;
    
    cats.forEach(c => {
      const st = getCategoryStats(c.id);
      if (st) { tSpent += st.spent; tPlanned += st.planned; tRemaining += st.remaining; }
    });
    
    const rate = tBudget > 0 ? Math.round((tSpent / tBudget) * 100) : 0;
    
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

    return { totalBudget: tBudget, spent: tSpent, planned: tPlanned, remaining: tRemaining, usageRate: rate, groupEntries: gEntries, groupedByDetail: groups };
  }, [cats, entries, getCategoryStats]);

  return (
    <div className="overflow-hidden bg-white border border-gray-200/70 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] mb-4 last:mb-0 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300">
      <div 
        className="px-5 py-4 flex flex-col gap-3 cursor-pointer group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border border-gray-100" style={{ backgroundColor: cats[0]?.color ? `${cats[0].color}15` : '#f3f4f6' }}>
              <div className="w-3.5 h-3.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]" style={{ backgroundColor: cats[0]?.color || 'var(--color-primary)' }} />
            </div>
            <div>
               <h3 className="font-extrabold text-[17px] text-gray-800 tracking-tight group-hover:text-[var(--color-primary)] transition-colors">{policyName}</h3>
               <div className="text-[12px] text-gray-500 font-medium mt-0.5 tracking-tight">단위사업 {cats.length}개 그룹</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isOpen ? 'bg-blue-50 text-blue-500' : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100'}`}>
               {isOpen ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
             </div>
          </div>
        </div>
        
        <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100 flex flex-col gap-2.5">
          <div className="flex justify-between text-[13px] items-end">
            <div className="flex flex-col">
               <span className="text-gray-500 font-semibold mb-0.5 text-[11px]">총 예산 대비 사용액</span>
               <span className="font-bold text-gray-800">{formatN(spent)} / {formatN(totalBudget)}</span>
            </div>
            <div className="flex flex-col items-end">
               <span className="text-gray-500 font-semibold mb-0.5 text-[11px]">총 잔여액</span>
               <span className="font-black text-[var(--color-primary)] text-[15px]">{formatN(remaining)}원</span>
            </div>
          </div>
          <div className="h-2 w-full bg-gray-200/80 rounded-full overflow-hidden shadow-inner">
             <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.min(100, usageRate)}%` }} />
          </div>
          {planned > 0 && <div className="text-[11px] text-amber-600 font-bold bg-white px-2 py-1 rounded-md inline-block self-start mt-0.5 border border-amber-200 shadow-sm">📋 품의 진행/예정: {formatN(planned)}원</div>}
        </div>
      </div>
      
      {isOpen && (
        <div className="px-5 py-3 divide-y divide-gray-100">
          {groupedByDetail.map(detailGroup => (
            <div key={detailGroup.detailName} className="py-3 first:pt-0">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-5 h-5 rounded bg-[var(--color-primary)]/10 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                </div>
                <div className="text-[14px] font-bold text-gray-800">{detailGroup.detailName}</div>
              </div>
              <div className="space-y-3 pl-2">
                {detailGroup.cats.map(cat => {
                  const stats = getCategoryStats(cat.id);
                  if (!stats) return null;
                  return (
                    <div key={cat.id} className="group/item relative bg-white border border-gray-100 rounded-xl p-3.5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-[14px] font-bold flex items-center gap-2.5 text-gray-800">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-[0_0_5px_rgba(0,0,0,0.15)]" style={{ backgroundColor: cat.color || '#4A6CF7' }}/>
                          <div className="line-clamp-1">{cat.statItem || cat.name}</div>
                          <span className="text-[11px] text-gray-400 font-normal truncate hidden sm:block max-w-[200px]">({cat.name})</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity flex-shrink-0 absolute right-2 top-2 bg-white/90 backdrop-blur rounded-lg p-1 shadow-sm border border-gray-100 z-10">
                          <button onClick={() => openEditCat(cat)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"><Pencil size={13} /></button>
                          <button onClick={() => deleteCategory(cat.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[12px] bg-gray-50 rounded-lg p-2.5 mb-2.5">
                        <div className="flex flex-col">
                           <span className="text-gray-500 font-medium mb-0.5">사용 (집행+품의)</span>
                           <span className="text-gray-800 font-bold tracking-tight">{formatN(stats.spent)} / {formatN(stats.totalBudget)}</span>
                        </div>
                        <div className="flex flex-col items-end">
                           <span className="text-gray-500 font-medium mb-0.5">잔여금액</span>
                           <span className="text-blue-600 font-black tracking-tight">{formatN(stats.remaining)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                         <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden shadow-inner flex">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, stats.usageRate || 0)}%`, backgroundColor: cat.color || '#4A6CF7' }} />
                         </div>
                         <span className="text-[11px] font-bold text-gray-500 w-9 text-right tracking-tighter">{(stats.usageRate || 0).toFixed(1)}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          
          {groupEntries.length > 0 && (
            <div className="pt-3 space-y-2 mt-2">
              <div className="flex items-center justify-between mb-2 ml-1">
                <div className="text-[13px] font-bold text-gray-500 uppercase tracking-wider">
                  지출 내역 {groupEntries.length > 6 ? `(총 ${groupEntries.length}건)` : ''}
                </div>
                {groupEntries.length > 6 && (
                  <button 
                    onClick={() => setShowAllEntries(prev => !prev)}
                    className="text-[11px] bg-blue-50 text-blue-600 px-2.5 py-1 rounded cursor-pointer hover:bg-blue-100 hover:text-blue-800 font-bold transition-colors"
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
                    <div key={entry.id} className="flex items-center text-sm group bg-white p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all duration-200 relative">
                      <div className="w-[70px] flex-shrink-0">
                        <span className={`px-2 py-1 rounded-md text-[11px] font-bold border whitespace-nowrap ${cfg.badge === '경비지출' ? 'bg-teal-50 text-teal-700 border-teal-200' : cfg.badge === '교부' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{cfg.badge}</span>
                      </div>
                      <div className="w-[180px] hidden sm:flex items-center flex-shrink-0 pr-3">
                        <span className="text-[11px] bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md whitespace-nowrap overflow-visible">
                          {parentCat?.unitProject || '알수없음'}
                        </span>
                      </div>
                      <div className="w-[140px] hidden lg:flex items-center flex-shrink-0 pr-3">
                        {entry.docRegNum && (
                          <span className="text-[11px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md whitespace-nowrap">
                            {entry.docRegNum}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-[150px] pr-2">
                        <span className="text-gray-800 font-bold tracking-tight line-clamp-1" title={entry.purpose}>{entry.purpose}</span>
                      </div>
                      <div className="w-[130px] sm:w-[160px] flex items-center justify-end gap-3 flex-shrink-0">
                         <span className="font-extrabold text-gray-800 tracking-tight tabular-nums whitespace-nowrap">{formatN(entry.amount)}원</span>
                         <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity absolute right-2 top-2 sm:relative sm:top-0 sm:right-0 bg-white/90 backdrop-blur sm:bg-transparent rounded-lg p-1 sm:p-0 shadow-sm sm:shadow-none border border-gray-100 sm:border-none z-10 w-auto sm:w-[56px] justify-end flex-shrink-0">
                           <button onClick={() => openEditEntry(entry)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"><Pencil size={14} /></button>
                           <button onClick={() => { if(window.confirm('이 지출 내역을 정말 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.')) deleteEntry(entry.id) }} className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
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
