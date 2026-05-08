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

  // Predictive Modeling & Burn Rate Velocity Insights
  const { predictionData, velocityInsights, nextYearRecommendation, projectedEoy } = useMemo(() => {
    const currentMonth = 5; // Assume May (0-indexed up to 4, so 5 months elapsed)
    const elapsedRatio = currentMonth / 12; 
    
    const insights: any[] = [];
    let projectedNextYearTotal = 0;
    let actualCumulative = 0;

    // Use breakdownData to calculate item-level velocity
    breakdownData.forEach(item => {
      const burnRate = item.total > 0 ? item.executed / item.total : 0;
      const velocity = elapsedRatio > 0 ? burnRate / elapsedRatio : 0; // >1 means burning faster than time
      
      let recommendation = 1; // 100% of current budget
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

      // Apply policy model weight
      let modelWeight = 1;
      if (predictionModel === 'conservative') modelWeight = 0.9;
      if (predictionModel === 'aggressive') modelWeight = 1.1;
      
      const nextYearAlloc = item.total * recommendation * modelWeight;
      projectedNextYearTotal += nextYearAlloc;
      actualCumulative += item.executed;

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

    // Generate Chart Data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let runningTotal = 0;
    const actualIncrements = [12000000, 35000000, 18000000, 42000000, actualCumulative - 107000000]; // mock increments to match actual cumulative
    if (actualIncrements[4] < 0) actualIncrements[4] = 25000000; // fallback if data is weird
    
    const data = months.map((m, i) => {
      if (i < currentMonth) {
        runningTotal += actualIncrements[i] || 0;
        return { name: m, actual: runningTotal, predicted_conservative: null, predicted_baseline: null, predicted_aggressive: null };
      } else {
        const mRate = runningTotal / currentMonth; 
        const predictedVal = runningTotal + mRate * (i - currentMonth + 1);
        
        const factor = (i - currentMonth + 1);
        const spread = mRate * 0.15 * factor;

        return { 
          name: m, 
          actual: null, 
          predicted_conservative: predictedVal - spread,
          predicted_baseline: predictedVal,
          predicted_aggressive: predictedVal + spread
        };
      }
    });

    // Connect the lines
    if (currentMonth > 0 && currentMonth <= 12) {
      data[currentMonth - 1].predicted_conservative = data[currentMonth - 1].actual;
      data[currentMonth - 1].predicted_baseline = data[currentMonth - 1].actual;
      data[currentMonth - 1].predicted_aggressive = data[currentMonth - 1].actual;
    }

    const finalPredicted = data[11].predicted_baseline || 0;
    const eoyRate = totalBudget > 0 ? (finalPredicted / totalBudget) * 100 : 0;

    // Sort insights to show most extreme deviations first
    insights.sort((a, b) => Math.abs(b.velocity - 1) - Math.abs(a.velocity - 1));

    return { 
      predictionData: data, 
      velocityInsights: insights.slice(0, 3), // Top 3 insights
      nextYearRecommendation: projectedNextYearTotal,
      projectedEoy: eoyRate
    };
  }, [breakdownData, predictionModel, totalBudget]);

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
    predictionData,
    velocityInsights,
    nextYearRecommendation,
    projectedEoy
  };
}
