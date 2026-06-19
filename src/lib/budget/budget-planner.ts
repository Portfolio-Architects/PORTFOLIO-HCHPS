import { BudgetCategory, BudgetEntry } from '@/types';

export interface BudgetForecast {
  categoryId: string;
  categoryName: string;
  totalBudget: number;
  actualExpense: number;
  burnRate: number; // 현재 시점 소진율 (actual / total)
  dailyVelocity: number; // 일평균 지출 속도
  projectedExpense: number; // 연말 예상 지출액
  projectedBurnRate: number; // 연말 예상 소진율
  projectedBalance: number; // 연말 예상 잔액 (+: 잉여, -: 적자)
  status: 'critical' | 'warn' | 'normal' | 'under_utilized';
}

export interface ReallocationRecommendation {
  fromCategoryId: string;
  fromCategoryName: string;
  toCategoryId: string;
  toCategoryName: string;
  amount: number;
  reason: string;
}

export interface BudgetPlannerReport {
  forecasts: BudgetForecast[];
  recommendations: ReallocationRecommendation[];
  totalBudget: number;
  totalActualExpense: number;
  totalProjectedExpense: number;
  overallStatus: 'normal' | 'warning' | 'critical';
}

export class BudgetPlanner {
  // Current local time simulation base date (2026-06-12)
  private static BASE_YEAR = 2026;
  private static BASE_MONTH = 5; // 0-indexed: June (5)
  private static BASE_DATE = 12;

  // Days elapsed in base year: Jan(31) + Feb(28) + Mar(31) + Apr(30) + May(31) + Jun(12) = 163 days
  private static DAYS_ELAPSED = 163;
  private static DAYS_REMAINING = 202; // 365 - 163

  public static calculateForecasts(
    categories: BudgetCategory[],
    entries: BudgetEntry[]
  ): BudgetPlannerReport {
    // 1. Group entries by categoryId
    const expensesMap = new Map<string, number>();
    
    // Sum only non-planned (actual / executed) entries
    entries.forEach(entry => {
      // Exclude planned/draft entries and check if they belong to general/settled action type
      if (entry.isPlanned) return;
      
      const current = expensesMap.get(entry.categoryId) || 0;
      expensesMap.set(entry.categoryId, current + entry.amount);
    });

    const forecasts: BudgetForecast[] = categories.map(cat => {
      const actualExpense = expensesMap.get(cat.id) || 0;
      const totalBudget = cat.totalBudget || 0;
      
      const burnRate = totalBudget > 0 ? (actualExpense / totalBudget) : 0;
      const dailyVelocity = actualExpense / this.DAYS_ELAPSED;
      
      const projectedExpense = actualExpense + (dailyVelocity * this.DAYS_REMAINING);
      const projectedBurnRate = totalBudget > 0 ? (projectedExpense / totalBudget) : 0;
      const projectedBalance = totalBudget - projectedExpense;
      
      // Classify status
      let status: BudgetForecast['status'] = 'normal';
      if (projectedBurnRate > 1.1) {
        status = 'critical'; // Over budget risk by 10%+
      } else if (projectedBurnRate > 1.0) {
        status = 'warn'; // Borderline over budget
      } else if (projectedBurnRate < 0.4 && totalBudget > 500000) {
        status = 'under_utilized'; // Significant under-spending (under 40% projected)
      }

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        totalBudget,
        actualExpense,
        burnRate,
        dailyVelocity,
        projectedExpense,
        projectedBalance,
        projectedBurnRate,
        status
      };
    });

    // 2. Generate recommendations
    const recommendations: ReallocationRecommendation[] = [];
    
    // Sort critical / warn forecasts (need funds)
    const deficits = forecasts
      .filter(f => f.projectedBalance < 0 && f.totalBudget > 0)
      .sort((a, b) => a.projectedBalance - b.projectedBalance); // Most negative first

    // Sort under_utilized forecasts (have extra funds)
    const surpluses = forecasts
      .filter(f => f.projectedBalance > 200000 && f.status === 'under_utilized')
      .sort((a, b) => b.projectedBalance - a.projectedBalance); // Most positive first

    // Deep copy of surpluses to track remaining transferable pools
    const surplusPool = surpluses.map(s => ({
      ...s,
      // Conservative transferable amount (50% of the projected surplus, rounded down to nearest 10,000)
      transferableAmount: Math.floor((s.projectedBalance * 0.5) / 10000) * 10000
    }));

    for (const def of deficits) {
      let neededAmount = Math.abs(def.projectedBalance);
      // Round up needed amount to nearest 10,000
      neededAmount = Math.ceil(neededAmount / 10000) * 10000;

      for (const sur of surplusPool) {
        if (neededAmount <= 0) break;
        if (sur.transferableAmount <= 50000) continue; // Skip if transferable pool is negligible

        const transferAmount = Math.min(neededAmount, sur.transferableAmount);
        
        recommendations.push({
          fromCategoryId: sur.categoryId,
          fromCategoryName: sur.categoryName,
          toCategoryId: def.categoryId,
          toCategoryName: def.categoryName,
          amount: transferAmount,
          reason: `연말 예상 소진율이 ${(def.projectedBurnRate * 100).toFixed(0)}%로 예산 초과(적자 ${Math.abs(Math.round(def.projectedBalance)).toLocaleString()}원)가 예상되는 반면, '${sur.categoryName}' 항목은 소진 속도가 낮아 연말에 예산이 남을 것으로 추정되어 재분배를 권장합니다.`
        });

        neededAmount -= transferAmount;
        sur.transferableAmount -= transferAmount;
      }
    }

    // Overall summary calculations
    let totalBudget = 0;
    let totalActualExpense = 0;
    let totalProjectedExpense = 0;

    forecasts.forEach(f => {
      totalBudget += f.totalBudget;
      totalActualExpense += f.actualExpense;
      totalProjectedExpense += f.projectedExpense;
    });

    let overallStatus: BudgetPlannerReport['overallStatus'] = 'normal';
    const criticalCount = forecasts.filter(f => f.status === 'critical').length;
    const warnCount = forecasts.filter(f => f.status === 'warn').length;

    if (criticalCount > 0 || totalProjectedExpense > totalBudget) {
      overallStatus = 'critical';
    } else if (warnCount > 0) {
      overallStatus = 'warning';
    }

    return {
      forecasts,
      recommendations,
      totalBudget,
      totalActualExpense,
      totalProjectedExpense,
      overallStatus
    };
  }
}
