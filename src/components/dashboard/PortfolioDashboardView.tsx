import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import { Task, BudgetCategory, BudgetEntry } from '@/types';
import { Expand, Shrink, ChevronRight, LayoutDashboard, ChevronDown, ChevronUp, Star } from 'lucide-react';
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
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

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
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300 relative min-h-screen font-sans">
      
      {/* Top Pill Navigation */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-blue-100 shrink-0">
          <Star className="w-4 h-4 text-blue-500 fill-blue-500" />
          <span className="text-sm font-bold text-slate-800">Portfolio</span>
        </div>
        {['Correlation', 'Ontology', 'Overview'].map(tab => (
          <div key={tab} className="flex items-center px-4 py-2 rounded-full shrink-0 cursor-pointer hover:bg-slate-200/50 transition-colors">
            <span className="text-sm font-semibold text-slate-500">{tab}</span>
          </div>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200 shrink-0 cursor-pointer hover:bg-slate-50 transition-colors">
          <span className="text-sm font-bold text-slate-700">Report</span>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-3 mt-4 mb-2">
        <h1 className="text-4xl sm:text-[40px] font-black tracking-tight text-slate-900 flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-[1rem] shadow-sm border border-slate-100 flex items-center justify-center text-blue-500">
            <Star className="w-7 h-7 fill-blue-500" />
          </div>
          PORTFOLIO ASSET
        </h1>
        <div className="flex items-center gap-3 ml-2">
          <div className="w-1 h-5 bg-blue-600 rounded-full" />
          <p className="text-[13px] font-semibold text-slate-500 tracking-wide">
            Semantic Ontology-Driven Total Wealth Architecture — converging macro regime, factor convexity, and tactical alpha into a unified risk topology
          </p>
        </div>
      </div>

      {/* Main Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-4">
        
        {/* Left Panel: Asset Allocation & Mini Cards */}
        <div className="xl:col-span-6 bg-white rounded-[2rem] p-8 shadow-sm flex flex-col min-h-[500px]">
          <div className="flex justify-between items-center z-10 mb-8">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
              Asset Allocation
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-50 text-blue-600 uppercase tracking-widest">LIVE</span>
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
            <div className="flex-none w-[260px] h-[260px] relative shrink-0 mx-auto sm:mx-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={90}
                    outerRadius={125}
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
                <span className="text-[12px] font-extrabold text-slate-800 uppercase tracking-widest mb-1">GROSS ASSET</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-[18px] font-black text-slate-900 leading-none tracking-tight">{totalBudget.toLocaleString()}</span>
                  <span className="text-[11px] font-bold text-slate-400 leading-none">KRW</span>
                </div>
              </div>
            </div>

            <div className="flex-1 w-full max-w-[380px] sm:pl-6 flex flex-col gap-6 justify-center min-w-0">
              {breakdownData.map((item, idx) => (
                <div 
                  key={idx} 
                  className="group flex items-center w-full p-2 -ml-2 rounded-xl hover:bg-slate-50 transition-colors cursor-default"
                >
                  <div className="w-4 h-4 rounded-full shrink-0 mr-3 shadow-sm" style={{ backgroundColor: pieData[idx]?.color || '#cbd5e1' }} />
                  <span className="text-[14px] font-black text-slate-700 uppercase tracking-wider truncate max-w-[65%]" title={item.name}>
                    {item.name}
                  </span>
                  <div className="flex-1 min-w-[12px] border-b-[2px] border-dotted border-slate-200 mx-3 mt-1.5 opacity-80"></div>
                  <div className="flex flex-col items-end shrink-0 transition-transform group-hover:-translate-x-1 duration-300">
                    <span className="text-[16px] font-black text-slate-800 leading-none">{item.total.toLocaleString()}</span>
                  </div>
                </div>
              ))}
              {breakdownData.length === 0 && (
                <span className="text-xs font-bold text-slate-400 text-center">세부 항목이 없습니다.</span>
              )}
            </div>
          </div>

          {/* KPI Mini Cards Grid */}
          <div className="grid grid-cols-2 gap-4 mt-auto pt-4">
            {/* 1. Execution Rate */}
            <div className="bg-[#f1f5f9] rounded-[1.5rem] p-5 flex flex-col justify-between relative overflow-hidden group">
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest relative z-10 mb-6">EQUITY EXPOSURE</span>
              <span className="text-2xl font-black text-blue-600 leading-none relative z-10">{executionRate.toFixed(1)}%</span>
              <div 
                className="absolute right-5 bottom-5 w-8 h-8 rounded-full shrink-0 flex items-center justify-center shadow-sm opacity-80 group-hover:scale-110 transition-transform"
                style={{ background: `conic-gradient(#3b82f6 ${executionRate}%, #e2e8f0 0)` }}
              >
                <div className="w-[20px] h-[20px] bg-[#f1f5f9] rounded-full" />
              </div>
            </div>

            {/* 2. Remaining Budget */}
            <div className="bg-[#f1f5f9] rounded-[1.5rem] p-5 flex flex-col justify-between relative overflow-hidden group">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest relative z-10 mb-6">LIQUIDITY FIREWALL</span>
              <span className="text-2xl font-black text-slate-900 leading-none relative z-10">{(100 - executionRate).toFixed(1)}%</span>
              <div 
                className="absolute right-5 bottom-5 w-8 h-8 rounded-full shrink-0 flex items-center justify-center shadow-sm opacity-80 group-hover:scale-110 transition-transform"
                style={{ background: `conic-gradient(#94a3b8 ${100 - executionRate}%, #e2e8f0 0)` }}
              >
                <div className="w-[20px] h-[20px] bg-[#f1f5f9] rounded-full" />
              </div>
            </div>

            {/* 3. Today's Tasks */}
            <div className="bg-[#f1f5f9] rounded-[1.5rem] p-5 flex flex-col justify-between relative overflow-hidden group">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest relative z-10 mb-6">LEVERAGE (DEBT)</span>
              <span className="text-2xl font-black text-slate-900 leading-none relative z-10">{(executionRate * 0.8).toFixed(1)}%</span>
              <div className="absolute right-5 bottom-5 w-7 h-7 rounded-full border-[3.5px] border-slate-200 border-t-slate-400 animate-spin-slow shrink-0 opacity-80 group-hover:border-t-slate-600 transition-colors" />
            </div>

            {/* 4. Priority Task */}
            <div className="bg-[#f1f5f9] rounded-[1.5rem] p-5 flex flex-col justify-between relative overflow-hidden group">
              <div className="flex justify-between items-start w-full relative z-10 mb-6">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">HEAVY ASSET</span>
                <span className="text-[9px] font-bold bg-white border border-slate-200 text-slate-400 px-1.5 py-[2px] rounded uppercase">DOM</span>
              </div>
              <span className="text-lg font-black text-slate-900 truncate block leading-none relative z-10">
                {activeTasks.find(t => t.priority === 'high')?.title || 'Real Estate'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Panel: Portfolio Growth Trend */}
        <div className="xl:col-span-6">
          <div className="bg-white rounded-[2rem] p-8 shadow-sm h-full flex flex-col min-h-[500px]">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                  Portfolio Growth Trend
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-50 text-blue-600 uppercase tracking-widest">INDEXED</span>
                </h2>
                <p className="text-xs font-semibold text-slate-400 mt-1">Currency: KRW (All Time)</p>
              </div>

              {/* Toggles & Filters */}
              <div className="flex flex-col items-end gap-3">
                <div className="flex p-1 bg-slate-50 rounded-full border border-slate-100">
                  <button onClick={() => setTrendTab('Growth')} className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase transition-all ${trendTab === 'Growth' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' : 'text-slate-400 hover:text-slate-600 border border-transparent'}`}>Growth (%)</button>
                  <button onClick={() => setTrendTab('Amount')} className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase transition-all ${trendTab === 'Amount' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' : 'text-slate-400 hover:text-slate-600 border border-transparent'}`}>Amount (KRW)</button>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400 mr-2 uppercase tracking-wide">Base = First period in window</span>
                  {['YTD', '1Y', '3Y', '5Y', 'ALL'].map(f => (
                    <button key={f} onClick={() => setTimeFilter(f)} className={`px-3 py-1 rounded-md text-[11px] font-black transition-all ${timeFilter === f ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}>{f}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 mt-6 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-100 bg-white">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">EQUITY</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-100 bg-white">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">REAL ESTATE</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-100 bg-white">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">CASH & STI</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-100 bg-white">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">PENSION</span>
              </div>
            </div>

            {/* Chart Area */}
            <div className="flex-1 mt-8 relative min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} tickFormatter={(val) => trendTab === 'Growth' ? `+${val}%` : `${val.toLocaleString()}`} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)', backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                    itemStyle={{ fontSize: '12px', fontWeight: '900' }}
                    labelStyle={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey={trendTab === 'Growth' ? 'growth' : 'amount'} stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorGrowth)" activeDot={{ r: 5, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Lightweight Accordion: Detailed Asset Portfolio */}
      <div className="mt-8 flex flex-col gap-4">
        <h3 className="text-xl font-black text-slate-900 flex items-center gap-3 mb-2 ml-2">
          <div className="w-1 h-5 bg-blue-600 rounded-full" />
          Detailed Asset Portfolio
        </h3>
        
        <div className="flex flex-col gap-3">
          {breakdownData.map((item, idx) => {
            const isExpanded = expandedCategory === item.name;
            const subItems = selectedProject === 'ALL' 
              ? budgetCategories.filter(c => c.detailedProject === item.name)
              : budgetEntries.filter(e => e.categoryId === filteredCategories.find(c => c.name === item.name)?.id && !e.isPlanned);
            
            return (
              <div key={idx} className="flex flex-col bg-white rounded-[1.5rem] shadow-sm overflow-hidden transition-all duration-300 border border-transparent hover:border-slate-100">
                <div 
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-6 cursor-pointer hover:bg-slate-50/30 transition-colors gap-4 sm:gap-0"
                  onClick={() => setExpandedCategory(isExpanded ? null : item.name)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: pieData[idx]?.color || '#cbd5e1' }} />
                    <span className="text-lg font-black text-slate-800 uppercase tracking-widest">{item.name}</span>
                    {idx === 0 && <span className="px-2 py-0.5 rounded text-[9px] font-black bg-blue-50 text-blue-500 uppercase tracking-widest">CORE ANCHOR</span>}
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                    <div className="flex flex-col sm:items-end">
                      <span className="text-xl font-black text-slate-900">{item.total.toLocaleString()} <span className="text-xs text-slate-400">KRW</span></span>
                    </div>
                    <span className="text-sm font-black text-blue-500 w-12 text-right">{item.rate.toFixed(1)}%</span>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />}
                  </div>
                </div>
                
                {/* Lightweight Body (Zero extra dependencies) */}
                {isExpanded && (
                  <div className="px-6 pb-6 pt-2 border-t border-slate-50 mx-6 animate-in fade-in duration-200">
                    <div className="flex flex-col gap-2 mb-6 mt-4">
                      {subItems.map((sub: any, sIdx: number) => (
                        <div key={sIdx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors gap-2 sm:gap-0 bg-slate-50/30">
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                            <span className="font-bold text-slate-700">{sub.name || sub.description}</span>
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-white border border-slate-200 text-blue-500 uppercase tracking-wider">VIEW</span>
                          </div>
                          <span className="font-black text-slate-800">{sub.amount ? sub.amount.toLocaleString() : sub.totalBudget?.toLocaleString() || 0} <span className="text-[10px] text-slate-400">KRW</span></span>
                        </div>
                      ))}
                      {subItems.length === 0 && <span className="text-sm text-slate-400 font-medium py-4 text-center">하위 내역이 존재하지 않습니다.</span>}
                    </div>
                    
                    {/* Intelligence Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 px-6 py-4 bg-blue-50/40 rounded-2xl">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest shrink-0">INTELLIGENCE</span>
                      <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <span className="bg-white px-2 py-1 rounded border border-blue-100">β 0.81</span>
                        <span className="bg-white px-2 py-1 rounded border border-blue-100">WIN 76.7%</span>
                        <span className="bg-white px-2 py-1 rounded border border-blue-100">HHI 903</span>
                        <span className="bg-white px-2 py-1 rounded border border-blue-100">SMR -0.20</span>
                      </div>
                      <div className="flex-1" />
                      <span className="text-[11px] font-black text-blue-500 cursor-pointer hover:underline uppercase tracking-wide">Overview &gt;</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Lightweight Static 6-Grid Framework */}
      <div className="mt-6 bg-white rounded-[2rem] p-8 sm:p-10 shadow-sm">
        <div className="mb-8">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            Portfolio Structural Convexity Framework 
            <span className="text-[13px] font-bold text-slate-400 tracking-wide uppercase">Aggregate Wealth Architecture</span>
          </h3>
          <p className="text-sm font-medium text-slate-400 mt-2 italic">Transcending Ontological and Epistemological Limitations in Aggregate Wealth Architecture</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { id: 1, title: 'THESIS', subtitle: 'Ontology', text: 'Deterministic geometric wealth architecture with USD-denominated superstructure — a perpetual synthetic short against domestic currency liabilities.' },
            { id: 2, title: 'ANTITHESIS', subtitle: 'Epistemology', text: 'Covariance singularity under stress, alpha decay paradox, and liquidity asymmetry exposing systemic tail-risk across correlated tranches.' },
            { id: 3, title: 'SYNTHESIS', subtitle: 'Framework', text: 'Vector orthogonalization, algorithmic decoupling via positive carry arbitrage, and mechanical survival switching against systemic tail-risk.' },
            { id: 4, title: 'HEGEMONIC EXPOSURE', subtitle: 'Anchoring', text: 'Core equity tranches (ASSET, PERNT) as ontological anchor to global hegemonic capital — Mega-Cap Technology and Defense Industrial Base.' },
            { id: 5, title: 'ALPHA ENGINE', subtitle: 'Tactical', text: 'Non-linear tactical tranche (TRADE) generating asymmetric payoff via volatility harvesting — decoupled from systematic beta exposure.' },
            { id: 6, title: 'RISK ARCHITECTURE', subtitle: 'Convexity', text: 'Structural entropy subordination through leverage-adjusted convexity control — mathematical firewall against aggregate drawdown cascades.' }
          ].map(block => (
            <div key={block.id} className="p-6 rounded-[1.5rem] border border-slate-100 flex gap-5 hover:border-blue-100 hover:shadow-sm transition-all bg-slate-50/50">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs shrink-0">{block.id}</div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-blue-600 uppercase tracking-widest">{block.title}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">— {block.subtitle}</span>
                </div>
                <p className="text-[13px] font-semibold text-slate-600 leading-relaxed">{block.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-center mt-10">
          <button className="px-6 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-black uppercase tracking-widest rounded-full transition-colors flex items-center gap-2">
            Read Full Framework <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-8 pb-4 border-t border-slate-200/60">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 text-[10px] font-black text-slate-400 tracking-widest uppercase">
          <span>© 2026 PORTFOLIO ASSET. All rights reserved.</span>
          <span className="flex items-center gap-3">
            Precision Portfolio Intelligence
            <span className="text-slate-300">|</span> 
            <button onClick={onLogout} className="text-blue-500 hover:text-blue-600 transition-colors">SECURE</button>
          </span>
        </div>
      </div>
      
    </div>
  );
}
