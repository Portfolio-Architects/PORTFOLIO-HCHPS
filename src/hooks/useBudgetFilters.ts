 
import { useState, useEffect, useMemo } from 'react';
import { BudgetCategory, BudgetEntry } from '@/types';

function formatN(n: number) { return n.toLocaleString('ko-KR'); }

export type CategoryStatus = 'OVER' | 'WARNING' | 'NORMAL';

export function getCategoryStatus(usageRate: number, remaining: number): CategoryStatus {
  if (usageRate >= 95 || remaining < 0) {
    return 'OVER';
  }
  if (usageRate >= 80) {
    return 'WARNING';
  }
  return 'NORMAL';
}

export const STATUS_CONFIG: Record<CategoryStatus, { label: string; badgeClass: string }> = {
  OVER: {
    label: '초과/위험',
    badgeClass: 'bg-red-500/20 text-red-400 border border-red-500/30'
  },
  WARNING: {
    label: '주의',
    badgeClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
  },
  NORMAL: {
    label: '정상',
    badgeClass: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
  }
};

export function useBudgetFilters(
  categories: BudgetCategory[],
  entries: BudgetEntry[],
  getCategoryStats: (id: string) => any
) {
  const [initialSaved] = useState(() => {
    if (typeof window === 'undefined') {
      return { policy: [], unit: [], detail: [], stat: [], month: '전체', status: '전체' };
    }
    try {
      const saved = localStorage.getItem('hchps-budget-filters-v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          policy: Array.isArray(parsed.policy) ? parsed.policy : [],
          unit: Array.isArray(parsed.unit) ? parsed.unit : [],
          detail: Array.isArray(parsed.detail) ? parsed.detail : [],
          stat: Array.isArray(parsed.stat) ? parsed.stat : [],
          month: typeof parsed.month === 'string' ? parsed.month : '전체',
          status: typeof parsed.status === 'string' ? parsed.status : '전체'
        };
      }
    } catch {}
    return { policy: [], unit: [], detail: [], stat: [], month: '전체', status: '전체' };
  });

  const [filterPolicy, setFilterPolicy] = useState<string[]>(initialSaved.policy);
  const [filterUnit, setFilterUnit] = useState<string[]>(initialSaved.unit);
  const [filterDetail, setFilterDetail] = useState<string[]>(initialSaved.detail);
  const [filterStat, setFilterStat] = useState<string[]>(initialSaved.stat);
  const [filterMonth, setFilterMonth] = useState<string>(initialSaved.month);
  const [filterStatus, setFilterStatus] = useState<string>(initialSaved.status);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 120);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const [isLoaded] = useState(true);

  const handleSaveFilters = () => {
    localStorage.setItem('hchps-budget-filters-v2', JSON.stringify({
      policy: filterPolicy,
      unit: filterUnit,
      detail: filterDetail,
      stat: filterStat,
      month: filterMonth,
      status: filterStatus
    }));
    alert('✅ 현재 필터링 상태가 저장되었습니다. 앞으로 페이지 접속 시 이 필터가 유지됩니다.');
  };

  const handleResetFilters = () => {
    setFilterPolicy([]);
    setFilterUnit([]);
    setFilterDetail([]);
    setFilterStat([]);
    setFilterMonth('전체');
    setFilterStatus('전체');
    setSearchTerm('');
    setDebouncedSearchTerm('');
    localStorage.removeItem('hchps-budget-filters-v2');
  };

  // Hierarchical & Multi-Criteria Filter Calculation
  const policySet = useMemo(() => new Set(filterPolicy), [filterPolicy]);
  const unitSet = useMemo(() => new Set(filterUnit), [filterUnit]);
  const detailSet = useMemo(() => new Set(filterDetail), [filterDetail]);
  const statSet = useMemo(() => new Set(filterStat), [filterStat]);

  const monthNum = useMemo(() => {
    if (!filterMonth || filterMonth === '전체') return null;
    const matched = filterMonth.match(/\d+/);
    return matched ? parseInt(matched[0], 10) : null;
  }, [filterMonth]);

  const searchKeyword = useMemo(() => {
    return debouncedSearchTerm.trim().toLowerCase();
  }, [debouncedSearchTerm]);

  // Pre-index matching category IDs from entries in O(Entries) time for ultra-fast lookup
  const matchingCategoryIdsFromEntries = useMemo(() => {
    if (!searchKeyword) return null;
    const set = new Set<string>();
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (
        (e.docRegNum || '').toLowerCase().includes(searchKeyword) ||
        (e.purpose || '').toLowerCase().includes(searchKeyword) ||
        (e.memo || '').toLowerCase().includes(searchKeyword)
      ) {
        set.add(e.categoryId);
      }
    }
    return set;
  }, [entries, searchKeyword]);

  const { uniquePolicies, unitOptions, detailOptions, statOptions, filteredCategoriesTree } = useMemo(() => {
    const policySums: Record<string, number> = {};
    const unitSums: Record<string, number> = {};
    const detailSums: Record<string, number> = {};
    const detailUsedSums: Record<string, number> = {};
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

      // Status filter check
      let statusMatch = true;
      if (filterStatus && filterStatus !== '전체') {
        const catStats = getCategoryStats(c.id);
        const status = catStats ? getCategoryStatus(catStats.usageRate, catStats.remaining) : 'NORMAL';
        if (filterStatus === '초과') statusMatch = (status === 'OVER');
        else if (filterStatus === '주의') statusMatch = (status === 'WARNING');
        else if (filterStatus === '정상') statusMatch = (status === 'NORMAL');
      }

      // Month filter check: category entries in selected month
      let monthMatch = true;
      if (monthNum !== null) {
        monthMatch = entries.some(e => {
          if (e.categoryId !== c.id) return false;
          const eMonth = new Date(e.date).getMonth() + 1;
          return eMonth === monthNum;
        });
      }

      // Search keyword match check across policy, category, subItems, docRegNum, purpose
      let searchMatch = true;
      if (searchKeyword) {
        const inPolicy = (c.policyProject || '').toLowerCase().includes(searchKeyword);
        const inUnit = (c.unitProject || '').toLowerCase().includes(searchKeyword);
        const inDetail = (c.detailedProject || '').toLowerCase().includes(searchKeyword);
        const inName = (c.name || '').toLowerCase().includes(searchKeyword);
        const inStat = (c.statItem || '').toLowerCase().includes(searchKeyword);
        const inFormation = (c.formationItem || '').toLowerCase().includes(searchKeyword);
        const inManagement = (c.managementProject || '').toLowerCase().includes(searchKeyword);
        const inSubItems = (c.subItems || []).some(s => 
          (s.name || '').toLowerCase().includes(searchKeyword) ||
          (s.prefix || '').toLowerCase().includes(searchKeyword) ||
          (s.calculation || '').toLowerCase().includes(searchKeyword)
        );
        const inEntries = matchingCategoryIdsFromEntries ? matchingCategoryIdsFromEntries.has(c.id) : false;
        searchMatch = inPolicy || inUnit || inDetail || inName || inStat || inFormation || inManagement || inSubItems || inEntries;
      }

      if (c.policyProject) {
        policySums[c.policyProject] = (policySums[c.policyProject] || 0) + c.totalBudget;
      }
      if (pMatch && c.unitProject) {
        unitSums[c.unitProject] = (unitSums[c.unitProject] || 0) + c.totalBudget;
      }
      if (pMatch && uMatch && c.detailedProject) {
        detailSums[c.detailedProject] = (detailSums[c.detailedProject] || 0) + c.totalBudget;
        const catStats = getCategoryStats(c.id);
        if (catStats) {
          detailUsedSums[c.detailedProject] = (detailUsedSums[c.detailedProject] || 0) + (catStats.spent + catStats.planned);
        }
      }
      if (pMatch && uMatch && dMatch && c.statItem) {
        statSums[c.statItem] = (statSums[c.statItem] || 0) + c.totalBudget;
      }

      if (pMatch && uMatch && dMatch && sMatch && statusMatch && monthMatch && searchMatch) {
        tree.push(c);
      }
    }

    return {
      uniquePolicies: Object.keys(policySums).map(p => ({ value: p, suffix: `${formatN(policySums[p])}원` })),
      unitOptions: Object.keys(unitSums).map(u => ({ value: u, suffix: `${formatN(unitSums[u])}원` })),
      detailOptions: Object.keys(detailSums).map(d => {
        const total = detailSums[d] || 0;
        const used = detailUsedSums[d] || 0;
        const rate = total > 0 ? ((used / total) * 100).toFixed(1) : '0.0';
        return { value: d, suffix: `${formatN(total)}원 (${rate}%)` };
      }),
      statOptions: Object.keys(statSums).map(s => ({ value: s, suffix: `${formatN(statSums[s])}원` })),
      filteredCategoriesTree: tree
    };
  }, [categories, entries, policySet, unitSet, detailSet, statSet, filterStatus, monthNum, searchKeyword, matchingCategoryIdsFromEntries, getCategoryStats]);

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
    filterMonth, setFilterMonth,
    filterStatus, setFilterStatus,
    searchTerm, setSearchTerm,
    deferredSearchTerm: debouncedSearchTerm,
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
