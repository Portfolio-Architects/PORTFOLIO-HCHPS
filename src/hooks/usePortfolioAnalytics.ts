import { useState, useMemo } from 'react';
import { BudgetCategory, BudgetEntry } from '@/types';

export function usePortfolioAnalytics(budgetCategories: BudgetCategory[], budgetEntries: BudgetEntry[]) {
  const [selectedProject, setSelectedProject] = useState('ALL');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [predictionModel, setPredictionModel] = useState<'conservative' | 'baseline' | 'aggressive'>('baseline');

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

  // Calculate Budget Stats
  const totalBudget = useMemo(() => filteredCategories.reduce((sum, cat) => sum + cat.totalBudget, 0), [filteredCategories]);
  
  const executedBudget = useMemo(() => {
    const validCategoryIds = new Set(filteredCategories.map(c => c.id));
    return budgetEntries
      .filter(e => !e.isPlanned && e.actionType !== 'settle' && validCategoryIds.has(e.categoryId))
      .reduce((sum, e) => {
        if (e.actionType === 'transfer') return sum - e.amount;
        return sum + e.amount;
      }, 0);
  }, [budgetEntries, filteredCategories]);

  const remainingBudget = totalBudget - executedBudget;
  const executionRate = totalBudget > 0 ? (executedBudget / totalBudget) * 100 : 0;

  // Asset Allocation
  const pieData = [
    { name: '집행 완료', value: executedBudget, color: '#3B82F6' },
    { name: '잔여 예산', value: Math.max(0, remainingBudget), color: '#E2E8F0' }
  ];

  const breakdownData = useMemo<{ name: string; total: number; executed: number; rate: number; formationItem?: string }[]>(() => {
    if (selectedProject === 'ALL') {
      const projectsData = detailedProjects.map(dp => {
        const cats = budgetCategories.filter(c => c.detailedProject === dp);
        const catIds = new Set(cats.map(c => c.id));
        const total = cats.reduce((s, c) => s + c.totalBudget, 0);
        const executed = budgetEntries.filter(e => catIds.has(e.categoryId) && !e.isPlanned && e.actionType !== 'settle').reduce((s, e) => {
          if (e.actionType === 'transfer') return s - e.amount;
          return s + e.amount;
        }, 0);
        const rate = total > 0 ? (executed / total) * 100 : 0;
        return { name: dp, total, executed, rate };
      });
      return projectsData.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      const cats = budgetCategories.filter(c => c.detailedProject === selectedProject);
      return cats.map(cat => {
        const executed = budgetEntries.filter(e => e.categoryId === cat.id && !e.isPlanned && e.actionType !== 'settle').reduce((s, e) => {
          if (e.actionType === 'transfer') return s - e.amount;
          return s + e.amount;
        }, 0);
        const rate = cat.totalBudget > 0 ? (executed / cat.totalBudget) * 100 : 0;
        return { name: cat.name, formationItem: cat.formationItem, total: cat.totalBudget, executed, rate };
      }).sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [budgetCategories, budgetEntries, selectedProject, detailedProjects]);

  // 항상 모든 사업을 표시하기 위한 독립된 데이터 (아코디언용)
  const allBreakdownData = useMemo<{ name: string; total: number; executed: number; rate: number; formationItem?: string }[]>(() => {
    const projectsData = detailedProjects.map(dp => {
      const cats = budgetCategories.filter(c => c.detailedProject === dp);
      const catIds = new Set(cats.map(c => c.id));
      const total = cats.reduce((s, c) => s + c.totalBudget, 0);
      const executed = budgetEntries.filter(e => catIds.has(e.categoryId) && !e.isPlanned && e.actionType !== 'settle').reduce((s, e) => {
        if (e.actionType === 'transfer') return s - e.amount;
        return s + e.amount;
      }, 0);
      const rate = total > 0 ? (executed / total) * 100 : 0;
      return { name: dp, total, executed, rate };
    });
    return projectsData.sort((a, b) => a.name.localeCompare(b.name));
  }, [budgetCategories, budgetEntries, detailedProjects]);

  // Monthly Execution Trend Analysis
  const { monthlyExecutionData, maxSpendMonth, avgMonthlySpend, velocityInsights, remainingTargetAmount, recommendedMonthlySpendForTarget } = useMemo(() => {
    const currentMonth = 5; // 2026년 5월 기준 (1~5월까지 5개월 경과)
    const elapsedRatio = currentMonth / 12;
    const validCategoryIds = new Set(filteredCategories.map(c => c.id));
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyAmounts = Array(12).fill(0);
    
    budgetEntries.forEach(e => {
      if (e.isPlanned || e.actionType === 'settle' || !validCategoryIds.has(e.categoryId)) {
        return;
      }
      
      const parts = e.date.split('-');
      const monthIdx = parts.length >= 2 ? parseInt(parts[1], 10) - 1 : -1;
      
      if (monthIdx >= 0 && monthIdx < 12) {
        const amount = e.actionType === 'transfer' ? -e.amount : e.amount;
        monthlyAmounts[monthIdx] += amount;
      }
    });
    
    // 11월(Index 10)까지 100% 소진 목표선형 가이드
    const monthlyTargetUnit = totalBudget / 11;
    
    let cumulative = 0;
    const trendData = months.map((m, i) => {
      const actualMonthAmount = monthlyAmounts[i];
      cumulative += actualMonthAmount;
      
      // 11월까지 선형 누적, 12월은 100% 유지
      const targetVal = i < 11 
        ? Math.round(monthlyTargetUnit * (i + 1)) 
        : totalBudget;
        
      return {
        name: m,
        monthly: actualMonthAmount,
        cumulative: cumulative,
        targetCumulative: targetVal
      };
    });
    
    // 최대 지출월 찾기
    let maxAmt = 0;
    let maxMonthName = 'None';
    monthlyAmounts.forEach((amt, idx) => {
      if (amt > maxAmt) {
        maxAmt = amt;
        maxMonthName = months[idx];
      }
    });
    
    const avgSpend = currentMonth > 0 ? executedBudget / currentMonth : 0;
    
    // Velocity Insights 계산 복구 (예측 가중치를 배제한 실제 예산 속도 분석)
    const insights: any[] = [];
    breakdownData.forEach(item => {
      const burnRate = item.total > 0 ? item.executed / item.total : 0;
      const velocity = elapsedRatio > 0 ? burnRate / elapsedRatio : 0; 
      
      let recommendation = 1; 
      let action = 'MAINTAIN';
      let insightText = '정상 속도 소진 중';
      
      if (velocity > 1.2) {
        recommendation = 1.3; 
        action = 'INCREASE';
        insightText = `조기 소진 (${(burnRate*100).toFixed(1)}%). 내년 30% 증액 필요`;
      } else if (velocity < 0.5 && item.executed > 0) {
        recommendation = 0.8; 
        action = 'DECREASE';
        insightText = `집행 부진 (${(burnRate*100).toFixed(1)}%). 내년 20% 삭감 가능`;
      } else if (item.executed === 0 && elapsedRatio > 0.3) {
        recommendation = 0.5; 
        action = 'DECREASE';
        insightText = `미집행. 내년 50% 삭감 권고`;
      }

      const nextYearAlloc = item.total * recommendation;

      if (action !== 'MAINTAIN') {
        insights.push({
          name: item.name,
          formationItem: item.formationItem,
          burnRate: burnRate * 100,
          velocity,
          action,
          insightText,
          diffAmount: nextYearAlloc - item.total
        });
      }
    });

    insights.sort((a, b) => Math.abs(b.velocity - 1) - Math.abs(a.velocity - 1));
    
    // 11월 목표 대비 남은 목표 예산 및 월간 권장 지출액 계산
    const remainTargetAmt = Math.max(0, totalBudget - executedBudget);
    const recommendedSpend = remainTargetAmt / 6; // 6개월 남음 (6,7,8,9,10,11월)
    
    return {
      monthlyExecutionData: trendData,
      maxSpendMonth: { month: maxMonthName, amount: maxAmt },
      avgMonthlySpend: avgSpend,
      velocityInsights: insights.slice(0, 3),
      remainingTargetAmount: remainTargetAmt,
      recommendedMonthlySpendForTarget: recommendedSpend
    };
  }, [filteredCategories, budgetEntries, executedBudget, breakdownData, totalBudget]);

  return {
    selectedProject, setSelectedProject,
    expandedCategory, setExpandedCategory,
    predictionModel, setPredictionModel,
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
  };
}
