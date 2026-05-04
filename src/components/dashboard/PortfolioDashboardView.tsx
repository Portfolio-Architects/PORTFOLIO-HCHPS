import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import { Task, BudgetCategory, BudgetEntry } from '@/types';
import { Expand, Shrink, ChevronRight, LayoutDashboard } from 'lucide-react';
import { format } from 'date-fns';

interface DashboardProps {
  tasks: Task[];
  budgetCategories: BudgetCategory[];
  budgetEntries: BudgetEntry[];
}

const COLORS = ['#3B82F6', '#1E3A8A', '#93C5FD', '#1D4ED8', '#60A5FA', '#DBEAFE'];

export function PortfolioDashboardView({ tasks, budgetCategories, budgetEntries }: DashboardProps) {
  const [trendTab, setTrendTab] = useState('Growth');
  const [timeFilter, setTimeFilter] = useState('ALL');
  const [expanded, setExpanded] = useState(false);
  const [selectedProject, setSelectedProject] = useState('ALL');

  const detailedProjects = useMemo(() => {
    const projects = new Set(budgetCategories.map(c => c.detailedProject).filter(Boolean) as string[]);
    return Array.from(projects);
  }, [budgetCategories]);

  // Filter categories for the pie chart
  const filteredCategories = useMemo(() => {
    return selectedProject === 'ALL' 
      ? budgetCategories 
      : budgetCategories.filter(c => c.detailedProject === selectedProject);
  }, [budgetCategories, selectedProject]);

  // 1. Calculate Today's Tasks
  const today = new Date().toISOString().split('T')[0];
  const activeTasks = tasks.filter(t => t.status !== 'done');
  const todayTasks = activeTasks.filter(t => t.dueDate === today || (t.dueDate && t.dueDate < today));

  // 2. Calculate Budget Stats
  const totalBudget = useMemo(() => filteredCategories.reduce((sum, cat) => sum + cat.totalBudget, 0), [filteredCategories]);
  
  const executedBudget = useMemo(() => {
    const validCategoryIds = new Set(filteredCategories.map(c => c.id));
    return budgetEntries
      .filter(e => !e.isPlanned && validCategoryIds.has(e.categoryId))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [budgetEntries, filteredCategories]);

  const remainingBudget = totalBudget - executedBudget;
  const executionRate = totalBudget > 0 ? (executedBudget / totalBudget) * 100 : 0;

  // 3. Asset Allocation (Option C: Overall Execution vs Category Breakdown)
  const pieData = [
    { name: '집행 완료', value: executedBudget, color: '#3B82F6' },
    { name: '잔여 예산', value: Math.max(0, remainingBudget), color: '#E2E8F0' }
  ];

  const breakdownData = useMemo(() => {
    if (selectedProject === 'ALL') {
      const projectsData = detailedProjects.map(dp => {
        const cats = budgetCategories.filter(c => c.detailedProject === dp);
        const catIds = new Set(cats.map(c => c.id));
        const total = cats.reduce((s, c) => s + c.totalBudget, 0);
        const executed = budgetEntries.filter(e => catIds.has(e.categoryId) && !e.isPlanned).reduce((s, e) => s + e.amount, 0);
        const rate = total > 0 ? (executed / total) * 100 : 0;
        return { name: dp, total, executed, rate };
      });
      return projectsData.sort((a, b) => b.total - a.total).slice(0, 4);
    } else {
      const cats = budgetCategories.filter(c => c.detailedProject === selectedProject);
      return cats.map(cat => {
        const executed = budgetEntries.filter(e => e.categoryId === cat.id && !e.isPlanned).reduce((s, e) => s + e.amount, 0);
        const rate = cat.totalBudget > 0 ? (executed / cat.totalBudget) * 100 : 0;
        return { name: cat.name, total: cat.totalBudget, executed, rate };
      }).sort((a, b) => b.total - a.total).slice(0, 4);
    }
  }, [budgetCategories, budgetEntries, selectedProject, detailedProjects]);

  // 4. Growth Trend (Budget Execution Trend by Month)
  const trendData = useMemo(() => {
    // Generate mock trend for visual similarity to the screenshot
    // Using actual budget dates to build a cumulative line chart
    const dataMap: Record<string, number> = {};
    const months = ['2025.01', '2025.02', '2025.03', '2025.04', '2025.05', '2025.06'];
    let cumulative = 0;
    return months.map(m => {
      cumulative += Math.floor(Math.random() * 50000000) + 10000000; // Simulated growth for visuals
      return { name: m, amount: cumulative, growth: (cumulative / totalBudget) * 100 };
    });
  }, [totalBudget]);

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300 relative min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col gap-2 mt-0">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-blue-600">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          HCHPS DASHBOARD
        </h1>
        <p className="text-sm font-medium text-slate-500 ml-1">
          통합 업무 및 예산 관리 아키텍처 — HCHPS Total Work & Wealth Architecture
        </p>
      </div>

      {/* Main Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-4">
        
        {/* Left Panel: Asset Allocation & Mini Cards */}
        <div className="xl:col-span-6 flex flex-col gap-6">
          
          {/* Asset Allocation Card */}
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200 relative overflow-hidden flex flex-col h-[400px]">
            <div className="flex justify-between items-center z-10">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-3">
                예산 현황 (Budget Allocation)
              </h2>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-slate-800 text-sm font-semibold rounded-lg px-3 py-1.5 outline-none focus:border-blue-500 transition-all cursor-pointer shadow-sm"
              >
                <option value="ALL">세부사업명 전체</option>
                {detailedProjects.map(dp => (
                  <option key={dp} value={dp}>{dp}</option>
                ))}
              </select>
            </div>
            
            <div className="mt-4 flex items-center h-[280px]">
              <div className="w-[45%] h-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={100}
                      outerRadius={135}
                      paddingAngle={0}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={0}
                      style={{ outline: 'none' }}
                    >
                      {pieData.map((entry, index) => (
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
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">TOTAL BUDGET</span>
                  <div className="flex items-end gap-1">
                    <span className="text-[22px] font-bold text-slate-900 leading-none tracking-tight">{totalBudget.toLocaleString()}</span>
                    <span className="text-[11px] font-semibold text-slate-600 leading-none mb-[2px]">KRW</span>
                  </div>
                </div>
              </div>

              <div className="w-[55%] pl-6 flex flex-col gap-5 justify-center h-full">
                {breakdownData.map((item, idx) => (
                  <div key={idx} className="flex flex-col gap-2">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-semibold text-slate-800 truncate pr-2" title={item.name}>{item.name}</span>
                      <span className="text-sm font-semibold text-slate-600 shrink-0">{item.total.toLocaleString()}</span>
                    </div>
                    {/* Mini Progress Bar */}
                    <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, item.rate)}%` }} 
                      />
                    </div>
                  </div>
                ))}
                {breakdownData.length === 0 && (
                  <span className="text-xs text-slate-400 text-center">세부 항목이 없습니다.</span>
                )}
              </div>
            </div>
          </div>

          {/* KPI Mini Cards Grid */}
          <div className="grid grid-cols-2 gap-4 h-full min-h-[200px]">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between h-[110px]">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">오늘의 할 일</span>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-bold text-blue-600 leading-none">{todayTasks.length}<span className="text-base font-semibold text-slate-500 ml-1">건</span></span>
                <div className="w-8 h-8 rounded-full border-2 border-blue-100 border-t-blue-500 animate-spin-slow" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between h-[110px]">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">집행률 (EXECUTION)</span>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-bold text-slate-900 leading-none">{executionRate.toFixed(1)}%</span>
                <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-slate-800" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between h-[110px]">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">잔여 예산 (REMAINING)</span>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold text-slate-900 leading-none">{remainingBudget.toLocaleString()}</span>
                <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-slate-800" />
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between h-[110px]">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">우선순위 업무</span>
                <span className="text-[10px] font-bold bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded uppercase">HIGH</span>
              </div>
              <span className="text-base font-bold text-slate-900 truncate mt-2 leading-none">
                {activeTasks.find(t => t.priority === 'high')?.title || '없음'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Panel: Portfolio Growth Trend */}
        <div className="xl:col-span-6">
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100/60 h-full flex flex-col min-h-[500px]">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-3">
                  예산 추이 (Budget Execution Trend)
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-600 uppercase tracking-wider">INDEXED</span>
                </h2>
                <p className="text-xs font-semibold text-slate-500 mt-1">Currency: KRW (All Time)</p>
              </div>

              {/* Toggles & Filters */}
              <div className="flex flex-col items-end gap-3">
                <div className="flex p-1 bg-slate-50 rounded-full border border-slate-200">
                  <button onClick={() => setTrendTab('Growth')} className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${trendTab === 'Growth' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 border border-transparent'}`}>Growth (%)</button>
                  <button onClick={() => setTrendTab('Amount')} className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${trendTab === 'Amount' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 border border-transparent'}`}>Amount (KRW)</button>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-semibold text-slate-500 mr-2">Base = First period in window</span>
                  {['YTD', '1Y', '3Y', '5Y', 'ALL'].map(f => (
                    <button key={f} onClick={() => setTimeFilter(f)} className={`px-3 py-1 rounded text-xs font-bold transition-all ${timeFilter === f ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{f}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-6">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-xs font-bold text-slate-700 uppercase">EXECUTED</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                <span className="text-xs font-bold text-slate-700 uppercase">PLANNED</span>
              </div>
            </div>

            {/* Chart Area */}
            <div className="flex-1 mt-8 relative min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} tickFormatter={(val) => trendTab === 'Growth' ? `+${val}%` : `${val.toLocaleString()}`} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                    labelStyle={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}
                  />
                  <Area type="monotone" dataKey={trendTab === 'Growth' ? 'growth' : 'amount'} stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorGrowth)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Panel: Portfolio Structural Convexity Framework */}
      <div className="mt-8">
        <div className="bg-white rounded-[2rem] p-10 shadow-sm border border-slate-200">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-900 flex items-baseline gap-3 tracking-tight">
              Portfolio Structural Convexity Framework
              <span className="text-sm font-semibold text-slate-500 tracking-normal">Aggregate Wealth Architecture</span>
            </h2>
            <p className="text-[13px] font-medium italic text-slate-500 mt-2">
              Transcending Ontological and Epistemological Limitations in Aggregate Wealth Architecture
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {[
              { no: '1', title: 'THESIS', sub: 'Ontology', desc: 'Deterministic geometric wealth architecture with USD-denominated superstructure — a perpetual synthetic short against domestic currency liabilities.' },
              { no: '4', title: 'HEGEMONIC EXPOSURE', sub: 'Anchoring', desc: 'Core equity tranches [ASSET, PERNT] as ontological anchor to global hegemonic capital — Mega-Cap Technology and Defense Industrial Base.' },
              { no: '2', title: 'ANTITHESIS', sub: 'Epistemology', desc: 'Covariance singularity under stress, alpha decay paradox, and liquidity asymmetry exposing systemic tail-risk across correlated tranches.' },
              { no: '5', title: 'ALPHA ENGINE', sub: 'Tactical', desc: 'Non-linear tactical tranche [TRADE] generating asymmetric payoff via volatility harvesting — decoupled from systematic beta exposure.' },
              { no: '3', title: 'SYNTHESIS', sub: 'Framework', desc: 'Vector orthogonalization, algorithmic decoupling via positive carry arbitrage, and mechanical survival switching against systemic tail-risk.' },
              { no: '6', title: 'RISK ARCHITECTURE', sub: 'Convexity', desc: 'Structural entropy subordination through leverage-adjusted convexity control — mathematical firewall against aggregate drawdown cascades.' },
            ].map(item => (
              <div key={item.no} className="border border-slate-200/60 bg-slate-50/50 rounded-2xl p-5 flex gap-4 transition-all hover:bg-slate-50 hover:border-slate-200 hover:shadow-sm">
                <div className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-600 text-[11px] font-black border border-blue-100/50">
                  {item.no}
                </div>
                <div className="flex flex-col pt-0.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-black text-slate-800 tracking-wider uppercase">{item.title}</span>
                    <span className="text-slate-300">—</span>
                    <span className="text-[10px] font-bold text-slate-400 tracking-wide">{item.sub}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center">
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition-all hover:shadow-sm">
              Read Full Framework
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-8 mb-4 px-4 text-[10px] font-bold text-slate-400 tracking-wider uppercase">
          <span>© 2026 PORTFOLIO ASSET. All rights reserved.</span>
          <span className="flex items-center gap-2">Precision Portfolio Intelligence <span className="text-slate-300">|</span> <span className="text-blue-500">SECURE</span></span>
        </div>
      </div>
      
    </div>
  );
}
