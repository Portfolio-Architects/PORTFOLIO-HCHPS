'use client';

import React from 'react';
import { Modal } from '@/components/ui/modal';
import { BudgetCategory } from '@/types';
import { BarChart3, Info } from 'lucide-react';

interface DailyExpenseStatModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: BudgetCategory[];
  getCategoryStats: (id: string) => {
    totalBudget: number; spent: number; planned: number; remaining: number; usageRate: number;
    generalSpent: number; dailyExpenseIssued: number; dailyExpenseSpent: number; dailyExpenseRemaining: number;
  } | null;
}

function formatN(n: number) { return n.toLocaleString('ko-KR'); }

export function DailyExpenseStatModal({ isOpen, onClose, categories, getCategoryStats }: DailyExpenseStatModalProps) {
  const statSummary = React.useMemo(() => {
    const statsMap: Record<string, { detailedProject: string; statItem: string; issued: number; spent: number; remaining: number }> = {};
    
    categories.forEach(cat => {
      const catStats = getCategoryStats(cat.id);
      if (catStats) {
        const detailedProject = cat.detailedProject || '미지정 세부사업';
        const stat = cat.statItem || '기타 (미지정)';
        const key = `${detailedProject}::${stat}`;
        
        if (!statsMap[key]) {
          statsMap[key] = { detailedProject, statItem: stat, issued: 0, spent: 0, remaining: 0 };
        }
        statsMap[key].issued += catStats.dailyExpenseIssued;
        statsMap[key].spent += catStats.dailyExpenseSpent;
        statsMap[key].remaining += catStats.dailyExpenseRemaining;
      }
    });
    
    // 이체내역(교부액 또는 지출액)이 존재하는 세부사업별 통계목만 필터링
    return Object.values(statsMap)
      .filter(item => item.issued > 0 || item.spent > 0)
      .sort((a, b) => {
        // 1. 세부사업명 사전순 정렬
        if (a.detailedProject !== b.detailedProject) {
          return a.detailedProject.localeCompare(b.detailedProject);
        }
        // 2. 교부액 내림차순 정렬
        return b.issued - a.issued;
      });
  }, [categories, getCategoryStats]);

  // 합계 계산
  const totals = React.useMemo(() => {
    return statSummary.reduce(
      (acc, curr) => {
        acc.issued += curr.issued;
        acc.spent += curr.spent;
        acc.remaining += curr.remaining;
        return acc;
      },
      { issued: 0, spent: 0, remaining: 0 }
    );
  }, [statSummary]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="세부사업 및 통계목별 일상경비 이체내역" size="2xl">
      <div className="space-y-5">
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-3">
          <Info className="text-amber-600 mt-0.5 shrink-0" size={18} />
          <div className="text-[14px] text-amber-800 leading-relaxed font-medium">
            각 세부사업 하위의 통계목별로 교부된 일상경비와 실제 지출액, 가용 잔액 현황입니다.
          </div>
        </div>

        {statSummary.length === 0 ? (
          <div className="text-center py-10 text-gray-500 font-medium">
            교부되거나 지출된 일상경비 내역이 없습니다.
          </div>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[14px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[13px] font-bold text-gray-600">
                    <th className="py-3.5 px-4">세부사업명</th>
                    <th className="py-3.5 px-4">통계목</th>
                    <th className="py-3.5 px-4 text-right">교부액 (원금)</th>
                    <th className="py-3.5 px-4 text-right">실지출액</th>
                    <th className="py-3.5 px-4 text-right">가용 잔액</th>
                    <th className="py-3.5 px-4 text-center">집행률</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {statSummary.map((item, idx) => {
                    const pct = item.issued > 0 ? (item.spent / item.issued) * 100 : 0;
                    return (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3.5 px-4 text-gray-600 font-semibold">{item.detailedProject}</td>
                        <td className="py-3.5 px-4 font-bold text-gray-800">{item.statItem}</td>
                        <td className="py-3.5 px-4 text-right text-gray-700 font-medium">{formatN(item.issued)}원</td>
                        <td className="py-3.5 px-4 text-right text-gray-700 font-medium">{formatN(item.spent)}원</td>
                        <td className="py-3.5 px-4 text-right font-bold text-amber-600 bg-amber-50/20">{formatN(item.remaining)}원</td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
                              <div
                                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-[12px] font-extrabold text-gray-600 w-9 text-right">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {/* 합계 행 */}
                  <tr className="bg-amber-50/40 border-t-2 border-amber-100 font-bold">
                    <td colSpan={2} className="py-4 px-4 text-amber-900 font-black">
                      <div className="flex items-center gap-1.5">
                        <BarChart3 size={16} className="text-amber-700" /> 합계
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right text-amber-950 font-extrabold">{formatN(totals.issued)}원</td>
                    <td className="py-4 px-4 text-right text-amber-950 font-extrabold">{formatN(totals.spent)}원</td>
                    <td className="py-4 px-4 text-right text-amber-700 font-black bg-amber-50/60">{formatN(totals.remaining)}원</td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2 overflow-hidden border border-amber-200">
                          <div
                            className="bg-amber-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(totals.issued > 0 ? (totals.spent / totals.issued) * 100 : 0, 100)}%` }}
                          />
                        </div>
                        <span className="text-[13px] font-black text-amber-800 w-9 text-right">
                          {(totals.issued > 0 ? (totals.spent / totals.issued) * 100 : 0).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition-colors text-[14px] cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </Modal>
  );
}
