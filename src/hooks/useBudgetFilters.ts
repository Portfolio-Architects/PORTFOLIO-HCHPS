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
  const policySet = useMemo(() => new Set(filterPolicy), [filterPolicy]);
  const unitSet = useMemo(() => new Set(filterUnit), [filterUnit]);
  const detailSet = useMemo(() => new Set(filterDetail), [filterDetail]);
  const statSet = useMemo(() => new Set(filterStat), [filterStat]);

  const { uniquePolicies, unitOptions, detailOptions, statOptions, filteredCategoriesTree } = useMemo(() => {
    const policySums: Record<string, number> = {};
    const unitSums: Record<string, number> = {};
    const detailSums: Record<string, number> = {};
    const statSums: Record<string, number> = {};
    const tree: BudgetCategory[] = [];

    const hasPolicy = policySet.size > 0;
    const hasUnit = unitSet.size > 0;
    const hasDetail = detailSet.size > 0;
    const hasStat = statSet.size > 0;

    for (let i = 0; i < categories.length; i++) {
      const c = categories[i];
      const pMatch = !hasPolicy || policySet.has(c.policyProject || '');
      const uMatch = !hasUnit || unitSet.has(c.unitProject || '');
      const dMatch = !hasDetail || detailSet.has(c.detailedProject || '');
      const sMatch = !hasStat || statSet.has(c.statItem || '');

      if (c.policyProject) {
        policySums[c.policyProject] = (policySums[c.policyProject] || 0) + c.totalBudget;
      }
      if (pMatch && c.unitProject) {
        unitSums[c.unitProject] = (unitSums[c.unitProject] || 0) + c.totalBudget;
      }
      if (pMatch && uMatch && c.detailedProject) {
        detailSums[c.detailedProject] = (detailSums[c.detailedProject] || 0) + c.totalBudget;
      }
      if (pMatch && uMatch && dMatch && c.statItem) {
        statSums[c.statItem] = (statSums[c.statItem] || 0) + c.totalBudget;
      }
      if (pMatch && uMatch && dMatch && sMatch) {
        tree.push(c);
      }
    }

    return {
      uniquePolicies: Object.keys(policySums).map(p => ({ value: p, suffix: `${formatN(policySums[p])}원` })),
      unitOptions: Object.keys(unitSums).map(u => ({ value: u, suffix: `${formatN(unitSums[u])}원` })),
      detailOptions: Object.keys(detailSums).map(d => ({ value: d, suffix: `${formatN(detailSums[d])}원` })),
      statOptions: Object.keys(statSums).map(s => ({ value: s, suffix: `${formatN(statSums[s])}원` })),
      filteredCategoriesTree: tree
    };
  }, [categories, policySet, unitSet, detailSet, statSet]);

  const groupedByPolicy = useMemo(() => {
    const groupsMap: Record<string, BudgetCategory[]> = {};
    filteredCategoriesTree.forEach(cat => {
      const policy = cat.policyProject || '분류되지 않음';
      if (!groupsMap[policy]) {
        groupsMap[policy] = [];
      }
      groupsMap[policy].push(cat);
    });
    return Object.keys(groupsMap).map(policy => ({
      policyName: policy,
      cats: groupsMap[policy]
    }));
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
