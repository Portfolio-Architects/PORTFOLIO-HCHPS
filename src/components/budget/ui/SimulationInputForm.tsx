'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Calculator, Sparkles, RotateCcw, Plus, Check, X, AlertCircle } from 'lucide-react';
import { SimulationEntry } from '@/types';

export interface SimulationInputFormProps {
  detailedProjects: string[];
  getStatItemsForProject: (dp: string) => string[];
  editingEntry?: SimulationEntry | null;
  onAddEntry: (entry: Omit<SimulationEntry, 'id' | 'createdAt' | 'amount'> & { amount?: number }) => void;
  onUpdateEntry: (id: string, partial: Partial<SimulationEntry>) => void;
  onCancelEdit?: () => void;
  onResetAll?: () => void;
  onLoadTestPreset?: () => void;
}

export const SimulationInputForm: React.FC<SimulationInputFormProps> = React.memo(({
  detailedProjects,
  getStatItemsForProject,
  editingEntry,
  onAddEntry,
  onUpdateEntry,
  onCancelEdit,
  onResetAll,
  onLoadTestPreset,
}) => {
  // Internal Form State
  const [name, setName] = useState('');
  const [detailedProject, setDetailedProject] = useState('');
  const [statItem, setStatItem] = useState('');
  const [unitPriceStr, setUnitPriceStr] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [memo, setMemo] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync form state during render when editingEntry changes
  const [prevEditingEntry, setPrevEditingEntry] = useState<SimulationEntry | null | undefined>(editingEntry);
  if (editingEntry !== prevEditingEntry) {
    setPrevEditingEntry(editingEntry);
    if (editingEntry) {
      setName(editingEntry.name || '');
      setDetailedProject(editingEntry.detailedProject || '');
      setStatItem(editingEntry.statItem || '');
      setUnitPriceStr(editingEntry.unitPrice ? editingEntry.unitPrice.toLocaleString('ko-KR') : '0');
      setQuantity(editingEntry.quantity || 1);
      setMemo(editingEntry.memo || '');
      setValidationError(null);
    } else {
      setName('');
      setDetailedProject('');
      setStatItem('');
      setUnitPriceStr('');
      setQuantity(1);
      setMemo('');
      setValidationError(null);
    }
  }

  // Derived numeric unit price
  const unitPrice = useMemo(() => {
    const raw = unitPriceStr.replace(/,/g, '');
    const num = parseInt(raw, 10);
    return isNaN(num) ? 0 : num;
  }, [unitPriceStr]);

  // Auto-calculated Amount
  const calculatedAmount = useMemo(() => {
    return Math.max(0, unitPrice) * Math.max(1, quantity);
  }, [unitPrice, quantity]);

  // Cascading Stat Item Options
  const statItemOptions = useMemo(() => {
    if (!detailedProject) return [];
    return getStatItemsForProject(detailedProject);
  }, [detailedProject, getStatItemsForProject]);

  // Handle detailedProject change
  const handleDetailedProjectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDp = e.target.value;
    setDetailedProject(newDp);
    const validStatItems = getStatItemsForProject(newDp);
    if (statItem && !validStatItems.includes(statItem)) {
      setStatItem(validStatItems[0] || '');
    }
  }, [statItem, getStatItemsForProject]);

  // Format unit price input with thousand separators
  const handleUnitPriceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, '');
    if (!rawVal) {
      setUnitPriceStr('');
      return;
    }
    const num = parseInt(rawVal, 10);
    setUnitPriceStr(num.toLocaleString('ko-KR'));
  }, []);

  // Form Submit Handler
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim()) {
      setValidationError('지출 예정 항목명을 입력해 주세요.');
      return;
    }
    if (!detailedProject) {
      setValidationError('세부사업을 선택해 주세요.');
      return;
    }
    if (!statItem) {
      setValidationError('통계목을 선택해 주세요.');
      return;
    }
    if (unitPrice <= 0) {
      setValidationError('단가는 0원보다 커야 합니다.');
      return;
    }

    if (editingEntry) {
      onUpdateEntry(editingEntry.id, {
        name: name.trim(),
        detailedProject,
        statItem,
        unitPrice,
        quantity,
        amount: calculatedAmount,
        memo: memo.trim(),
      });
      if (onCancelEdit) onCancelEdit();
    } else {
      onAddEntry({
        name: name.trim(),
        detailedProject,
        statItem,
        unitPrice,
        quantity,
        amount: calculatedAmount,
        memo: memo.trim(),
      });
      // Reset input fields
      setName('');
      setUnitPriceStr('');
      setQuantity(1);
    }
  }, [name, detailedProject, statItem, unitPrice, quantity, calculatedAmount, memo, editingEntry, onAddEntry, onUpdateEntry, onCancelEdit]);

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 md:p-6 shadow-xs space-y-5 text-slate-800">
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              {editingEntry ? '지출 예정 항목 수정' : '확정 지출 예정 내역 입력'}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              시뮬레이션에 반영할 미집행 확정 지출 항목(단가, 수량, 세부사업)을 등록합니다.
            </p>
          </div>
        </div>

        {/* Global Preset & Reset Actions */}
        <div className="flex items-center gap-2">
          {onLoadTestPreset && (
            <button
              type="button"
              onClick={onLoadTestPreset}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
              title="8개의 표준 보건소 및 AI 메디헬스 테스트 지출 항목을 로드합니다."
            >
              <Sparkles className="w-3.5 h-3.5" />
              테스트 프리셋 로드
            </button>
          )}
          {onResetAll && (
            <button
              type="button"
              onClick={onResetAll}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
              title="모든 시뮬레이션 지출 예정 항목을 초기화합니다."
            >
              <RotateCcw className="w-3.5 h-3.5" />
              전체 초기화
            </button>
          )}
        </div>
      </div>

      {/* Validation Error Banner */}
      {validationError && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold animate-pulse">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Input Form Grid */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
          {/* 1. Item Name */}
          <div className="lg:col-span-4 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <span>지출 예정 항목명</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="예: AI 헬스체크업 키오스크 구매"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/80 transition-all font-medium"
            />
          </div>

          {/* 2. Detailed Project Dropdown */}
          <div className="lg:col-span-4 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <span>세부사업 선택</span>
              <span className="text-rose-500">*</span>
            </label>
            <select
              value={detailedProject}
              onChange={handleDetailedProjectChange}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/80 transition-all font-medium"
            >
              <option value="">-- 세부사업 선택 --</option>
              {detailedProjects.map((dp) => (
                <option key={dp} value={dp}>{dp}</option>
              ))}
            </select>
          </div>

          {/* 3. Budget Stat Item Dropdown */}
          <div className="lg:col-span-4 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <span>통계목 선택</span>
              <span className="text-rose-500">*</span>
            </label>
            <select
              value={statItem}
              onChange={(e) => setStatItem(e.target.value)}
              disabled={!detailedProject}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/80 disabled:opacity-50 transition-all font-medium"
            >
              <option value="">{detailedProject ? '-- 통계목 선택 --' : '-- 세부사업을 먼저 선택하세요 --'}</option>
              {statItemOptions.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* 4. Unit Price Input */}
          <div className="lg:col-span-3 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <span>단가 (원)</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="0"
              value={unitPriceStr}
              onChange={handleUnitPriceChange}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm text-right focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/80 transition-all font-mono font-bold"
            />
          </div>

          {/* 5. Quantity Input */}
          <div className="lg:col-span-2 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <span>수량</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm text-center focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/80 transition-all font-mono font-bold"
            />
          </div>

          {/* 6. Total Amount Auto-Calculation */}
          <div className="lg:col-span-4 space-y-1.5">
            <label className="text-xs font-bold text-indigo-700">총 예정 집행액 (자동 계산)</label>
            <div className="w-full px-3.5 py-2.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-indigo-900 font-extrabold text-sm text-right flex items-center justify-between">
              <span className="text-xs text-indigo-600 font-bold">₩</span>
              <span className="font-mono text-base">{calculatedAmount.toLocaleString('ko-KR')} 원</span>
            </div>
          </div>

          {/* 7. Action Buttons */}
          <div className="lg:col-span-3 flex items-end gap-2">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {editingEntry ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editingEntry ? '수정 완료' : '항목 추가'}
            </button>
            {editingEntry && onCancelEdit && (
              <button
                type="button"
                onClick={onCancelEdit}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all active:scale-98 flex items-center justify-center cursor-pointer"
                title="수정 취소"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* 8. Memo Input */}
          <div className="lg:col-span-12 space-y-1.5">
            <label className="text-xs font-bold text-slate-500">산출근거 및 비고 (선택)</label>
            <input
              type="text"
              placeholder="예: 건강증진지원실 AI 메디헬스 결과지 자동 출력 및 분석 키오스크 2대"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500/80 transition-all font-medium"
            />
          </div>
        </div>
      </form>
    </div>
  );
});

SimulationInputForm.displayName = 'SimulationInputForm';
