'use client';

import React from 'react';
import { FestivalValidationReport } from '@/hooks/useFestivalValidation';
import { ShieldAlert, ShieldCheck, AlertTriangle, Zap, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface DetectiveValidationHUDProps {
  report: FestivalValidationReport;
}

export const DetectiveValidationHUD: React.FC<DetectiveValidationHUDProps> = ({ report }) => {
  const { permits, budgetValidation, overallRiskLevel, injectMissingPermits } = report;

  const formatKW = (amount: number) => {
    const mans = Math.round(amount / 10000);
    return `${mans.toLocaleString()}만원`;
  };

  const getRiskBadge = () => {
    switch (overallRiskLevel) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            🔴 CRITICAL RISK / 비상 경고
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            🟡 WARNING / 검토 주의
          </span>
        );
      case 'SAFE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            🟢 SAFE / 검증완료
          </span>
        );
    }
  };

  const getPermitPillStyle = (status: 'MISSING' | 'INCOMPLETE' | 'VERIFIED') => {
    switch (status) {
      case 'VERIFIED':
        return {
          container: 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300',
          badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
          text: '검증완료'
        };
      case 'INCOMPLETE':
        return {
          container: 'bg-amber-950/40 border-amber-500/40 text-amber-300',
          badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
          icon: <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
          text: '검토중'
        };
      case 'MISSING':
        return {
          container: 'bg-red-950/50 border-red-500/50 text-red-300 animate-pulse',
          badge: 'bg-red-500/20 text-red-400 border-red-500/30',
          icon: <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />,
          text: '미비/누락'
        };
    }
  };

  const getBudgetScaleBadge = () => {
    switch (budgetValidation.scaleStatus) {
      case 'IN_SCALE':
        return <span className="text-emerald-400 font-bold text-xs">🟢 적정 (5~7천만)</span>;
      case 'UNDER_SCALE':
        return <span className="text-amber-400 font-bold text-xs">🟡 5천만원 미달</span>;
      case 'OVER_SCALE':
        return <span className="text-red-400 font-bold text-xs">🔴 7천만원 초과</span>;
    }
  };

  // Compute progress percentage relative to 70M max scale
  const progressPercent = Math.min(100, Math.max(0, Math.round((budgetValidation.totalAllocated / budgetValidation.targetScaleMax) * 100)));

  return (
    <div className="w-[95%] max-w-4xl mx-auto bg-slate-950/90 backdrop-blur-md border border-amber-900/50 shadow-2xl rounded-2xl p-3 md:p-4 text-slate-100 select-none">
      {/* Top Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-amber-400 tracking-tight flex items-center gap-1.5">
            ⚡ 마인드맵 실시간 검증 HUD
          </span>
          {getRiskBadge()}
        </div>

        <button
          onClick={injectMissingPermits}
          className="bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-lg cursor-pointer flex items-center gap-1.5 hover:scale-105 active:scale-95"
        >
          <Zap className="w-3.5 h-3.5 text-amber-200 fill-amber-200" />
          ⚡ 필수 인허가 4종 자동 보완
        </button>
      </div>

      {/* Main Content Grid: Permits Checklist & Budget Progress */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2.5 items-center">
        {/* Left: Essential Permits Checklist Pills (7 Cols) */}
        <div className="md:col-span-7 space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>📋 필수 인허가 4종 점검표</span>
            <span className="text-[10px] text-slate-500">
              {permits.filter(p => p.status === 'VERIFIED').length} / 4 완료
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {permits.map(permit => {
              const style = getPermitPillStyle(permit.status);
              return (
                <div
                  key={permit.key}
                  className={`flex items-center justify-between p-2 rounded-xl border text-xs font-medium transition ${style.container}`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {style.icon}
                    <span className="truncate">{permit.label}</span>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${style.badge}`}>
                    {style.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Budget Scale Progress Bar (5 Cols) */}
        <div className="md:col-span-5 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold">💰 5~7천만 축제 예산 스케일</span>
            {getBudgetScaleBadge()}
          </div>

          {/* Progress Bar Track */}
          <div className="relative w-full bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700">
            {/* Target 50M-70M Scale Indicator Zone (71.4% to 100%) */}
            <div className="absolute top-0 bottom-0 left-[71.4%] right-0 bg-emerald-500/20 border-l border-emerald-500/50" />
            
            {/* Active Filled Bar */}
            <div
              className={`h-full transition-all duration-500 ${
                budgetValidation.scaleStatus === 'OVER_SCALE'
                  ? 'bg-gradient-to-r from-amber-500 to-red-500'
                  : budgetValidation.scaleStatus === 'IN_SCALE'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : 'bg-gradient-to-r from-amber-600 to-amber-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] text-slate-400">
            <span>편성: <strong className="text-amber-300 font-bold">{formatKW(budgetValidation.totalAllocated)}</strong></span>
            <span>목표: <strong className="text-slate-200">50M ~ 70M KRW</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
