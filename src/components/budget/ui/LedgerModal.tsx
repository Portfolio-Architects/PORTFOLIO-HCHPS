'use client';

import React from 'react';
import { Modal } from '@/components/ui/modal';
import { BudgetCategory, BudgetEntry } from '@/types';
import { ChevronDown } from 'lucide-react';

interface LedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: BudgetCategory[];
  entries: BudgetEntry[];
  getCategoryStats: (id: string) => { 
    totalBudget: number; spent: number; planned: number; remaining: number; usageRate: number;
    generalSpent: number; dailyExpenseIssued: number; dailyExpenseSpent: number; dailyExpenseRemaining: number;
  } | null;
  onSettle?: (plannedEntryId: string, actualAmount: number) => void;
}

function formatN(n: number) { return n.toLocaleString('ko-KR'); }

export function LedgerModal({ isOpen, onClose, categories, entries, getCategoryStats, onSettle }: LedgerModalProps) {
  const [settlingId, setSettlingId] = React.useState<string | null>(null);
  const [settleAmount, setSettleAmount] = React.useState<string>('');

  const handleSettleSubmit = (id: string) => {
    if (onSettle && settleAmount) {
      onSettle(id, Number(settleAmount.replace(/,/g, '')));
      setSettlingId(null);
      setSettleAmount('');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="원장 교차 검증 (가지출/실지출 대조)" size="4xl">
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
              
              // 왼쪽 (가배정/계획) = isPlanned:true & isSettled:false (현재 진행중) + 교부액
              const plannedTasks = catEntries.filter(e => e.isPlanned && !e.isSettled).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              const issuances = catEntries.filter(e => !e.isPlanned && e.actionType === 'issuance').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              
              const leftItems = [...plannedTasks, ...issuances].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

              // 오른쪽 (실제 집행/정산완료) = 일상경비 교부는 왼쪽(가지출)에 있으므로 제외
              const rightItems = catEntries.filter(e => !e.isPlanned && e.actionType !== 'issuance').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

              return { cat, stats, leftItems, rightItems };
            })
            .filter(data => data.leftItems.length > 0 || data.rightItems.length > 0)
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
                      <div className="flex gap-4 text-[14px] font-semibold mt-1 flex-wrap">
                        <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100">계획(가배정): {formatN(data.stats?.planned || 0)}</span>
                        <span className="text-teal-600 bg-teal-50 px-2 py-1 rounded border border-teal-100">결제된 지출: {formatN(data.stats?.spent || 0)}</span>
                        <span className={`px-2 py-1 rounded border ${
                          (data.stats?.remaining || 0) < 0 
                            ? 'text-red-600 bg-red-50 border-red-100' 
                            : 'text-blue-700 bg-blue-50 border-blue-100'
                        }`}>
                          실사용가능 잔액: {formatN(data.stats?.remaining || 0)}
                        </span>
                      </div>
                    </div>
                    <ChevronDown size={24} className="text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0" />
                  </summary>
                  <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6 border-t border-gray-200 bg-white">
                    {/* Left: 품의 및 가배정 */}
                    <div>
                      <div className="text-[14px] font-bold text-amber-700 mb-3 border-b border-amber-200 pb-2 flex justify-between items-center">
                        <span>가지출 단계 (원인행위/일상경비 교부)</span>
                        <div className="flex items-center gap-2">
                          <span>합계: {formatN(data.leftItems.reduce((acc, e) => acc + e.amount, 0))}</span>
                          <span className="bg-amber-100 text-amber-800 px-2 rounded-md text-[13px]">{data.leftItems.length}건</span>
                        </div>
                      </div>
                      <ul className="space-y-2.5">
                        {data.leftItems.length === 0 && <li className="text-[13px] text-gray-400 text-center py-6 bg-gray-50 rounded border border-dashed border-gray-200 font-medium">내역 없음</li>}
                        {data.leftItems.map(e => (
                          <li key={e.id} className={`flex justify-between items-center text-[13px] p-3 rounded-lg border transition-all ${e.isPlanned ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex flex-col gap-1 truncate pr-2 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${e.isPlanned ? 'bg-amber-200 text-amber-800' : 'bg-blue-100 text-blue-700'}`}>
                                  {e.isPlanned ? '원인행위(품의)' : '일상경비 교부'}
                                </span>
                                <span className="text-gray-500 font-semibold">{e.date.replace(/-/g, '.')}</span>
                              </div>
                              <span className="font-bold text-gray-800 truncate" title={e.purpose}>{e.purpose}</span>
                            </div>
                            
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <span className="font-bold text-amber-700 text-[14px]">{formatN(e.amount)}</span>
                              {e.isPlanned && onSettle && (
                                settlingId === e.id ? (
                                  <div className="flex items-center gap-1">
                                    <input 
                                      type="text" 
                                      className="w-24 px-2 py-1 text-xs border rounded outline-none" 
                                      placeholder="실 지출액" 
                                      value={settleAmount} 
                                      onChange={(evt) => setSettleAmount(evt.target.value.replace(/[^0-9]/g, ''))}
                                      autoFocus
                                    />
                                    <button onClick={() => handleSettleSubmit(e.id)} className="px-2 py-1 bg-green-600 text-white text-[11px] font-bold rounded hover:bg-green-700">확인</button>
                                    <button onClick={() => setSettlingId(null)} className="px-2 py-1 bg-gray-200 text-gray-600 text-[11px] font-bold rounded hover:bg-gray-300">취소</button>
                                  </div>
                                ) : (
                                  <button onClick={() => { setSettlingId(e.id); setSettleAmount(e.amount.toString()); }} className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded transition-colors shadow-sm cursor-pointer inline-flex items-center gap-1">
                                    ✓ <span>결제 완료(정산) 버튼</span>
                                  </button>
                                )
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {/* Right: 진성 지출 */}
                    <div>
                      <div className="text-[14px] font-bold text-teal-700 mb-3 border-b border-teal-200 pb-2 flex justify-between items-center">
                        <span>실제 지출 (정산 완료)</span>
                        <div className="flex items-center gap-2">
                          <span>합계: {formatN(data.rightItems.reduce((acc, e) => acc + e.amount, 0))}</span>
                          <span className="bg-teal-100 text-teal-800 px-2 rounded-md text-[13px]">{data.rightItems.length}건</span>
                        </div>
                      </div>
                      
                      {data.rightItems.length === 0 && (
                        <div className="text-[13px] text-gray-400 text-center py-6 bg-gray-50 rounded border border-dashed border-gray-200 font-medium">내역 없음</div>
                      )}
                      
                      {data.rightItems.length > 0 && (
                        <ul className="space-y-2">
                          {data.rightItems.map(e => (
                            <li key={e.id} className="flex justify-between items-center text-[13px] bg-teal-50 hover:bg-teal-100 p-3 rounded-lg border border-teal-200 transition-colors shadow-sm">
                              <div className="flex flex-col gap-1 truncate pr-2 flex-1">
                                <div className="flex items-center gap-1.5">
                                  {e.relatedPlanId && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-green-100 text-green-700">품의 정산건</span>}
                                  {e.actionType === 'daily_expense' && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-teal-100 text-teal-700 border border-teal-200">일상경비 지출</span>}
                                  <span className="text-gray-500 font-semibold">{e.date.replace(/-/g, '.')}</span>
                                </div>
                                <span className="font-bold text-gray-800 truncate" title={e.purpose}>{e.purpose}</span>
                              </div>
                              <span className="font-bold text-teal-700 shrink-0 text-[14px]">{formatN(e.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </details>
              </div>
            ))}
        </div>
      </div>
    </Modal>
  );
}
