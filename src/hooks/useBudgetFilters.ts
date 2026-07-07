/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo } from 'react';
import { BudgetCategory, BudgetEntry } from '@/types';

function formatN(n: number) { return n.toLocaleString('ko-KR'); }

export function useBudgetFilters(
  categories: BudgetCategory[],
  entries: BudgetEntry[],
  getCategoryStats: (id: string) => any
) {
  const [filterPolicy, setFilterPolicy] = useState<string[]>([]);
  const [filterUnit, setFilterUnit] = useState<string[]>([]);
  const [filterDetail, setFilterDetail] = useState<string[]>([]);
  const [filterStat, setFilterStat] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('hchps-budget-filters-v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.policy)) setFilterPolicy(parsed.policy);
        if (Array.isArray(parsed.unit)) setFilterUnit(parsed.unit);
        if (Array.isArray(parsed.detail)) setFilterDetail(parsed.detail);
        if (Array.isArray(parsed.stat)) setFilterStat(parsed.stat);
      }
    } catch {}
    setIsLoaded(true);
  }, []);

  const handleSaveFilters = () => {
    localStorage.setItem('hchps-budget-filters-v2', JSON.stringify({
      policy: filterPolicy,
      unit: filterUnit,
      detail: filterDetail,
      stat: filterStat
    }));
    alert('✅ 현재 필터링 상태가 저장되었습니다. 앞으로 페이지 접속 시 이 필터가 유지됩니다.');
  };

  const handleResetFilters = () => {
    setFilterPolicy([]);
    setFilterUnit([]);
    setFilterDetail([]);
    setFilterStat([]);
    localStorage.removeItem('hchps-budget-filters-v2');
  };

  // Hierarchical Filter Calculation
  const uniquePolicies = useMemo(() => {
    const sums: Record<string, number> = {};
    categories.forEach(c => {
      if (c.policyProject) {
        sums[c.policyProject] = (sums[c.policyProject] || 0) + c.totalBudget;
      }
    });
    return Object.keys(sums).map(policy => ({
      value: policy,
      suffix: `${formatN(sums[policy])}원`
    }));
  }, [categories]);
  
  const unitOptions = useMemo(() => {
    const list = categories.filter(c => filterPolicy.length === 0 || filterPolicy.includes(c.policyProject || ''));
    const sums: Record<string, number> = {};
    list.forEach(c => {
      if (c.unitProject) {
        sums[c.unitProject] = (sums[c.unitProject] || 0) + c.totalBudget;
      }
    });
    return Object.keys(sums).map(unit => ({
      value: unit,
      suffix: `${formatN(sums[unit])}원`
    }));
  }, [categories, filterPolicy]);
  
  const detailOptions = useMemo(() => {
    const list = categories.filter(c => (filterPolicy.length === 0 || filterPolicy.includes(c.policyProject || '')) && (filterUnit.length === 0 || filterUnit.includes(c.unitProject || '')));
    const sums: Record<string, number> = {};
    list.forEach(c => {
      if (c.detailedProject) {
        sums[c.detailedProject] = (sums[c.detailedProject] || 0) + c.totalBudget;
      }
    });
    return Object.keys(sums).map(detail => ({
      value: detail,
      suffix: `${formatN(sums[detail])}원`
    }));
  }, [categories, filterPolicy, filterUnit]);
  
  const statOptions = useMemo(() => {
    const list = categories.filter(c => (filterPolicy.length === 0 || filterPolicy.includes(c.policyProject || '')) && (filterUnit.length === 0 || filterUnit.includes(c.unitProject || '')) && (filterDetail.length === 0 || filterDetail.includes(c.detailedProject || '')));
    const sums: Record<string, number> = {};
    list.forEach(c => {
      if (c.statItem) {
        sums[c.statItem] = (sums[c.statItem] || 0) + c.totalBudget;
      }
    });
    return Object.keys(sums).map(stat => ({
      value: stat,
      suffix: `${formatN(sums[stat])}원`
    }));
  }, [categories, filterPolicy, filterUnit, filterDetail]);

  const filteredCategoriesTree = useMemo(() => {
    return categories.filter(c => {
      if (filterPolicy.length > 0 && !filterPolicy.includes(c.policyProject || '')) return false;
      if (filterUnit.length > 0 && !filterUnit.includes(c.unitProject || '')) return false;
      if (filterDetail.length > 0 && !filterDetail.includes(c.detailedProject || '')) return false;
      if (filterStat.length > 0 && !filterStat.includes(c.statItem || '')) return false;
      return true;
    });
  }, [categories, filterPolicy, filterUnit, filterDetail, filterStat]);

  const groupedByPolicy = useMemo(() => {
    const groups: { policyName: string; cats: BudgetCategory[] }[] = [];
    filteredCategoriesTree.forEach(cat => {
      const policy = cat.policyProject || '분류되지 않음';
      let group = groups.find(g => g.policyName === policy);
      if (!group) {
        group = { policyName: policy, cats: [] };
        groups.push(group);
      }
      group.cats.push(cat);
    });
    return groups;
  }, [filteredCategoriesTree]);

  // Dynamic stats based on selected filters
  const filteredStats = useMemo(() => {
    let totalBudget = 0;
    let remaining = 0;
    let totalSpent = 0;
    let totalPlanned = 0;

    let dailyExpenseIssued = 0;
    let dailyExpenseSpent = 0;
    let dailyExpenseRemaining = 0;

    filteredCategoriesTree.forEach(cat => {
      const catStats = getCategoryStats(cat.id);
      if (catStats) {
        totalBudget += catStats.totalBudget;
        remaining += catStats.remaining;
        totalSpent += catStats.spent;
        totalPlanned += catStats.planned;
        dailyExpenseIssued += catStats.dailyExpenseIssued;
        dailyExpenseSpent += catStats.dailyExpenseSpent;
        dailyExpenseRemaining += catStats.dailyExpenseRemaining;
      }
    });

    return { totalBudget, remaining, totalSpent, totalPlanned, dailyExpenseIssued, dailyExpenseSpent, dailyExpenseRemaining };
  }, [filteredCategoriesTree, getCategoryStats]);

  return {
    filterPolicy, setFilterPolicy,
    filterUnit, setFilterUnit,
    filterDetail, setFilterDetail,
    filterStat, setFilterStat,
    isLoaded,
    handleSaveFilters,
    handleResetFilters,
    uniquePolicies,
    unitOptions,
    detailOptions,
    statOptions,
    filteredCategoriesTree,
    groupedByPolicy,
    filteredStats
  };
}
