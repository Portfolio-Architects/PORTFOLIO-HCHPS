import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, Bar, ReferenceLine, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, ComposedChart } from 'recharts';
import { Task, BudgetCategory, BudgetEntry } from '@/types';
import { usePortfolioAnalytics } from '@/hooks/usePortfolioAnalytics';
import { Expand, Shrink, ChevronRight, LayoutDashboard, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

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
    velocityInsights,
    remainingTargetAmount,
    recommendedMonthlySpendForTarget
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
            
            return (
              <div key={idx} className="flex flex-col bg-white rounded-[1.5rem] shadow-sm overflow-hidden transition-all duration-300 border border-transparent hover:border-slate-100">
                <div 
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-6 cursor-pointer hover:bg-slate-50/30 transition-colors gap-4 sm:gap-0"
                  onClick={() => setExpandedCategory(isExpanded ? null : item.name)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: themeColors[idx % themeColors.length] || '#cbd5e1' }} />
                    <span className="text-lg font-black text-slate-800 tracking-tight">{item.name}</span>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                    <div className="flex flex-col sm:items-end">
                      <span className="text-xl font-black text-slate-900">{item.total.toLocaleString()} <span className="text-xs text-slate-400">KRW</span></span>
                    </div>
                    <span className={`text-sm font-black ${isHchps ? 'text-emerald-500' : 'text-blue-500'} w-12 text-right`}>{item.rate.toFixed(1)}%</span>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />}
                  </div>
                </div>
                
                {/* Lightweight Body */}
                {isExpanded && (
                  <div className="px-6 pb-6 pt-2 border-t border-slate-50 mx-6 animate-in fade-in duration-200">
                    <div className="flex flex-col gap-2 mb-6 mt-4">
                      {subItems.map((sub: any, sIdx: number) => (
                        <div key={sIdx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors gap-2 sm:gap-0 bg-slate-50/30">
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                            <span className="font-bold text-slate-700">{sub.name || sub.description}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black bg-white border border-slate-200 ${isHchps ? 'text-emerald-500' : 'text-blue-500'} uppercase tracking-wider`}>VIEW</span>
                          </div>
                          <span className="font-black text-slate-800">{sub.amount ? sub.amount.toLocaleString() : sub.totalBudget?.toLocaleString() || 0} <span className="text-[10px] text-slate-400">KRW</span></span>
                        </div>
                      ))}
                      {subItems.length === 0 && <span className="text-sm text-slate-400 font-medium py-4 text-center">하위 내역이 존재하지 않습니다.</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Budget Velocity Insights Panel */}
      <div className="mt-6 bg-white rounded-[2rem] p-8 sm:p-10 shadow-sm">
        <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3 mb-6">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Budget Velocity Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {velocityInsights.length > 0 ? velocityInsights.map((insight, idx) => (
            <div key={idx} className={`flex flex-col justify-between gap-4 p-6 bg-slate-50/50 hover:bg-slate-50 hover:shadow-sm hover:${isHchps ? 'border-emerald-100' : 'border-blue-100'} transition-all rounded-[1.5rem] border border-slate-100`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${insight.action === 'INCREASE' ? 'bg-red-100 text-red-600' : (isHchps ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600')}`}>
                  <span className="text-lg font-black">{insight.action === 'INCREASE' ? '↑' : '↓'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[14px] font-black text-slate-800 leading-tight mb-1">{insight.name}</span>
                  <span className="text-[12px] font-semibold text-slate-500 leading-relaxed">{insight.insightText}</span>
                </div>
              </div>
              <div className="flex flex-col items-end pt-4 border-t border-slate-100 mt-2">
                <span className={`text-lg font-black ${insight.action === 'INCREASE' ? 'text-red-500' : (isHchps ? 'text-emerald-500' : 'text-blue-500')}`}>
                  {insight.diffAmount > 0 ? '+' : ''}{insight.diffAmount.toLocaleString()} <span className="text-xs">KRW</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{insight.action} RECOMMENDATION</span>
              </div>
            </div>
          )) : (
            <div className="col-span-full text-center py-10 text-sm font-bold text-slate-400">
              특이 소진 항목이 발견되지 않았습니다.
            </div>
          )}
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
