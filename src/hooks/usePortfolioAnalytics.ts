import { useState, useMemo } from 'react';
import { BudgetCategory, BudgetEntry } from '@/types';

export function usePortfolioAnalytics(budgetCategories: BudgetCategory[], budgetEntries: BudgetEntry[]) {
  const [selectedProject, setSelectedProject] = useState('ALL');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [predictionModel, setPredictionModel] = useState<'conservative' | 'baseline' | 'aggressive'>('baseline');
  const [routineSpend, setRoutineSpend] = useState<number>(0); // 월 고정/루틴 지출액

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
  const allBreakdownData = useMemo(() => {
    const projectsData = detailedProjects.map(dp => {
      const cats = budgetCategories.filter(c => c.detailedProject === dp);
      const catIds = new Set(cats.map(c => c.id));
      const total = cats.reduce((s, c) => s + c.totalBudget, 0);
      const executed = budgetEntries.filter(e => catIds.has(e.categoryId) && !e.isPlanned && e.actionType !== 'settle').reduce((s, e) => {
        if (e.actionType === 'transfer') return s - e.amount;
        return s + e.amount;
      }, 0);
      const rate = total > 0 ? (executed / total) * 100 : 0;
      
      const remaining = Math.max(0, total - executed);
      const recommendedMonthly = Math.round(remaining / 6);
      const historicalMonthly = Math.round(executed / 5);

      // 이 세부사업의 가계획 총합
      const plannedInProject = budgetEntries
        .filter(e => e.isPlanned && catIds.has(e.categoryId))
        .reduce((sum, e) => sum + e.amount, 0);

      // 이 세부사업의 가상 조정액 총합 (개별 카테고리(통계목) 단위로 실제 집행액을 하한선으로 보정)
      let virtualAdjustmentInProject = 0;
      cats.forEach(cat => {
        let catVirtualAdjustment = 0;
        if (cat.subItems) {
          cat.subItems.forEach(sub => {
            const hasCalcs = sub.calculations && sub.calculations.length > 0;
            if (hasCalcs) {
              sub.calculations?.forEach(calc => {
                if (typeof calc.virtualAdjustment === 'number') {
                  catVirtualAdjustment += calc.virtualAdjustment;
                }
              });
            } else {
              if (typeof sub.virtualAdjustment === 'number') {
                catVirtualAdjustment += sub.virtualAdjustment;
              }
            }
          });
        }

        // 개별 카테고리(통계목) 단위의 실제 집행액 계산 (단순 한도 배정인 issuance 교부 건은 제외)
        const catExecuted = budgetEntries
          .filter(e => e.categoryId === cat.id && !e.isPlanned && e.actionType !== 'settle' && e.actionType !== 'issuance')
          .reduce((s, e) => {
            if (e.actionType === 'transfer') return s - e.amount;
            return s + e.amount;
          }, 0);

        virtualAdjustmentInProject += Math.max(catExecuted, catVirtualAdjustment);
      });

      // 미설계 잔액 = 남은예산 - 가계획 - 가상조정액
      const unplannedRemaining = remaining - plannedInProject - virtualAdjustmentInProject;
      
      let burnStatus: 'ACCELERATE' | 'DECELERATE' | 'OPTIMAL' = 'OPTIMAL';
      const diffAmount = recommendedMonthly - historicalMonthly;
      
      if (executed > 0) {
        if (recommendedMonthly > 1.15 * historicalMonthly) {
          burnStatus = 'ACCELERATE';
        } else if (recommendedMonthly < 0.85 * historicalMonthly) {
          burnStatus = 'DECELERATE';
        }
      } else {
        if (remaining > 0) {
          burnStatus = 'ACCELERATE';
        }
      }
      
      return { 
        name: dp, 
        total, 
        executed, 
        rate,
        remaining,
        unplannedRemaining,
        plannedInProject,
        virtualAdjustmentInProject,
        recommendedMonthly,
        historicalMonthly,
        burnStatus,
        diffAmount
      };
    });
    return projectsData.sort((a, b) => a.name.localeCompare(b.name));
  }, [budgetCategories, budgetEntries, detailedProjects]);


  // Monthly Execution Trend Analysis & Target Spend-down Planner
  const { 
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
  } = useMemo(() => {
    const currentMonth = new Date().getMonth() + 1; // 동적으로 현재 월 반영 (예: 6월이면 6)
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

    // --- 1. Linear Regression (최소자승법 선형 회귀) ---
    // N = currentMonth ( Jan to currentMonth )
    const N = currentMonth;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    
    let tempCumulative = 0;
    for (let k = 1; k <= N; k++) {
      tempCumulative += monthlyAmounts[k - 1];
      sumX += k;
      sumY += tempCumulative;
      sumXY += k * tempCumulative;
      sumXX += k * k;
    }
    
    const slope = (N * sumXY - sumX * sumY) / (N * sumXX - sumX * sumX || 1);
    const intercept = (sumY - slope * sumX) / N;

    // --- 2. Target Burn-down Plan by Nov 30 ---
    const actualCumulative = tempCumulative; // Jan to currentMonth actual total
    const remainTargetAmt = Math.max(0, totalBudget - actualCumulative);
    
    // 가계획 (isPlanned: true) 항목들의 월별 집계
    const plannedMonthlyAmounts = Array(12).fill(0);
    budgetEntries.forEach(e => {
      if (!e.isPlanned || !validCategoryIds.has(e.categoryId)) {
        return;
      }
      const parts = e.date.split('-');
      const monthIdx = parts.length >= 2 ? parseInt(parts[1], 10) - 1 : -1;
      if (monthIdx >= 0 && monthIdx <= 11) { // 1월 ~ 12월 전체 수용
        plannedMonthlyAmounts[monthIdx] += e.amount;
      }
    });

    // 가상 조정액(Virtual Adjustment) 총합 계산 (개별 카테고리 단위로 실제 집행액을 하한선으로 보정)
    let totalVirtualAdjustment = 0;
    filteredCategories.forEach(cat => {
      let catVirtualAdjustment = 0;
      if (cat.subItems) {
        cat.subItems.forEach(sub => {
          const hasCalcs = sub.calculations && sub.calculations.length > 0;
          if (hasCalcs) {
            sub.calculations?.forEach(calc => {
              if (typeof calc.virtualAdjustment === 'number') {
                catVirtualAdjustment += calc.virtualAdjustment;
              }
            });
          } else {
            if (typeof sub.virtualAdjustment === 'number') {
              catVirtualAdjustment += sub.virtualAdjustment;
            }
          }
        });
      }

      // 개별 카테고리(통계목) 단위의 실제 집행액 계산 (단순 한도 배정인 issuance 교부 건은 제외)
      const catExecuted = budgetEntries
        .filter(e => e.categoryId === cat.id && !e.isPlanned && e.actionType !== 'settle' && e.actionType !== 'issuance')
        .reduce((s, e) => {
          if (e.actionType === 'transfer') return s - e.amount;
          return s + e.amount;
        }, 0);

      totalVirtualAdjustment += Math.max(catExecuted, catVirtualAdjustment);
    });

    const totalPlannedInDraft = plannedMonthlyAmounts.reduce((sum, val) => sum + val, 0);
    // 가상 조정액 보정치 반영 (설계 완료로 인식하여 차감)
    const unplannedRemainingAmount = remainTargetAmt - totalPlannedInDraft - totalVirtualAdjustment;


    // 월 권장 지출액 (참고용 기준값)
    const recommendedMonthlySpendForTarget = Math.round(remainTargetAmt / 6);

    let cumulative = 0;
    let planCumulativeVal = 0;
    
    const trendData = months.map((m, i) => {
      const actualMonthAmount = monthlyAmounts[i];
      cumulative += actualMonthAmount;
      
      const targetVal = i < 11 
        ? Math.round(monthlyTargetUnit * (i + 1)) 
        : totalBudget;

      const regVal = Math.round(slope * (i + 1) + intercept);
      const plannedMonthSpend = Math.round(plannedMonthlyAmounts[i]);
      
      if (i <= currentMonth - 1) {
        // 1월~현재 월 (실제 데이터 반영)
        // 가계획 입력값이 있다면 계획값을 사용하고, 없으면 실제 누적 실적값을 계획선 베이스로 적용
        const effectivePlanSpend = plannedMonthSpend > 0 ? plannedMonthSpend : actualMonthAmount;
        planCumulativeVal += effectivePlanSpend;
        return {
          name: m,
          monthly: actualMonthAmount,
          cumulative: cumulative,
          planCumulative: planCumulativeVal,
          planMonthly: plannedMonthSpend > 0 ? plannedMonthSpend : actualMonthAmount,
          regressionCumulative: regVal >= 0 ? regVal : 0,
          targetCumulative: targetVal
        };
      } else {
        // 6월~12월 (계획/예측 데이터 반영)
        planCumulativeVal += plannedMonthSpend;
        
        return {
          name: m,
          monthly: undefined,
          cumulative: undefined,
          planCumulative: planCumulativeVal,
          planMonthly: plannedMonthSpend,
          regressionCumulative: regVal >= 0 ? regVal : 0,
          targetCumulative: targetVal
        };
      }
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
    
    
    // 자연 소진 월(exhaustion month) 구하기
    let exhaustionMonth = 'N/A';
    if (slope > 0) {
      const monthFloat = (totalBudget - intercept) / slope;
      if (monthFloat > 0 && monthFloat <= 24) {
        const monthNum = Math.ceil(monthFloat);
        if (monthNum <= 12) {
          exhaustionMonth = `2026년 ${monthNum}월`;
        } else {
          exhaustionMonth = `2027년 ${monthNum - 12}월`;
        }
      } else if (monthFloat > 24) {
        exhaustionMonth = '2년 이상 소요';
      }
    } else {
      exhaustionMonth = '지출 증가세 없음';
    }

    // 2026년 말 최종 예상 소진율
    const regEoyVal = trendData[11].regressionCumulative;
    const projectedEoyRate = totalBudget > 0 ? (regEoyVal / totalBudget) * 100 : 0;
    
    return {
      monthlyExecutionData: trendData,
      maxSpendMonth: { month: maxMonthName, amount: maxAmt },
      avgMonthlySpend: avgSpend,
      remainingTargetAmount: remainTargetAmt,
      recommendedMonthlySpendForTarget,
      exhaustionMonthName: exhaustionMonth,
      projectedEoyExecutionRate: projectedEoyRate,
      totalPlannedInDraft,
      unplannedRemainingAmount,
      totalVirtualAdjustment
    };
  }, [filteredCategories, budgetEntries, executedBudget, totalBudget]);

  return {
    selectedProject, setSelectedProject,
    expandedCategory, setExpandedCategory,
    predictionModel, setPredictionModel,
    routineSpend, setRoutineSpend,
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
  };
}
