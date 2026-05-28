import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, Bar, ReferenceLine, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, ComposedChart } from 'recharts';
import { Task, BudgetCategory, BudgetEntry } from '@/types';
import { usePortfolioAnalytics } from '@/hooks/usePortfolioAnalytics';
import { useBudget } from '@/hooks/useBudget';
import { Expand, Shrink, ChevronRight, LayoutDashboard, ChevronDown, ChevronUp, AlertCircle, Folder, FileText, Lock, Unlock, Layers, X } from 'lucide-react';
import { format } from 'date-fns';

// --- 수식 계산 및 파싱 헬퍼 함수 ---
const evaluateExpression = (expr: string): number => {
  try {
    const cleanExpr = expr.replace(/,/g, '');
    if (!/^[0-9+\-*/\s()]*$/.test(cleanExpr)) {
      return 0;
    }
    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${cleanExpr})`)();
    return typeof result === 'number' && !isNaN(result) ? result : 0;
  } catch (e) {
    return 0;
  }
};

interface SplitFormula {
  completed: string;
  planned: string;
}

const extractSplitFormulaFromNote = (note: string | undefined): SplitFormula => {
  const result = { completed: '', planned: '' };
  if (!note) return result;
  
  const match = note.match(/^\[완료:\s*(.*?)\s*\|\s*예정:\s*(.*?)\s*\]/);
  if (match) {
    result.completed = match[1];
    result.planned = match[2];
  }
  return result;
};

const extractMemoFromNoteWithSplit = (note: string | undefined): string => {
  if (!note) return '';
  return note.replace(/^\[완료:.*?\|.*?\]\s*/, '');
};

const buildNoteWithSplitFormula = (completedFormula: string, plannedFormula: string, memo: string): string => {
  const comp = completedFormula.trim();
  const plan = plannedFormula.trim();
  const trimmedMemo = memo.trim();
  
  if (!comp && !plan) return trimmedMemo;
  
  return `[완료: ${comp} | 예정: ${plan}]${trimmedMemo ? ' ' + trimmedMemo : ''}`;
};

interface DashboardProps {
  tasks: Task[];
  budgetCategories: BudgetCategory[];
  budgetEntries: BudgetEntry[];
  onLogout?: () => void;
  appMode?: 'HCHPS' | 'VITAL';
}

export function PortfolioDashboardView({ tasks, budgetCategories, budgetEntries, onLogout, appMode = 'VITAL' }: DashboardProps) {
  const [trendTab, setTrendTab] = useState('Growth');
  const [timeFilter, setTimeFilter] = useState('ALL');
  const [expanded, setExpanded] = useState(false);
  const [chartType, setChartType] = useState<'monthly' | 'cumulative'>('monthly');
  const [expandedSubCategory, setExpandedSubCategory] = useState<string | null>(null);
  const [activeInputId, setActiveInputId] = useState<string | null>(null);

  const { addEntry, updateEntry, deleteEntry, updateCategory, entries, getCategoryStats } = useBudget();

  const {
    selectedProject, setSelectedProject,
    expandedCategory, setExpandedCategory,
    detailedProjects,
    filteredCategories,
    totalBudget,
    executedBudget,
    remainingBudget,
    executionRate,
    pieData,
    breakdownData,
    allBreakdownData,
    monthlyExecutionData,
    maxSpendMonth,
    avgMonthlySpend,
    remainingTargetAmount,
    recommendedMonthlySpendForTarget,
    exhaustionMonthName,
    projectedEoyExecutionRate,
    totalPlannedInDraft,
    unplannedRemainingAmount,
    totalVirtualAdjustment
  } = usePortfolioAnalytics(budgetCategories, budgetEntries);


  const isHchps = appMode === 'HCHPS';
  const themeColors = useMemo(() => {
    return isHchps
      ? ['#059669', '#064e3b', '#34d399', '#047857', '#6ee7b7', '#d1fae5']
      : ['#3B82F6', '#1E3A8A', '#93C5FD', '#1D4ED8', '#60A5FA', '#DBEAFE'];
  }, [isHchps]);

  const dynamicPieData = useMemo(() => {
    return [
      { ...pieData[0], color: isHchps ? '#059669' : '#3B82F6' },
      { ...pieData[1] }
    ];
  }, [pieData, isHchps]);

  return (

    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300 relative min-h-screen font-sans">
      
      {/* Header */}
      <div className="flex flex-col gap-3 mt-4 mb-2">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-[1rem] shadow-sm border border-slate-100 flex items-center justify-center overflow-hidden">
            <img src="/icon-192x192.png" alt={`${appMode} Logo`} className="w-full h-full object-cover" />
          </div>
          PORTFOLIO {appMode}
        </h1>
        <div className="flex items-center gap-3 ml-2">
          <div className={`w-1 h-5 ${isHchps ? 'bg-emerald-600' : 'bg-blue-600'} rounded-full`} />
          <p className="text-[13px] font-semibold text-slate-500 tracking-wide">
            {isHchps 
              ? '사내 업무 편성, 지식 자산화, 그리고 인물 시맨틱 온톨로지 시각화를 위한 초개인화 인텔리전스 워크스페이스' 
              : 'Vital Information & Task Architecture Ledger — converging public health resources, tasks, and budget execution into a unified management topology'}
          </p>
        </div>
      </div>

      {/* Main Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-4">
        
        {/* Left Column */}
        <div className="xl:col-span-6 flex flex-col gap-6">
          {/* Budget Allocation */}
          <div className="bg-white rounded-[2rem] p-8 shadow-sm flex flex-col h-[400px]">
          <div className="flex justify-between items-center z-10 mb-8">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
              Budget Allocation
            </h2>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className={`bg-slate-50 border border-slate-200 text-slate-700 text-sm font-black rounded-xl px-4 py-2.5 outline-none focus:border-${isHchps ? 'emerald' : 'blue'}-500 focus:ring-2 focus:ring-${isHchps ? 'emerald' : 'blue'}-500/20 transition-all cursor-pointer shadow-sm min-w-[180px]`}
            >
              <option value="ALL">세부사업명 전체</option>
              {detailedProjects.map(dp => (
                <option key={dp} value={dp}>{dp}</option>
              ))}
            </select>
          </div>
          
          <div className="flex-1 w-full h-[250px] flex flex-col sm:flex-row items-stretch justify-center mb-6 gap-6 sm:gap-8 md:gap-12 lg:gap-16">
            <div className="w-full sm:w-[260px] h-[250px] flex-shrink-0 flex justify-center items-center">
              <div className="w-[230px] h-[230px] relative flex-shrink-0">
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie
                      data={dynamicPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={0}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={0}
                      style={{ outline: 'none' }}
                    >
                      {dynamicPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none' }} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value: any) => [`${Number(value).toLocaleString()} KRW`, '']}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
                  <span className="text-[12px] font-extrabold text-slate-800 uppercase tracking-widest mb-1">TOTAL BUDGET</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[18px] font-black text-slate-900 leading-none tracking-tight">{totalBudget.toLocaleString()}</span>
                    <span className="text-[11px] font-bold text-slate-400 leading-none">KRW</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 flex justify-center sm:justify-start w-full sm:w-[300px] md:w-[340px] lg:w-[360px] h-full items-center min-w-0">
              <div className="w-full max-w-[380px] flex flex-col gap-4 justify-start min-w-0 max-h-[260px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
                {breakdownData.map((item, idx) => (
                <div 
                  key={idx} 
                  className="group flex items-center w-full p-2 -ml-2 rounded-xl hover:bg-slate-50 transition-colors cursor-default min-w-0"
                >
                  <div className="w-4 h-4 rounded-full shrink-0 mr-3 shadow-sm" style={{ backgroundColor: themeColors[idx % themeColors.length] || '#cbd5e1' }} />
                  <div className="flex flex-col min-w-0 shrink" title={item.formationItem ? `${item.formationItem} - ${item.name}` : item.name}>
                    {item.formationItem && (
                      <span className="text-[10px] font-bold text-slate-400 truncate tracking-wider leading-none mb-1">
                        {item.formationItem}
                      </span>
                    )}
                    <span className="text-[14px] font-black text-slate-700 uppercase tracking-wider truncate leading-none">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex-1 min-w-[12px] border-b-[2px] border-dotted border-slate-200 mx-3 mt-1.5 opacity-80"></div>
                  <div className="w-[96px] shrink-0 text-right transition-transform group-hover:-translate-x-1 duration-300 ml-auto">
                    <span className="text-[16px] font-black text-slate-800 leading-none tabular-nums whitespace-nowrap block">{item.total.toLocaleString()}</span>
                  </div>
                </div>
              ))}
              {breakdownData.length === 0 && (
                <span className="text-xs font-bold text-slate-400 text-center">세부 항목이 없습니다.</span>
              )}
              </div>
            </div>
          </div>
        </div>

          {/* KPI Mini Cards Grid */}
          <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-2 sm:gap-y-3 content-start">
          {/* 1. Execution Rate */}
          <div className="bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100/50 rounded-[1.5rem] p-4 flex flex-col justify-between relative overflow-hidden group">
              <span className={`text-[10px] font-black ${isHchps ? 'text-emerald-600' : 'text-blue-600'} uppercase tracking-widest relative z-10 mb-3`}>BUDGET EXECUTION</span>
              <span className={`text-2xl font-black ${isHchps ? 'text-emerald-600' : 'text-blue-600'} leading-none relative z-10`}>{executionRate.toFixed(1)}%</span>
              <div 
                className="absolute right-4 bottom-4 w-8 h-8 rounded-full shrink-0 flex items-center justify-center shadow-sm opacity-80 group-hover:scale-110 transition-transform"
                style={{ background: `conic-gradient(${isHchps ? '#10b981' : '#3b82f6'} ${executionRate}%, #e2e8f0 0)` }}
              >
                <div className="w-[20px] h-[20px] bg-white rounded-full" />
              </div>
            </div>

            {/* 2. Remaining Budget */}
            <div className="bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100/50 rounded-[1.5rem] p-4 flex flex-col justify-between relative overflow-hidden group">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest relative z-10 mb-3">REMAINING BUDGET</span>
              <span className="text-2xl font-black text-slate-900 leading-none relative z-10">{(100 - executionRate).toFixed(1)}%</span>
              <div 
                className="absolute right-4 bottom-4 w-8 h-8 rounded-full shrink-0 flex items-center justify-center shadow-sm opacity-80 group-hover:scale-110 transition-transform"
                style={{ background: `conic-gradient(#94a3b8 ${100 - executionRate}%, #e2e8f0 0)` }}
              >
                <div className="w-[20px] h-[20px] bg-white rounded-full" />
              </div>
            </div>

            {/* 3. Executed Amount */}
            <div className="bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100/50 rounded-[1.5rem] p-4 flex flex-col justify-between relative overflow-hidden group">
              <span className={`text-[10px] font-black ${isHchps ? 'text-emerald-600' : 'text-blue-600'} uppercase tracking-widest relative z-10 mb-3`}>EXECUTED AMOUNT</span>
              <span className="text-xl font-black text-slate-900 leading-none relative z-10 truncate" title={`${executedBudget.toLocaleString()} KRW`}>
                {executedBudget.toLocaleString()}<span className="text-xs text-slate-400 ml-1">KRW</span>
              </span>
            </div>

            {/* 4. Remaining Amount */}
            <div className="bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100/50 rounded-[1.5rem] p-4 flex flex-col justify-between relative overflow-hidden group">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest relative z-10 mb-3">REMAINING AMOUNT</span>
              <span className="text-xl font-black text-slate-900 truncate block leading-none relative z-10" title={`${remainingBudget.toLocaleString()} KRW`}>
                {remainingBudget.toLocaleString()}<span className="text-xs text-slate-400 ml-1">KRW</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Panel: Predictive Budget Modeling */}
        <div className="xl:col-span-6 flex flex-col gap-6">
          <div className="bg-white rounded-[2rem] p-8 shadow-sm h-full flex flex-col relative overflow-hidden">
            {/* Background Decor */}
            <div className={`absolute -top-24 -right-24 w-64 h-64 ${isHchps ? 'bg-emerald-50/50' : 'bg-blue-50/50'} rounded-full blur-3xl pointer-events-none`} />

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative z-10">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                  Monthly Budget Execution
                </h2>
                <p className="text-[13px] font-bold text-slate-400 mt-1">Monthly breakdown and cumulative execution trend</p>
              </div>

              {/* Chart Type Toggle Switch */}
              <div className="flex p-1 bg-slate-50 rounded-xl border border-slate-200/60 shadow-inner shrink-0">
                <button 
                  onClick={() => setChartType('monthly')} 
                  className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${chartType === 'monthly' ? `bg-white ${isHchps ? 'text-emerald-600' : 'text-blue-600'} shadow-sm border border-slate-200/50` : 'text-slate-400 hover:text-slate-600 border border-transparent'}`}
                >
                  월별 집행액
                </button>
                <button 
                  onClick={() => setChartType('cumulative')} 
                  className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${chartType === 'cumulative' ? `bg-white ${isHchps ? 'text-emerald-600' : 'text-blue-600'} shadow-sm border border-slate-200/50` : 'text-slate-400 hover:text-slate-600 border border-transparent'}`}
                >
                  누적 집행액
                </button>
              </div>
            </div>

            {/* KPIs for 11-Month Total Execution Target */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-6 relative z-10">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">PEAK SPENDING</span>
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-1">
                  <span className="text-xl font-black text-slate-800 leading-none">{maxSpendMonth.month}</span>
                  <span className="text-[11px] font-bold text-slate-500 truncate">({maxSpendMonth.amount.toLocaleString()}원)</span>
                </div>
              </div>
              <div className="flex flex-col items-center sm:items-start border-l border-slate-100 pl-2">
                <span className={`text-[10px] font-black ${isHchps ? 'text-emerald-600' : 'text-blue-600'} uppercase tracking-widest mb-1 truncate`}>REQ. SPEND / MO (11월)</span>
                <div className="flex items-baseline gap-0.5 sm:gap-1 flex-wrap">
                  <span className={`text-[15px] sm:text-xl font-black ${isHchps ? 'text-emerald-600' : 'text-blue-600'} leading-none tracking-tight`}>{Math.round(recommendedMonthlySpendForTarget).toLocaleString()}</span>
                  <span className={`text-[10px] font-bold ${isHchps ? 'text-emerald-400' : 'text-blue-400'}`}>원</span>
                </div>
              </div>
              <div className="flex flex-col items-end sm:items-start border-l border-slate-100 pl-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 truncate">REMAINING TARGET</span>
                <div className="flex items-baseline gap-0.5 sm:gap-1 flex-wrap">
                  <span className="text-[15px] sm:text-xl font-black text-slate-900 leading-none tracking-tight">{remainingTargetAmount.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-slate-400">원</span>
                </div>
              </div>
            </div>

            {/* Monthly Trend Chart */}
            <div className="flex-1 mt-6 relative min-h-0 w-full h-full">
              <ResponsiveContainer width="100%" height="100%" minHeight={385}>
                <ComposedChart data={monthlyExecutionData} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isHchps ? '#10B981' : '#3B82F6'} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={isHchps ? '#10B981' : '#3B82F6'} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} dy={10} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} 
                    tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`} 
                  />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -4px rgb(0 0 0 / 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                    itemStyle={{ fontSize: '12px', fontWeight: '900' }}
                    labelStyle={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px', fontWeight: 'bold' }}
                    formatter={(value: any, name: any) => {
                      if (name === 'targetCumulative') return [`${Number(value).toLocaleString()} KRW`, '11월 100% 소진 목표선'];
                      const label = chartType === 'cumulative' ? '누적 집행액' : '월별 집행액';
                      return [`${Number(value).toLocaleString()} KRW`, label];
                    }}
                  />
                  
                  {/* 11월 100% 소진 마감일 세로 가이드라인 - insideTop과 offset 조정으로 텍스트 잘림 방지 */}
                  <ReferenceLine x="Nov" stroke="#ef4444" strokeDasharray="4 4" strokeWidth={2} label={{ value: "11월 예산 마감", fill: "#ef4444", fontSize: 9, fontWeight: 'bold', position: 'insideTop', offset: 15 }} />
                  
                  {chartType === 'monthly' ? (
                    <Bar dataKey="monthly" fill={isHchps ? '#34D399' : '#60A5FA'} radius={[4, 4, 0, 0]} barSize={16} />
                  ) : (
                    <>
                      {/* 선형 100% 소진 가이드 점선 */}
                      <Line type="monotone" dataKey="targetCumulative" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="5 5" dot={false} activeDot={false} />
                      <Area type="monotone" dataKey="cumulative" stroke={isHchps ? '#10B981' : '#3B82F6'} strokeWidth={3} fillOpacity={1} fill="url(#colorCumulative)" activeDot={{ r: 5, fill: isHchps ? '#10B981' : '#3B82F6', stroke: '#fff', strokeWidth: 2 }} />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Lightweight Accordion: Detailed Asset Portfolio */}
      <div className="mt-8 flex flex-col gap-4">
        <h3 className="text-xl font-black text-slate-900 flex items-center gap-3 mb-2 ml-2">
          <div className={`w-1 h-5 ${isHchps ? 'bg-emerald-600' : 'bg-blue-600'} rounded-full`} />
          Detailed Budget Breakdown
        </h3>
        
        <div className="flex flex-col gap-3">
          {allBreakdownData.map((item, idx) => {
            const isExpanded = expandedCategory === item.name;
            const subItems = budgetCategories.filter(c => c.detailedProject === item.name);
            
            // 대카테고리 수준에서 모든 소카테고리의 설계 확정 금액(가상 조정액) 합산
            let categoryVirtualAdjustment = 0;
            subItems.forEach((sub: any) => {
              if (sub.subItems) {
                sub.subItems.forEach((s: any) => {
                  const hasCalcs = s.calculations && s.calculations.length > 0;
                  if (hasCalcs) {
                    s.calculations.forEach((c: any) => {
                      if (typeof c.virtualAdjustment === 'number') {
                        categoryVirtualAdjustment += c.virtualAdjustment;
                      }
                    });
                  } else {
                    if (typeof s.virtualAdjustment === 'number') {
                      categoryVirtualAdjustment += s.virtualAdjustment;
                    }
                  }
                });
              }
            });

            // 대카테고리 수준의 남은 차액 (총 본예산 - 설계 확정 금액 합산)
            const categoryRemainingDiff = item.total - categoryVirtualAdjustment;
            
            // 실제 집행률, 설계 확정률, 남은 예산 비율 계산
            const executionRate = item.rate;
            const designRate = item.total > 0 ? (categoryVirtualAdjustment / item.total) * 100 : 0;
            const remainingRate = item.total > 0 ? (categoryRemainingDiff / item.total) * 100 : 0;
            
            return (
              <div key={idx} className="flex flex-col bg-white rounded-[1.5rem] shadow-sm overflow-hidden transition-all duration-300 border border-transparent hover:border-slate-100">
                <div 
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-6 cursor-pointer hover:bg-slate-50/30 transition-colors gap-4 sm:gap-0"
                  onClick={() => setExpandedCategory(isExpanded ? null : item.name)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: themeColors[idx % themeColors.length] || '#cbd5e1' }} />
                    <span className="text-xl font-black text-slate-800 tracking-tight">{item.name}</span>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                      {/* 대카테고리 총 본예산 칩 */}
                      <div className="flex flex-col sm:items-end px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] min-w-[100px] sm:min-w-[120px]">
                        <span className="text-[17px] font-bold text-slate-500 leading-tight">총 본예산</span>
                        <span className="font-extrabold text-[19px] text-slate-700 mt-0.5">{item.total.toLocaleString()}원</span>
                      </div>
  
                      {/* 대카테고리 합산 설계확정 금액 칩 */}
                      <div className="flex flex-col sm:items-end px-3 py-1.5 rounded-xl bg-indigo-50/30 border border-indigo-100/50 shadow-[inset_0_1px_2px_rgba(79,70,229,0.02)] min-w-[100px] sm:min-w-[120px]">
                        <span className="text-[17px] font-bold text-indigo-600/90 leading-tight">설계 확정 금액</span>
                        <span className="font-black text-[19px] text-indigo-600 mt-0.5">{categoryVirtualAdjustment.toLocaleString()}원</span>
                      </div>
  
                      {/* 대카테고리 남은 차액 칩 */}
                      <div className={`flex flex-col sm:items-end px-3 py-1.5 rounded-xl border min-w-[100px] sm:min-w-[120px] ${
                        categoryRemainingDiff === 0 
                          ? 'bg-emerald-50/30 border-emerald-100/50 shadow-[inset_0_1px_2px_rgba(16,185,129,0.02)]' 
                          : 'bg-rose-50/30 border-rose-100/50 shadow-[inset_0_1px_2px_rgba(244,63,94,0.02)]'
                      }`}>
                        <span className={`text-[17px] font-bold leading-tight ${categoryRemainingDiff === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>남은 차액</span>
                        <span className={`font-black text-[19px] mt-0.5 ${categoryRemainingDiff === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{categoryRemainingDiff.toLocaleString()}원</span>
                      </div>
                    </div>
                    
                    {/* 다차원 비율 정보 패널 */}
                    <div className="border-l border-slate-200 pl-4 flex flex-col gap-0.5 text-[12px] font-black text-slate-500 min-w-[155px] text-right pr-2">
                      <div>실제 집행률: <span className="text-slate-800 font-extrabold">{executionRate.toFixed(1)}%</span></div>
                      <div>설계 확정률: <span className="text-indigo-600 font-black">{designRate.toFixed(1)}%</span></div>
                      <div>남은 예산 비율: <span className={categoryRemainingDiff === 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>{remainingRate.toFixed(1)}%</span></div>
                    </div>
                    
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />}
                  </div>
                </div>
                
                {/* High-Fidelity Detailed Body */}
                {isExpanded && (
                  <div className="px-6 pb-6 pt-2 border-t border-slate-50 mx-6 animate-in fade-in duration-200">
                    

                    {/* 통계목 세부 내역 루프 */}
                    <div className="flex flex-col gap-4">
                      {subItems.map((sub: any, sIdx: number) => {
                        const isSubExpanded = expandedSubCategory === sub.id;
                        
                        // 통계목의 가상 조정액 계산
                        let subVirtualAdjustment = 0;
                        if (sub.subItems) {
                          sub.subItems.forEach((s: any) => {
                            const hasCalcs = s.calculations && s.calculations.length > 0;
                            if (hasCalcs) {
                              s.calculations.forEach((c: any) => {
                                if (typeof c.virtualAdjustment === 'number') {
                                  subVirtualAdjustment += c.virtualAdjustment;
                                }
                              });
                            } else {
                              if (typeof s.virtualAdjustment === 'number') {
                                subVirtualAdjustment += s.virtualAdjustment;
                              }
                            }
                          });
                        }
                        
                        const subRemainingDiff = sub.totalBudget - subVirtualAdjustment;

                        return (
                          <div key={sIdx} className="flex flex-col rounded-2xl border border-slate-100 hover:border-slate-200/80 transition-all bg-slate-50/20 shadow-sm overflow-hidden">
                            {/* 통계목 헤더 */}
                            <div 
                              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 cursor-pointer hover:bg-slate-50/40 transition-colors gap-3 sm:gap-0"
                              onClick={() => setExpandedSubCategory(isSubExpanded ? null : sub.id)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex flex-col">
                                  <span className="font-black text-[18px] text-slate-800">{sub.name}</span>
                                  {sub.formationItem && (
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{sub.formationItem} {sub.statItem && `| ${sub.statItem}`}</span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                                <div className="flex flex-col sm:items-end">
                                  <span className="text-[13px] font-semibold text-slate-400">총 본예산</span>
                                  <span className="font-extrabold text-[15px] text-slate-700">{sub.totalBudget.toLocaleString()}원</span>
                                </div>
                                <div className="flex flex-col sm:items-end">
                                  <span className="text-[13px] font-semibold text-indigo-600/90">설계 확정 금액</span>
                                  <span className="font-black text-[15px] text-indigo-600">{subVirtualAdjustment.toLocaleString()}원</span>
                                </div>
                                <div className="flex flex-col sm:items-end">
                                  <span className="text-[13px] font-semibold text-slate-400">남은 차액</span>
                                  <span className={`font-black text-[15px] ${subRemainingDiff === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{subRemainingDiff.toLocaleString()}원</span>
                                </div>
                                {isSubExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                              </div>
                            </div>

                            {/* 통계목 상세 플래닝 & 대조 보드 */}
                            {isSubExpanded && (
                              <div className="p-5 border-t border-slate-100 bg-white flex flex-col gap-6 animate-in slide-in-from-top-2 duration-200">
                                


                                {/* 2) 공식 예산서 세부 산출 내역 대조 테이블 (subItems 트리 구조) */}
                                <div className="flex flex-col gap-2.5">
                                  <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                    <span>공식 예산서 세부 산출 내역 대조 및 가상 보정</span>
                                  </div>

                                  <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full border-collapse text-left">
                                      <thead>
                                        <tr className="bg-slate-50/80 border-b border-slate-100 text-[12px] font-black text-slate-400 uppercase tracking-wider">
                                          <th className="py-2.5 px-4">구분 / 세부 항목명</th>
                                          <th className="py-2.5 px-4 text-right">공식 예산액 (원)</th>
                                          <th className="py-2.5 px-4 text-center">집행 제어</th>
                                          <th className="py-2.5 px-4 text-right w-[150px]">확정액 (지출 완료)</th>
                                          <th className="py-2.5 px-4 text-right w-[150px]">확정액 (지출 예정)</th>
                                          <th className="py-2.5 px-4 text-right w-[140px]">남은 차액 (원)</th>
                                          <th className="py-2.5 px-4 text-left w-[200px]">비고</th>
                                        </tr>
                                      </thead>
                                      <tbody className="text-[16px] font-bold text-slate-600 divide-y divide-slate-100">
                                        {sub.subItems && sub.subItems.map((s: any, sIdx: number) => {
                                          const hasCalcs = s.calculations && s.calculations.length > 0;
                                          
                                          // Calculate completed/planned amounts for step 1
                                          let sCompTotal = 0;
                                          let sPlanTotal = 0;
                                          
                                          if (hasCalcs) {
                                            s.calculations.forEach((c: any) => {
                                              const { completed, planned } = extractSplitFormulaFromNote(c.note);
                                              const compBase = completed 
                                                ? completed 
                                                : (!completed && !planned && c.virtualAdjustment ? c.virtualAdjustment.toString() : '');
                                              sCompTotal += evaluateExpression(compBase);
                                              sPlanTotal += evaluateExpression(planned);
                                            });
                                          } else {
                                            const { completed, planned } = extractSplitFormulaFromNote(s.note);
                                            const compBase = completed 
                                              ? completed 
                                              : (!completed && !planned && s.virtualAdjustment ? s.virtualAdjustment.toString() : '');
                                            sCompTotal = evaluateExpression(compBase);
                                            sPlanTotal = evaluateExpression(planned);
                                          }
                                          
                                          const sRemainingDiff = s.amount - (sCompTotal + sPlanTotal);
                                          
                                          return (
                                            <React.Fragment key={sIdx}>
                                              {/* 1단계 통계목 아이템 */}
                                              <tr className={`${hasCalcs ? 'bg-slate-50/10' : ''} hover:bg-slate-50/40 transition-colors`}>
                                                <td className="py-3 px-4 flex items-center gap-2">
                                                  <Folder className="w-4 h-4 text-slate-400 shrink-0" />
                                                  <span>{s.name}</span>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const updatedSubItems = [...(sub.subItems || [])];
                                                      const currentItem = updatedSubItems[sIdx];
                                                      const calcs = [...(currentItem.calculations || [])];
                                                      
                                                      // 새 가상 항목 ID 생성
                                                      const newCalcId = `calc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                                                      
                                                      // 기존 입력 수식/메모 마이그레이션 (세부 계산식이 아예 없었던 경우)
                                                      if (calcs.length === 0 && (currentItem.note || currentItem.virtualAdjustment)) {
                                                        calcs.push({
                                                          id: `calc-${Date.now()}-mig`,
                                                          name: '기존 등록분',
                                                          calculation: '',
                                                          amount: currentItem.amount || 0,
                                                          virtualAdjustment: currentItem.virtualAdjustment || 0,
                                                          note: currentItem.note || ''
                                                        });
                                                      }
                                                      
                                                      // 새 세부 항목 객체 삽입
                                                      calcs.push({
                                                        id: newCalcId,
                                                        name: '새 세부 항목',
                                                        calculation: '',
                                                        amount: 0,
                                                        virtualAdjustment: 0,
                                                        note: '[완료:  | 예정: ]'
                                                      });
                                                      
                                                      updatedSubItems[sIdx] = {
                                                        ...currentItem,
                                                        calculations: calcs,
                                                        virtualAdjustment: calcs.reduce((sum: number, c: any) => sum + (c.virtualAdjustment || 0), 0),
                                                        note: '' // 마이그레이션되었으므로 1단계의 직접 작성 비고는 날림
                                                      };
                                                      
                                                      updateCategory(sub.id, { subItems: updatedSubItems });
                                                    }}
                                                    className="px-2 py-0.5 rounded text-[12px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100/70 transition-colors cursor-pointer ml-2 shrink-0 inline-flex items-center gap-1"
                                                    title="이 통계목 아래에 가상 세부 항목을 추가하여 다중 항목 확정액을 입력합니다"
                                                  >
                                                    + 세부 추가
                                                  </button>
                                                  {s.isLocked && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-red-50 text-red-500 border border-red-100">차단됨</span>
                                                  )}
                                                </td>
                                                <td className="py-3 px-4 text-right font-extrabold text-slate-800">
                                                  {s.amount.toLocaleString()}원
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                  <button 
                                                    onClick={() => {
                                                      const updatedSubItems = [...(sub.subItems || [])];
                                                      updatedSubItems[sIdx] = {
                                                        ...updatedSubItems[sIdx],
                                                        isLocked: !updatedSubItems[sIdx].isLocked
                                                      };
                                                      updateCategory(sub.id, { subItems: updatedSubItems });
                                                    }}
                                                    className="p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer inline-flex items-center justify-center"
                                                    title={s.isLocked ? "예산 통제 잠금 해제" : "예산 통제 잠금 (사용 불가)"}
                                                  >
                                                    {s.isLocked ? <Lock className="w-4 h-4 text-red-500" /> : <Unlock className="w-4 h-4 text-emerald-500" />}
                                                  </button>
                                                </td>
                                                {/* 확정액 (지출 완료) */}
                                                <td className="py-3 px-4 text-right">
                                                  {hasCalcs ? (
                                                    <span className="text-[15px] font-extrabold text-slate-500">
                                                      {sCompTotal > 0 ? `${sCompTotal.toLocaleString()}원` : '-'}
                                                    </span>
                                                  ) : (() => {
                                                    const { completed: compFormula, planned: planFormula } = extractSplitFormulaFromNote(s.note);
                                                    const compBase = compFormula 
                                                      ? compFormula 
                                                      : (!compFormula && !planFormula && s.virtualAdjustment ? s.virtualAdjustment.toString() : '');
                                                    const compVal = evaluateExpression(compBase);
                                                    const displayCompleted = compFormula || compBase;
                                                    
                                                    const inputId = `sub-comp-${sub.id}-${sIdx}`;
                                                    const isEditing = activeInputId === inputId;
                                                    
                                                    if (isEditing) {
                                                      return (
                                                        <input 
                                                          autoFocus
                                                          key={`input-sub-comp-${sub.id}-${sIdx}`}
                                                          type="text"
                                                          placeholder="0"
                                                          defaultValue={displayCompleted}
                                                          onInput={(e: React.FormEvent<HTMLInputElement>) => {
                                                            const val = e.currentTarget.value;
                                                            const cleanVal = val.replace(/[^0-9+\-*/\s,()]/g, '');
                                                            const formatted = cleanVal.replace(/,/g, '').replace(/\d+/g, (m) => parseInt(m, 10).toLocaleString());
                                                            e.currentTarget.value = formatted;
                                                          }}
                                                          onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                                                            const inputVal = e.target.value.trim();
                                                            const updatedSubItems = [...(sub.subItems || [])];
                                                            const currentItem = updatedSubItems[sIdx];
                                                            
                                                            const completedVal = evaluateExpression(inputVal);
                                                            const autoPlannedVal = Math.max(0, currentItem.amount - completedVal);
                                                            const existingMemo = extractMemoFromNoteWithSplit(currentItem.note);
                                                            
                                                            const newNote = buildNoteWithSplitFormula(inputVal, autoPlannedVal.toString(), existingMemo);
                                                            
                                                            updatedSubItems[sIdx] = {
                                                              ...currentItem,
                                                              virtualAdjustment: completedVal + autoPlannedVal,
                                                              note: newNote
                                                            };
                                                            updateCategory(sub.id, { subItems: updatedSubItems });
                                                            setTimeout(() => setActiveInputId(null), 150);
                                                          }}
                                                          className="w-full min-w-[100px] bg-white border border-blue-500 rounded-lg px-2.5 py-1 text-xs font-black text-slate-800 text-right focus:ring-1 focus:ring-blue-500/20 outline-none"
                                                        />
                                                      );
                                                    }
                                                    
                                                    return (
                                                      <div 
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setTimeout(() => setActiveInputId(inputId), 50);
                                                        }}
                                                        className={`px-3 py-1.5 rounded-full text-right cursor-pointer text-xs font-black transition-colors min-w-[80px] inline-block ${
                                                          compVal > 0 
                                                            ? 'text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100/70' 
                                                            : 'text-slate-300 bg-slate-50/50 border border-dashed border-slate-200 hover:bg-slate-50'
                                                        }`}
                                                      >
                                                        {compVal > 0 ? compVal.toLocaleString() : '완료액'}
                                                      </div>
                                                    );
                                                  })()}
                                                </td>
                                                {/* 확정액 (지출 예정) */}
                                                <td className="py-3 px-4 text-right">
                                                  {hasCalcs ? (
                                                    <span className="text-[13px] font-extrabold text-slate-500">
                                                      {sPlanTotal > 0 ? `${sPlanTotal.toLocaleString()}원` : '-'}
                                                    </span>
                                                  ) : (() => {
                                                    const { completed: compFormula, planned: planFormula } = extractSplitFormulaFromNote(s.note);
                                                    const planVal = evaluateExpression(planFormula);
                                                    
                                                    const inputId = `sub-plan-${sub.id}-${sIdx}`;
                                                    const isEditing = activeInputId === inputId;
                                                    
                                                    if (isEditing) {
                                                      return (
                                                        <input 
                                                          autoFocus
                                                          key={`input-sub-plan-${sub.id}-${sIdx}`}
                                                          type="text"
                                                          placeholder="0"
                                                          defaultValue={planFormula}
                                                          onInput={(e: React.FormEvent<HTMLInputElement>) => {
                                                            const val = e.currentTarget.value;
                                                            const cleanVal = val.replace(/[^0-9+\-*/\s,()]/g, '');
                                                            const formatted = cleanVal.replace(/,/g, '').replace(/\d+/g, (m) => parseInt(m, 10).toLocaleString());
                                                            e.currentTarget.value = formatted;
                                                          }}
                                                          onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                                                            const inputVal = e.target.value.trim();
                                                            const updatedSubItems = [...(sub.subItems || [])];
                                                            const currentItem = updatedSubItems[sIdx];
                                                            const { completed: existingCompleted } = extractSplitFormulaFromNote(currentItem.note);
                                                            const compBase = existingCompleted 
                                                              ? existingCompleted 
                                                              : (!currentItem.note && currentItem.virtualAdjustment ? currentItem.virtualAdjustment.toString() : '');
                                                            
                                                            const completedVal = evaluateExpression(compBase);
                                                            const plannedVal = evaluateExpression(inputVal);
                                                            const existingMemo = extractMemoFromNoteWithSplit(currentItem.note);
                                                            
                                                            const newNote = buildNoteWithSplitFormula(compBase, inputVal, existingMemo);
                                                            
                                                            updatedSubItems[sIdx] = {
                                                              ...currentItem,
                                                              virtualAdjustment: completedVal + plannedVal,
                                                              note: newNote
                                                            };
                                                            updateCategory(sub.id, { subItems: updatedSubItems });
                                                            setTimeout(() => setActiveInputId(null), 150);
                                                          }}
                                                          className="w-full min-w-[100px] bg-white border border-blue-500 rounded-lg px-2.5 py-1 text-xs font-black text-slate-800 text-right focus:ring-1 focus:ring-blue-500/20 outline-none"
                                                        />
                                                      );
                                                    }
                                                    
                                                    return (
                                                      <div 
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setTimeout(() => setActiveInputId(inputId), 50);
                                                        }}
                                                        className={`px-3 py-1.5 rounded-full text-right cursor-pointer text-xs font-black transition-colors min-w-[80px] inline-block ${
                                                          planVal > 0 
                                                            ? 'text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100/70' 
                                                            : 'text-slate-300 bg-slate-50/50 border border-dashed border-slate-200 hover:bg-slate-50'
                                                        }`}
                                                      >
                                                        {planVal > 0 ? planVal.toLocaleString() : '예정액'}
                                                      </div>
                                                    );
                                                  })()}
                                                </td>
                                                {/* 남은 차액 (원) */}
                                                <td className={`py-3 px-4 text-right font-extrabold text-[13px] ${
                                                  sRemainingDiff === 0 ? 'text-emerald-600' : 'text-rose-600'
                                                }`}>
                                                  {sRemainingDiff.toLocaleString()}원
                                                </td>
                                                {/* 비고 */}
                                                <td className="py-3 px-4">
                                                  {!hasCalcs ? (
                                                    <input 
                                                      type="text"
                                                      placeholder="비고 입력"
                                                      defaultValue={extractMemoFromNoteWithSplit(s.note)}
                                                      onBlur={(e: any) => {
                                                        const noteVal = e.target.value.trim();
                                                        const updatedSubItems = [...(sub.subItems || [])];
                                                        const currentItem = updatedSubItems[sIdx];
                                                        const { completed, planned } = extractSplitFormulaFromNote(currentItem.note);
                                                        
                                                        const finalNote = buildNoteWithSplitFormula(completed, planned, noteVal);
                                                        
                                                        updatedSubItems[sIdx] = {
                                                          ...currentItem,
                                                          note: finalNote
                                                        };
                                                        updateCategory(sub.id, { subItems: updatedSubItems });
                                                      }}
                                                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-600 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all"
                                                    />
                                                  ) : (
                                                    <span className="text-xs text-slate-400 font-semibold italic">하위 계산식 참고</span>
                                                  )}
                                                </td>
                                              </tr>

                                              {/* 2단계 세부 계산식 아이템 */}
                                              {hasCalcs && (s.calculations || []).map((c: any, cIdx: number) => {
                                                const { completed, planned } = extractSplitFormulaFromNote(c.note);
                                                const compBase = completed 
                                                  ? completed 
                                                  : (!completed && !planned && c.virtualAdjustment ? c.virtualAdjustment.toString() : '');
                                                const cCompVal = evaluateExpression(compBase);
                                                const cPlanVal = evaluateExpression(planned);
                                                
                                                return (
                                                  <tr key={`calc-${cIdx}`} className="bg-slate-50/5 hover:bg-slate-50/20 transition-colors">
                                                    <td className="py-2.5 px-4 pl-8 flex items-center gap-2 text-sm">
                                                      <FileText className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                                      {(() => {
                                                        const nameInputId = `calc-name-${sub.id}-${sIdx}-${cIdx}`;
                                                        const isEditingName = activeInputId === nameInputId;
                                                        
                                                        if (isEditingName) {
                                                          return (
                                                            <input
                                                              autoFocus
                                                              type="text"
                                                              defaultValue={c.name || c.calculation || ''}
                                                              onBlur={(e) => {
                                                                const newName = e.target.value.trim() || '세부 항목';
                                                                const updatedSubItems = [...(sub.subItems || [])];
                                                                const updatedCalcs = [...(updatedSubItems[sIdx].calculations || [])];
                                                                updatedCalcs[cIdx] = {
                                                                  ...updatedCalcs[cIdx],
                                                                  name: newName
                                                                };
                                                                updatedSubItems[sIdx] = {
                                                                  ...updatedSubItems[sIdx],
                                                                  calculations: updatedCalcs
                                                                };
                                                                updateCategory(sub.id, { subItems: updatedSubItems });
                                                                setTimeout(() => setActiveInputId(null), 150);
                                                              }}
                                                              className="bg-white border border-indigo-400 rounded px-1.5 py-0.5 text-sm font-bold text-slate-700 outline-none w-[150px]"
                                                            />
                                                          );
                                                        }
                                                        
                                                        return (
                                                          <span 
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              setTimeout(() => setActiveInputId(nameInputId), 50);
                                                            }}
                                                            className="text-slate-500 hover:text-indigo-600 hover:underline cursor-pointer font-bold"
                                                            title="이름 수정"
                                                          >
                                                            {c.name || c.calculation || '세부 항목'}
                                                          </span>
                                                        );
                                                      })()}
                                                      {c.isLocked && (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-50 text-red-500 border border-red-100">차단됨</span>
                                                      )}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-right text-xs font-bold text-slate-400">
                                                      -
                                                    </td>
                                                    <td className="py-2.5 px-4 text-center">
                                                      <button 
                                                        onClick={() => {
                                                          const updatedSubItems = [...sub.subItems];
                                                          const updatedCalcs = [...updatedSubItems[sIdx].calculations];
                                                          updatedCalcs[cIdx] = {
                                                            ...updatedCalcs[cIdx],
                                                            isLocked: !updatedCalcs[cIdx].isLocked
                                                          };
                                                          updatedSubItems[sIdx] = {
                                                            ...updatedSubItems[sIdx],
                                                            calculations: updatedCalcs
                                                          };
                                                          updateCategory(sub.id, { subItems: updatedSubItems });
                                                        }}
                                                        className="p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer inline-flex items-center justify-center"
                                                        title={c.isLocked ? "예산 통제 잠금 해제" : "예산 통제 잠금 (사용 불가)"}
                                                      >
                                                        {c.isLocked ? <Lock className="w-3.5 h-3.5 text-red-500" /> : <Unlock className="w-3.5 h-3.5 text-emerald-500" />}
                                                      </button>
                                                    </td>
                                                    {/* 2단계 완료액 */}
                                                    <td className="py-2.5 px-4 text-right">
                                                      {(() => {
                                                        const displayCompleted = completed || compBase;
                                                        const inputId = `calc-comp-${sub.id}-${sIdx}-${cIdx}`;
                                                        const isEditing = activeInputId === inputId;
                                                        
                                                        if (isEditing) {
                                                          return (
                                                            <input 
                                                              autoFocus
                                                              key={`input-calc-comp-${sub.id}-${sIdx}-${cIdx}`}
                                                              type="text"
                                                              placeholder="0"
                                                              defaultValue={displayCompleted}
                                                              onInput={(e: React.FormEvent<HTMLInputElement>) => {
                                                                const val = e.currentTarget.value;
                                                                const cleanVal = val.replace(/[^0-9+\-*/\s,()]/g, '');
                                                                const formatted = cleanVal.replace(/,/g, '').replace(/\d+/g, (m) => parseInt(m, 10).toLocaleString());
                                                                e.currentTarget.value = formatted;
                                                              }}
                                                              onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                                                                const inputVal = e.target.value.trim();
                                                                const updatedSubItems = [...(sub.subItems || [])];
                                                                const updatedCalcs = [...(updatedSubItems[sIdx].calculations || [])];
                                                                const currentCalc = updatedCalcs[cIdx];
                                                                
                                                                const completedVal = evaluateExpression(inputVal);
                                                                const autoPlannedVal = Math.max(0, currentCalc.amount - completedVal);
                                                                const existingMemo = extractMemoFromNoteWithSplit(currentCalc.note);
                                                                
                                                                const newNote = buildNoteWithSplitFormula(inputVal, autoPlannedVal.toString(), existingMemo);
                                                                
                                                                updatedCalcs[cIdx] = {
                                                                  ...currentCalc,
                                                                  virtualAdjustment: completedVal + autoPlannedVal,
                                                                  note: newNote
                                                                };
                                                                updatedSubItems[sIdx] = {
                                                                  ...updatedSubItems[sIdx],
                                                                  calculations: updatedCalcs,
                                                                  virtualAdjustment: updatedCalcs.reduce((sum: number, x: any) => sum + (x.virtualAdjustment || 0), 0)
                                                                };
                                                                updateCategory(sub.id, { subItems: updatedSubItems });
                                                                setTimeout(() => setActiveInputId(null), 150);
                                                              }}
                                                              className="w-full min-w-[100px] bg-white border border-blue-500 rounded-lg px-2 py-0.5 text-xs font-black text-slate-800 text-right focus:ring-1 focus:ring-blue-500/20 outline-none"
                                                            />
                                                          );
                                                        }
                                                        
                                                        return (
                                                          <div 
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              setTimeout(() => setActiveInputId(inputId), 50);
                                                            }}
                                                            className={`px-2.5 py-1 rounded-full text-right cursor-pointer text-xs font-extrabold transition-colors min-w-[70px] inline-block ${
                                                              cCompVal > 0 
                                                                ? 'text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100/70' 
                                                                : 'text-slate-300 bg-slate-50/50 border border-dashed border-slate-200 hover:bg-slate-50'
                                                            }`}
                                                          >
                                                            {cCompVal > 0 ? cCompVal.toLocaleString() : '완료액'}
                                                          </div>
                                                        );
                                                      })()}
                                                    </td>
                                                    {/* 2단계 예정액 */}
                                                    <td className="py-2.5 px-4 text-right">
                                                      {(() => {
                                                        const inputId = `calc-plan-${sub.id}-${sIdx}-${cIdx}`;
                                                        const isEditing = activeInputId === inputId;
                                                        
                                                        if (isEditing) {
                                                          return (
                                                            <input 
                                                              autoFocus
                                                              key={`input-calc-plan-${sub.id}-${sIdx}-${cIdx}`}
                                                              type="text"
                                                              placeholder="0"
                                                              defaultValue={planned}
                                                              onInput={(e: React.FormEvent<HTMLInputElement>) => {
                                                                const val = e.currentTarget.value;
                                                                const cleanVal = val.replace(/[^0-9+\-*/\s,()]/g, '');
                                                                const formatted = cleanVal.replace(/,/g, '').replace(/\d+/g, (m) => parseInt(m, 10).toLocaleString());
                                                                e.currentTarget.value = formatted;
                                                              }}
                                                              onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                                                                const inputVal = e.target.value.trim();
                                                                const updatedSubItems = [...(sub.subItems || [])];
                                                                const updatedCalcs = [...(updatedSubItems[sIdx].calculations || [])];
                                                                const currentCalc = updatedCalcs[cIdx];
                                                                const { completed: existingCompleted } = extractSplitFormulaFromNote(currentCalc.note);
                                                                const compBase = existingCompleted 
                                                                  ? existingCompleted 
                                                                  : (!currentCalc.note && currentCalc.virtualAdjustment ? currentCalc.virtualAdjustment.toString() : '');
                                                                
                                                                const completedVal = evaluateExpression(compBase);
                                                                const plannedVal = evaluateExpression(inputVal);
                                                                const existingMemo = extractMemoFromNoteWithSplit(currentCalc.note);
                                                                
                                                                const newNote = buildNoteWithSplitFormula(compBase, inputVal, existingMemo);
                                                                
                                                                updatedCalcs[cIdx] = {
                                                                  ...currentCalc,
                                                                  virtualAdjustment: completedVal + plannedVal,
                                                                  note: newNote
                                                                };
                                                                updatedSubItems[sIdx] = {
                                                                  ...updatedSubItems[sIdx],
                                                                  calculations: updatedCalcs,
                                                                  virtualAdjustment: updatedCalcs.reduce((sum: number, x: any) => sum + (x.virtualAdjustment || 0), 0)
                                                                };
                                                                updateCategory(sub.id, { subItems: updatedSubItems });
                                                                setTimeout(() => setActiveInputId(null), 150);
                                                              }}
                                                              className="w-full min-w-[100px] bg-white border border-blue-500 rounded-lg px-2 py-0.5 text-xs font-black text-slate-800 text-right focus:ring-1 focus:ring-blue-500/20 outline-none"
                                                            />
                                                          );
                                                        }
                                                        
                                                        return (
                                                          <div 
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              setTimeout(() => setActiveInputId(inputId), 50);
                                                            }}
                                                            className={`px-2.5 py-1 rounded-full text-right cursor-pointer text-xs font-extrabold transition-colors min-w-[70px] inline-block ${
                                                              cPlanVal > 0 
                                                                ? 'text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100/70' 
                                                                : 'text-slate-300 bg-slate-50/50 border border-dashed border-slate-200 hover:bg-slate-50'
                                                            }`}
                                                          >
                                                            {cPlanVal > 0 ? cPlanVal.toLocaleString() : '예정액'}
                                                          </div>
                                                        );
                                                      })()}
                                                    </td>
                                                    {/* 2단계 남은 차액 (원) */}
                                                    <td className="py-2.5 px-4 text-right text-[11px] font-bold text-slate-400">
                                                      -
                                                    </td>
                                                    {/* 2단계 비고 */}
                                                    <td className="py-2.5 px-4">
                                                      <div className="flex items-center gap-2">
                                                        <input 
                                                          type="text"
                                                          placeholder="비고 입력"
                                                          defaultValue={extractMemoFromNoteWithSplit(c.note)}
                                                          onBlur={(e: any) => {
                                                            const noteVal = e.target.value.trim();
                                                            const updatedSubItems = [...(sub.subItems || [])];
                                                            const updatedCalcs = [...(updatedSubItems[sIdx].calculations || [])];
                                                            const currentCalc = updatedCalcs[cIdx];
                                                            const { completed, planned } = extractSplitFormulaFromNote(currentCalc.note);
                                                            
                                                            const finalNote = buildNoteWithSplitFormula(completed, planned, noteVal);
                                                            
                                                            updatedCalcs[cIdx] = {
                                                              ...currentCalc,
                                                              note: finalNote
                                                            };
                                                            updatedSubItems[sIdx] = {
                                                              ...updatedSubItems[sIdx],
                                                              calculations: updatedCalcs,
                                                              virtualAdjustment: updatedCalcs.reduce((sum: number, x: any) => sum + (x.virtualAdjustment || 0), 0)
                                                            };
                                                            updateCategory(sub.id, { subItems: updatedSubItems });
                                                          }}
                                                          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-0.5 text-xs font-medium text-slate-500 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all"
                                                        />
                                                        <button
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!confirm('이 세부 항목을 삭제하시겠습니까?')) return;
                                                            const updatedSubItems = [...(sub.subItems || [])];
                                                            let updatedCalcs = [...(updatedSubItems[sIdx].calculations || [])];
                                                            
                                                            // 해당 세부 항목 제거
                                                            updatedCalcs = updatedCalcs.filter((_, i) => i !== cIdx);
                                                            
                                                            const hasRemainingCalcs = updatedCalcs.length > 0;
                                                            
                                                            updatedSubItems[sIdx] = {
                                                              ...updatedSubItems[sIdx],
                                                              calculations: hasRemainingCalcs ? updatedCalcs : undefined,
                                                              virtualAdjustment: hasRemainingCalcs ? updatedCalcs.reduce((sum: number, x: any) => sum + (x.virtualAdjustment || 0), 0) : 0,
                                                              note: hasRemainingCalcs ? updatedSubItems[sIdx].note : ''
                                                            };
                                                            
                                                            updateCategory(sub.id, { subItems: updatedSubItems });
                                                          }}
                                                          className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors cursor-pointer shrink-0"
                                                          title="세부 항목 삭제"
                                                        >
                                                          <X className="w-3.5 h-3.5" />
                                                        </button>
                                                      </div>
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </React.Fragment>
                                          );
                                        })}
                                        {(!sub.subItems || sub.subItems.length === 0) && (
                                          <tr>
                                            <td colSpan={7} className="py-4 text-center text-sm text-slate-400 font-medium">공식 예산서 세부 산출 내역이 비어 있습니다.</td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                {/* 3) 실제 집행 지출 내역 목록 (대조 보드) */}
                                <div className="flex flex-col gap-2.5">
                                  <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>실제 지출 집행 완료 내역</span>
                                  </div>

                                  <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full border-collapse text-left">
                                      <thead>
                                        <tr className="bg-slate-50/80 border-b border-slate-100 text-[12px] font-black text-slate-400 uppercase tracking-wider">
                                          <th className="py-2 px-4 w-[45px] text-center">확인</th>
                                          <th className="py-2 px-4">지출 일자</th>
                                          <th className="py-2 px-4">품의 목적 (건명)</th>
                                          <th className="py-2 px-4 text-right">집행 금액 (원)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="text-sm font-bold text-slate-600 divide-y divide-slate-100">
                                        {entries.filter(e => e.categoryId === sub.id && !e.isPlanned)
                                          .sort((a, b) => b.date.localeCompare(a.date))
                                          .map((e: any, eIdx: number) => (
                                          <tr key={eIdx} className={`transition-colors ${e.checked ? 'bg-slate-50/30 opacity-50 line-through text-slate-400' : 'hover:bg-slate-50/50'}`}>
                                            <td className="py-2 px-4 text-center">
                                              <button
                                                onClick={() => {
                                                  updateEntry(e.id, { checked: !e.checked });
                                                }}
                                                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all cursor-pointer mx-auto ${
                                                  e.checked 
                                                    ? 'bg-emerald-500 border-emerald-500 text-white' 
                                                    : 'border-slate-300 hover:border-slate-400 bg-white'
                                                }`}
                                                title={e.checked ? "대조 완료 해제" : "대조 완료 체크"}
                                              >
                                                {e.checked && (
                                                  <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 20 20">
                                                    <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                                                  </svg>
                                                )}
                                              </button>
                                            </td>
                                            <td className={`py-2 px-4 ${e.checked ? 'text-slate-400' : 'text-slate-500'}`}>{e.date}</td>
                                            <td className={`py-2 px-4 ${e.checked ? 'text-slate-400' : 'text-slate-700'}`}>{e.purpose}</td>
                                            <td className={`py-2 px-4 text-right font-extrabold ${e.checked ? 'text-slate-400' : 'text-slate-800'}`}>
                                              {e.amount.toLocaleString()}원
                                            </td>
                                          </tr>
                                        ))}
                                        {entries.filter(e => e.categoryId === sub.id && !e.isPlanned).length === 0 && (
                                          <tr>
                                            <td colSpan={4} className="py-3 text-center text-sm text-slate-400 font-medium">실제 집행된 지출 내역이 없습니다.</td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                              </div>
                            )}

                          </div>
                        );
                      })}
                      {subItems.length === 0 && (
                        <span className="text-sm text-slate-400 font-medium py-4 text-center">하위 통계목 내역이 존재하지 않습니다.</span>
                      )}
                    </div>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      </div>


      {/* Footer */}
      <div className="mt-8 pt-8 pb-4 border-t border-slate-200/60">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 text-[10px] font-black text-slate-400 tracking-widest uppercase">
          <span>© 2026 PORTFOLIO {appMode}. All rights reserved.</span>
          <span className="flex items-center gap-3">
            Precision Operations Intelligence
            <span className="text-slate-300">|</span> 
            <button onClick={onLogout} className={`text-${isHchps ? 'emerald' : 'blue'}-500 hover:text-${isHchps ? 'emerald' : 'blue'}-600 transition-colors`}>SECURE</button>
          </span>
        </div>
      </div>
      
    </div>
  );
}
