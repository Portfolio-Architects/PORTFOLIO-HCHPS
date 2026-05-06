import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import { Task, BudgetCategory, BudgetEntry } from '@/types';
import { Expand, Shrink, ChevronRight, LayoutDashboard } from 'lucide-react';
import { format } from 'date-fns';

interface DashboardProps {
  tasks: Task[];
  budgetCategories: BudgetCategory[];
  budgetEntries: BudgetEntry[];
  onLogout?: () => void;
}

const COLORS = ['#3B82F6', '#1E3A8A', '#93C5FD', '#1D4ED8', '#60A5FA', '#DBEAFE'];

export function PortfolioDashboardView({ tasks, budgetCategories, budgetEntries, onLogout }: DashboardProps) {
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
      return projectsData.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 4);
    } else {
      const cats = budgetCategories.filter(c => c.detailedProject === selectedProject);
      return cats.map(cat => {
        const executed = budgetEntries.filter(e => e.categoryId === cat.id && !e.isPlanned).reduce((s, e) => s + e.amount, 0);
        const rate = cat.totalBudget > 0 ? (executed / cat.totalBudget) * 100 : 0;
        return { name: cat.name, total: cat.totalBudget, executed, rate };
      }).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 4);
    }
  }, [budgetCategories, budgetEntries, selectedProject, detailedProjects]);

  // 4. Growth Trend (Budget Execution Trend by Month)
  const trendData = useMemo(() => {
    // Generate mock trend for visual similarity to the screenshot using deterministic data
    const months = ['2025.01', '2025.02', '2025.03', '2025.04', '2025.05', '2025.06'];
    const mockIncrements = [12000000, 35000000, 18000000, 42000000, 25000000, 50000000];
    let cumulative = 0;
    return months.map((m, i) => {
      cumulative += mockIncrements[i];
      return { name: m, amount: cumulative, growth: totalBudget > 0 ? (cumulative / totalBudget) * 100 : 0 };
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
        {/* Left Panel: Asset Allocation & Mini Cards */}
        <div className="xl:col-span-6 bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100/60 h-full flex flex-col min-h-[500px]">
          <div className="flex justify-between items-center z-10 mb-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-3">
              예산 현황 (Budget Allocation)
            </h2>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold uppercase rounded-lg px-3 py-1.5 outline-none focus:border-blue-500 transition-all cursor-pointer shadow-sm"
            >
              <option value="ALL">세부사업명 전체</option>
              {detailedProjects.map(dp => (
                <option key={dp} value={dp}>{dp}</option>
              ))}
            </select>
          </div>
          
          <div className="flex-1 w-full flex flex-col sm:flex-row items-center justify-between mb-8 gap-8 sm:gap-4">
            <div className="flex-none w-[240px] h-[240px] relative shrink-0 mx-auto sm:mx-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={90}
                    outerRadius={120}
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
                  <span className="text-[12px] font-extrabold text-slate-800 uppercase tracking-widest mb-1">TOTAL BUDGET</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[18px] font-black text-slate-900 leading-none tracking-tight">{totalBudget.toLocaleString()}</span>
                    <span className="text-[11px] font-bold text-slate-400 leading-none">KRW</span>
                  </div>
              </div>
            </div>

            <div className="flex-1 w-full sm:pl-4 flex flex-col gap-5 justify-center min-w-0">
              {breakdownData.map((item, idx) => (
                <div 
                  key={idx} 
                  className="group flex items-center w-full p-2 -ml-2 rounded-xl hover:bg-slate-50 transition-colors cursor-default"
                >
                  <div className="w-3.5 h-3.5 rounded-full shrink-0 mr-3 shadow-sm" style={{ backgroundColor: pieData[idx]?.color || '#cbd5e1' }} />
                  <span className="text-[14px] font-bold text-slate-600 tracking-wide truncate max-w-[60%]" title={item.name}>
                    {item.name}
                  </span>
                  <div className="flex-1 min-w-[16px] border-b-[2px] border-dotted border-slate-200/80 mx-3 mt-1"></div>
                  <div className="flex flex-col items-end shrink-0 transition-transform group-hover:-translate-x-1 duration-300">
                    <span className="text-[14px] font-black text-slate-800 leading-none">{item.total.toLocaleString()}</span>
                    <span className="text-[9px] font-bold text-slate-400 mt-0.5">KRW</span>
                  </div>
                </div>
              ))}
              {breakdownData.length === 0 && (
                <span className="text-xs font-bold text-slate-400 text-center">세부 항목이 없습니다.</span>
              )}
            </div>
          </div>

          {/* KPI Mini Cards Grid */}
          <div className="grid grid-cols-2 gap-3 mt-auto">
            {/* 1. Execution Rate */}
            <div className="bg-slate-50/80 rounded-[1.25rem] p-5 flex items-center justify-between border border-slate-100">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">집행률 (EXECUTION)</span>
                <span className="text-xl font-bold text-blue-600 leading-none">{executionRate.toFixed(1)}%</span>
              </div>
              <div 
                className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center shadow-sm"
                style={{ background: `conic-gradient(#3b82f6 ${executionRate}%, #e2e8f0 0)` }}
              >
                <div className="w-[14px] h-[14px] bg-[#f8fafc] rounded-full" />
              </div>
            </div>

            {/* 2. Remaining Budget */}
            <div className="bg-slate-50/80 rounded-[1.25rem] p-5 flex items-center justify-between border border-slate-100">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">잔여 예산 (REMAINING)</span>
                <span className="text-xl font-bold text-slate-900 leading-none">{remainingBudget.toLocaleString()}</span>
              </div>
              <div 
                className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center shadow-sm"
                style={{ background: `conic-gradient(#94a3b8 ${100 - executionRate}%, #e2e8f0 0)` }}
              >
                <div className="w-[14px] h-[14px] bg-[#f8fafc] rounded-full" />
              </div>
            </div>

            {/* 3. Today's Tasks */}
            <div className="bg-slate-50/80 rounded-[1.25rem] p-5 flex items-center justify-between border border-slate-100">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">오늘의 할 일</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-slate-900 leading-none">{todayTasks.length}</span>
                  <span className="text-[11px] font-bold text-slate-400">건</span>
                </div>
              </div>
              <div className="w-5 h-5 rounded-full border-[2.5px] border-slate-200 border-t-slate-400 animate-spin-slow shrink-0" />
            </div>

            {/* 4. Priority Task */}
            <div className="bg-slate-50/80 rounded-[1.25rem] p-5 flex items-center justify-between border border-slate-100">
              <div className="flex flex-col gap-1.5 w-full">
                <div className="flex justify-between items-center w-full">
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">우선순위 업무</span>
                  <span className="text-[10px] font-bold bg-white border border-slate-200 text-slate-400 px-1.5 py-[2px] rounded uppercase">HIGH</span>
                </div>
                <span className="text-sm font-bold text-slate-900 truncate block leading-none">
                  {activeTasks.find(t => t.priority === 'high')?.title || '없음'}
                </span>
              </div>
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



        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-slate-200">
          <div className="flex items-center justify-between px-4 text-xs font-bold text-slate-400 tracking-wider uppercase">
            <span>© 2026 HCHPS. All rights reserved.</span>
            <span className="flex items-center gap-2">
              HCHPS Work & Wealth Architecture 
              <span className="text-slate-300">|</span> 
              <button onClick={onLogout} className="text-blue-500 hover:text-blue-600 hover:underline cursor-pointer transition-all">SECURE</button>
            </span>
          </div>
        </div>
      
    </div>
  );
}
