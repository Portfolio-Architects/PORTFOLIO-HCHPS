/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { BudgetCategory } from '@/types';
import { Modal } from '@/components/ui/modal';
import { Plus, X } from 'lucide-react';

interface BatchEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  categories: BudgetCategory[];
  onApply: (updates: Partial<BudgetCategory>, fundingSplits?: { source: string; ratio: string }[]) => void;
}

function BatchEditModalComponent({ isOpen, onClose, title, categories, onApply }: BatchEditModalProps) {
  const [batchBudgetType, setBatchBudgetType] = useState<'본예산' | '간주예산' | '추경' | ''>('');
  const [batchFundingSplits, setBatchFundingSplits] = useState<{source: string, ratio: string}[]>([{source: '', ratio: ''}]);

  const totalBudgetsSum = React.useMemo(() => {
    let sum = 0;
    for (let i = 0; i < categories.length; i++) {
      sum += (categories[i].totalBudget || 0);
    }
    return sum;
  }, [categories]);

  useEffect(() => {
    if (isOpen) {
      setBatchBudgetType('');
      setBatchFundingSplits([{source: '', ratio: ''}]);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm(`선택된 [${title}] 내 ${categories.length}개 과목을 일괄 수정하시겠습니까?`)) return;

    const hasBatchRatios = batchFundingSplits.some(s => s.ratio);
    const totalRatio = batchFundingSplits.reduce((sum, s) => sum + Number(s.ratio || 0), 0);
    
    if (hasBatchRatios && Math.abs(totalRatio - 100) > 0.01) {
      alert(`배분 비율의 합이 100%가 되어야 합니다. 현재: ${totalRatio}%`);
      return;
    }

    const updates: Partial<BudgetCategory> = {};
    if (batchBudgetType !== '') {
      updates.budgetType = batchBudgetType;
    }

    onApply(updates, hasBatchRatios ? batchFundingSplits : undefined);
  };

  const inputClass = "w-full border-gray-200 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`[${title}] 일괄 수정`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg text-sm mb-4">
          해당 그룹에 속한 <b>{categories.length}개</b>의 모든 하위 과목 예산/재원 구분을 일괄 변경합니다.<br/>
          (빈칸으로 둔 항목은 기존 값을 유지합니다.)
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700 block">예산 구분 변경 (선택)</label>
          <select value={batchBudgetType} onChange={e => setBatchBudgetType(e.target.value as "" | "본예산" | "간주예산" | "추경")} className={inputClass}>
            <option value="">변경 안함 (기존 유지)</option>
            <option value="본예산">본예산</option>
            <option value="간주예산">간주예산</option>
            <option value="추경">추경</option>
          </select>
        </div>

        <div className="space-y-2 pt-4 border-t border-gray-100">
          <label className="text-sm font-semibold text-gray-700 block">하위 항목 재원 일괄 재분배 (선택사항)</label>
          <div className="text-xl font-black text-blue-900 mt-1">{totalBudgetsSum.toLocaleString('ko-KR')} <span className="text-sm font-bold text-blue-700">원</span></div>
          <div className="text-[11px] text-blue-600 mt-1 text-left bg-blue-100/50 p-2 rounded">일괄 적용 기능은 총 예산액을 몰라도 쉽게 입력할 수 있도록 <b>퍼센트(%)</b>로 입력받습니다. 여기서 입력하신 비율이 하위 {categories.length}개 단위/통계목들의 각 예산액 규모에 비례해 정확한 금액으로 자동 하향 분배 지정됩니다. 변경을 원하지 않으면 비워두세요.</div>
          
          <div className="bg-gray-50 p-3 rounded-xl space-y-2 mt-2">
            <div className="flex gap-2 mb-2 px-1">
              <div className="flex-1 text-xs font-bold text-gray-500">재원명</div>
              <div className="w-24 text-xs font-bold text-gray-500 text-right">분배 비율 (%)</div>
              <div className="w-8"></div>
            </div>
            {batchFundingSplits.map((split, i) => (
              <div key={`batch-split-${split.source}-${i}`} className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="구비, 시비 등"
                  value={split.source}
                  onChange={e => {
                    const newSplits = [...batchFundingSplits];
                    newSplits[i].source = e.target.value;
                    setBatchFundingSplits(newSplits);
                  }}
                  className="flex-1 border-gray-200 border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400"
                />
                <input
                  type="number"
                  placeholder="%"
                  value={split.ratio}
                  onChange={e => {
                    const newSplits = [...batchFundingSplits];
                    newSplits[i].ratio = e.target.value;
                    setBatchFundingSplits(newSplits);
                  }}
                  className="w-24 border-gray-200 border rounded-lg px-3 py-1.5 text-sm text-right outline-none focus:border-blue-400 font-bold text-blue-700"
                />
                <div className="w-8 flex justify-center">
                  {i === batchFundingSplits.length - 1 ? (
                    <button type="button" onClick={() => setBatchFundingSplits([...batchFundingSplits, {source: '시비', ratio: ''}])} className="text-blue-500 p-1 hover:bg-blue-50 rounded"><Plus size={16}/></button>
                  ) : (
                    <button type="button" onClick={() => setBatchFundingSplits(batchFundingSplits.filter((_, idx) => idx !== i))} className="text-red-400 p-1 hover:bg-red-50 rounded"><X size={16}/></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-6">
          <button type="button" onClick={onClose} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm">취소</button>
          <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm shadow-blue-600/20 text-sm">일괄 적용하기</button>
        </div>
      </form>
    </Modal>
  );
}

BatchEditModalComponent.displayName = 'BatchEditModal';
export const BatchEditModal = React.memo(BatchEditModalComponent);
