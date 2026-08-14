'use client';

import React, { useState, useCallback } from 'react';
import { useBudgetSimulator } from '@/hooks/useBudgetSimulator';
import { SimulationSummaryCards } from './ui/SimulationSummaryCards';
import { SimulationInputForm } from './ui/SimulationInputForm';
import { SimulationResultTable } from './ui/SimulationResultTable';
import { SimulationEntry } from '@/types';
import { Calculator, Sparkles, RotateCcw, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const BudgetSimulator: React.FC = React.memo(() => {
  const {
    entries,
    availableDetailedProjects,
    getStatItemsForProject,
    addEntry,
    updateEntry,
    deleteEntry,
    resetEntries,
    loadTestPreset,
    projectSummaries,
    statItemSummaries,
  } = useBudgetSimulator();

  // Currently Editing Entry State
  const [editingEntry, setEditingEntry] = useState<SimulationEntry | null>(null);

  const handleEditEntry = useCallback((entry: SimulationEntry) => {
    setEditingEntry(entry);
    // Smooth scroll to top form if needed
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingEntry(null);
  }, []);

  const handleUpdateEntryAndClear = useCallback((id: string, partial: Partial<SimulationEntry>) => {
    updateEntry(id, partial);
    setEditingEntry(null);
  }, [updateEntry]);

  // Count Deficit Projects
  const deficitProjectsCount = projectSummaries.filter((p) => p.isDeficit).length;

  return (
    <div className="w-full flex flex-col gap-6 text-slate-800 p-1 sm:p-2">
      {/* 1. Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 md:p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-xs">
            <Calculator className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-3 tracking-tight">
              <span>예산 시뮬레이터</span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200/70 text-indigo-700 font-mono">
                Commitment Balance Engine
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
              현재 집행 잔액을 기준으로 미집행 확정 지출 예정액을 차감하여 세부사업 및 통계목별 예상 잔액과 추가 필요 예산을 실시간 시뮬레이션합니다.
            </p>
          </div>
        </div>

        {/* Global Preset & Status Summary Header Badge */}
        <div className="flex items-center gap-3">
          {deficitProjectsCount > 0 ? (
            <div className="flex items-center gap-2 px-3.5 py-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold animate-pulse">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>{deficitProjectsCount}개 세부사업 예산 초과 경고</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-700 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>전체 세부사업 안전 잔액 수지</span>
            </div>
          )}

          <button
            type="button"
            onClick={loadTestPreset}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
            title="표준 보건소 & AI 메디헬스 테스트 지출 항목을 로드합니다."
          >
            <Sparkles className="w-4 h-4" />
            테스트 프리셋 로드
          </button>
          <button
            type="button"
            onClick={resetEntries}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="등록된 시뮬레이션 지출 내역을 모두 초기화합니다."
          >
            <RotateCcw className="w-3.5 h-3.5" />
            초기화
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards (Summary Cards) */}
      <SimulationSummaryCards
        projectSummaries={projectSummaries}
        statItemSummaries={statItemSummaries}
      />

      {/* 3. Simulation Input Form */}
      <SimulationInputForm
        detailedProjects={availableDetailedProjects}
        getStatItemsForProject={getStatItemsForProject}
        editingEntry={editingEntry}
        onAddEntry={addEntry}
        onUpdateEntry={handleUpdateEntryAndClear}
        onCancelEdit={handleCancelEdit}
        onResetAll={resetEntries}
        onLoadTestPreset={loadTestPreset}
      />

      {/* 4. Aggregated Simulation Result Table & Active Entry List */}
      <SimulationResultTable
        projectSummaries={projectSummaries}
        statItemSummaries={statItemSummaries}
        entries={entries}
        onEditEntry={handleEditEntry}
        onDeleteEntry={deleteEntry}
        onResetAll={resetEntries}
        onLoadTestPreset={loadTestPreset}
      />
    </div>
  );
});

BudgetSimulator.displayName = 'BudgetSimulator';

export default BudgetSimulator;
