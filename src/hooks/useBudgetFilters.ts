 
import { useState, useEffect, useMemo, useCallback, useSyncExternalStore } from 'react';
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

interface SavedBudgetFilters {
  policy: string[];
  unit: string[];
  detail: string[];
  stat: string[];
  month: string;
  status: string;
}

const DEFAULT_SAVED_FILTERS: SavedBudgetFilters = {
  policy: [],
  unit: [],
  detail: [],
  stat: [],
  month: '전체',
  status: '전체'
};

let cachedFiltersJson = '';
let cachedFilters: SavedBudgetFilters = DEFAULT_SAVED_FILTERS;

const subscribeFiltersStorage = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === 'hchps-budget-filters-v2' || !e.key) callback();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
};

const getFiltersSnapshot = (): SavedBudgetFilters => {
  if (typeof window === 'undefined') return DEFAULT_SAVED_FILTERS;
  const saved = localStorage.getItem('hchps-budget-filters-v2') || '';
  if (saved === cachedFiltersJson) return cachedFilters;
  cachedFiltersJson = saved;
  if (!saved) {
    cachedFilters = DEFAULT_SAVED_FILTERS;
    return DEFAULT_SAVED_FILTERS;
  }
  try {
    const parsed = JSON.parse(saved);
    cachedFilters = {
      policy: Array.isArray(parsed.policy) ? parsed.policy : [],
      unit: Array.isArray(parsed.unit) ? parsed.unit : [],
      detail: Array.isArray(parsed.detail) ? parsed.detail : [],
      stat: Array.isArray(parsed.stat) ? parsed.stat : [],
      month: typeof parsed.month === 'string' ? parsed.month : '전체',
      status: typeof parsed.status === 'string' ? parsed.status : '전체'
    };
    return cachedFilters;
  } catch {
    cachedFilters = DEFAULT_SAVED_FILTERS;
    return DEFAULT_SAVED_FILTERS;
  }
};

const getFiltersServerSnapshot = () => DEFAULT_SAVED_FILTERS;

export function useBudgetFilters(
  categories: BudgetCategory[],
  entries: BudgetEntry[],
  getCategoryStats: (id: string) => any
) {
  const savedFilters = useSyncExternalStore(subscribeFiltersStorage, getFiltersSnapshot, getFiltersServerSnapshot);

  const [filterPolicyState, setFilterPolicyState] = useState<string[] | null>(null);
  const [filterUnitState, setFilterUnitState] = useState<string[] | null>(null);
  const [filterDetailState, setFilterDetailState] = useState<string[] | null>(null);
  const [filterStatState, setFilterStatState] = useState<string[] | null>(null);
  const [filterMonthState, setFilterMonthState] = useState<string | null>(null);
  const [filterStatusState, setFilterStatusState] = useState<string | null>(null);

  const filterPolicy = filterPolicyState ?? savedFilters.policy;
  const filterUnit = filterUnitState ?? savedFilters.unit;
  const filterDetail = filterDetailState ?? savedFilters.detail;
  const filterStat = filterStatState ?? savedFilters.stat;
  const filterMonth = filterMonthState ?? savedFilters.month;
  const filterStatus = filterStatusState ?? savedFilters.status;

  const setFilterPolicy = useCallback((val: React.SetStateAction<string[]>) => {
    setFilterPolicyState(prev => {
      const cur = prev ?? savedFilters.policy;
      return typeof val === 'function' ? val(cur) : val;
    });
  }, [savedFilters.policy]);

  const setFilterUnit = useCallback((val: React.SetStateAction<string[]>) => {
    setFilterUnitState(prev => {
      const cur = prev ?? savedFilters.unit;
      return typeof val === 'function' ? val(cur) : val;
    });
  }, [savedFilters.unit]);

  const setFilterDetail = useCallback((val: React.SetStateAction<string[]>) => {
    setFilterDetailState(prev => {
      const cur = prev ?? savedFilters.detail;
      return typeof val === 'function' ? val(cur) : val;
    });
  }, [savedFilters.detail]);

  const setFilterStat = useCallback((val: React.SetStateAction<string[]>) => {
    setFilterStatState(prev => {
      const cur = prev ?? savedFilters.stat;
      return typeof val === 'function' ? val(cur) : val;
    });
  }, [savedFilters.stat]);

  const setFilterMonth = useCallback((val: React.SetStateAction<string>) => {
    setFilterMonthState(prev => {
      const cur = prev ?? savedFilters.month;
      return typeof val === 'function' ? val(cur) : val;
    });
  }, [savedFilters.month]);

  const setFilterStatus = useCallback((val: React.SetStateAction<string>) => {
    setFilterStatusState(prev => {
      const cur = prev ?? savedFilters.status;
      return typeof val === 'function' ? val(cur) : val;
    });
  }, [savedFilters.status]);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  const isLoaded = true;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 120);
    return () => clearTimeout(timer);
  }, [searchTerm]);

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
    setFilterPolicyState([]);
    setFilterUnitState([]);
    setFilterDetailState([]);
    setFilterStatState([]);
    setFilterMonthState('전체');
    setFilterStatusState('전체');
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

  // Pre-index category IDs matching selected month in O(Entries) time with zero Date allocation
  const categoryIdsMatchingMonth = useMemo(() => {
    if (monthNum === null) return null;
    const set = new Set<string>();
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (e.date) {
        const parts = e.date.split('-');
        if (parts.length >= 2) {
          const m = parseInt(parts[1], 10);
          if (m === monthNum) {
            set.add(e.categoryId);
          }
        }
      }
    }
    return set;
  }, [entries, monthNum]);

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

      // Month filter check: O(1) pre-indexed set lookup
      const monthMatch = categoryIdsMatchingMonth ? categoryIdsMatchingMonth.has(c.id) : true;

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
        let inSubItems = false;
        if (c.subItems) {
          for (let j = 0; j < c.subItems.length; j++) {
            const s = c.subItems[j];
            if (
              (s.name || '').toLowerCase().includes(searchKeyword) ||
              (s.prefix || '').toLowerCase().includes(searchKeyword) ||
              (s.calculation || '').toLowerCase().includes(searchKeyword)
            ) {
              inSubItems = true;
              break;
            }
          }
        }
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

    const policyKeys = Object.keys(policySums);
    const uniquePolicies = new Array(policyKeys.length);
    for (let i = 0; i < policyKeys.length; i++) {
      const p = policyKeys[i];
      uniquePolicies[i] = { value: p, suffix: `${formatN(policySums[p])}원` };
    }

    const unitKeys = Object.keys(unitSums);
    const unitOptions = new Array(unitKeys.length);
    for (let i = 0; i < unitKeys.length; i++) {
      const u = unitKeys[i];
      unitOptions[i] = { value: u, suffix: `${formatN(unitSums[u])}원` };
    }

    const detailKeys = Object.keys(detailSums);
    const detailOptions = new Array(detailKeys.length);
    for (let i = 0; i < detailKeys.length; i++) {
      const d = detailKeys[i];
      const total = detailSums[d] || 0;
      const used = detailUsedSums[d] || 0;
      const rate = total > 0 ? ((used / total) * 100).toFixed(1) : '0.0';
      detailOptions[i] = { value: d, suffix: `${formatN(total)}원 (${rate}%)` };
    }

    const statKeys = Object.keys(statSums);
    const statOptions = new Array(statKeys.length);
    for (let i = 0; i < statKeys.length; i++) {
      const s = statKeys[i];
      statOptions[i] = { value: s, suffix: `${formatN(statSums[s])}원` };
    }

    return {
      uniquePolicies,
      unitOptions,
      detailOptions,
      statOptions,
      filteredCategoriesTree: tree
    };
  }, [categories, policySet, unitSet, detailSet, statSet, filterStatus, searchKeyword, matchingCategoryIdsFromEntries, categoryIdsMatchingMonth, getCategoryStats]);

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
