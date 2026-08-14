'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useBudget } from '@/hooks/useBudget';
import { SimulationEntry, ProjectSimulationSummary, StatItemSimulationSummary, generateId } from '@/types';
import { FESTIVAL_PRESET_SIMULATION_ENTRIES } from '@/lib/presets/festival5DomainPreset';

const SIMULATION_STORAGE_KEY = 'hchps-budget-simulations';

export const FESTIVAL_PRESET_ENTRIES = FESTIVAL_PRESET_SIMULATION_ENTRIES;

// Realistic Test Preset Data (8 Health Center / AI Medihealth Project Expenditures)
export const TEST_PRESET_ENTRIES: Omit<SimulationEntry, 'id' | 'createdAt'>[] = [
  {
    name: 'AI 헬스체크업 결과 분석 키오스크 구매',
    detailedProject: '건강증진지원실 운영',
    statItem: '201-01 사무관리비',
    unitPrice: 3500000,
    quantity: 2,
    amount: 7000000,
    memo: '건강증진지원실 AI 메디헬스 결과지 자동 출력 및 분석 키오스크 2대',
  },
  {
    name: '스마트 짐 근골격계 측정 장비 교정 소모품',
    detailedProject: '건강증진지원실 운영',
    statItem: '201-01 사무관리비',
    unitPrice: 250000,
    quantity: 4,
    amount: 1000000,
    memo: 'AI 신체측정 센서 정밀 교정용 센서 패키지',
  },
  {
    name: 'AI 메디헬스 센터 안내 리플릿 2차 인쇄',
    detailedProject: '건강증진지원실 운영',
    statItem: '201-01 사무관리비',
    unitPrice: 1200,
    quantity: 2500,
    amount: 3000000,
    memo: '주민 배포용 AI 운동처방 가이드북 2,500부',
  },
  {
    name: '체력측정 전담요원 하반기 피복비',
    detailedProject: '강남체력인증센터 운영',
    statItem: '201-01 사무관리비',
    unitPrice: 150000,
    quantity: 6,
    amount: 900000,
    memo: '체력측정 전담요원 하반기 지자체 유니폼 지원',
  },
  {
    name: '야외 건강체험관 공공전기료 및 수수료',
    detailedProject: '건강증진지원실 운영',
    statItem: '201-02 공공운영비',
    unitPrice: 120000,
    quantity: 3,
    amount: 360000,
    memo: '체험관 시설 운영을 위한 공공요금 분납액',
  },
  {
    name: '주민 참여 AI 헬스케어 강좌 강사수당',
    detailedProject: '건강증진지원실 운영',
    statItem: '201-03 행사운영비',
    unitPrice: 250000,
    quantity: 8,
    amount: 2000000,
    memo: '외부 운동처방 전문의 특강 수당 (총 8회)',
  },
  {
    name: '바른자세 개선사업 관내 학교 현장 출장 여비',
    detailedProject: '건강증진지원실 운영',
    statItem: '202-01 국내여비',
    unitPrice: 20000,
    quantity: 15,
    amount: 300000,
    memo: '초중고 출장 검진 관리자 현장 출장여비',
  },
  {
    name: '건강생활실천 프로그램 홍보 물품 구매',
    detailedProject: '건강생활실천사업(건강증진)',
    statItem: '201-01 사무관리비',
    unitPrice: 4500,
    quantity: 1000,
    amount: 4500000,
    memo: '캠페인용 하반기 건강 밴드 및 텀블러',
  },
];

export interface UseBudgetSimulatorReturn {
  // Data State
  entries: SimulationEntry[];
  isLoading: boolean;

  // Filter States
  selectedDetailedProject: string;
  selectedStatItem: string;

  // Dynamic Options & Helpers
  availableDetailedProjects: string[];
  availableStatItems: string[];
  getDetailedProjects: () => string[];
  getStatItemsForProject: (detailedProject: string) => string[];
  setSelectedDetailedProject: (dp: string) => void;
  setSelectedStatItem: (st: string) => void;

  // CRUD Actions
  addEntry: (entry: Omit<SimulationEntry, 'id' | 'createdAt' | 'amount'> & { amount?: number }) => SimulationEntry;
  updateEntry: (id: string, partial: Partial<SimulationEntry>) => void;
  deleteEntry: (id: string) => void;
  resetEntries: () => void;
  loadTestPreset: () => void;
  loadFestivalPreset: () => void;

  // Aggregated Summaries
  projectSummaries: ProjectSimulationSummary[];
  statItemSummaries: StatItemSimulationSummary[];

  // Utilities
  resolveCategoryId: (detailedProject: string, statItem: string) => string | undefined;
}

export function useBudgetSimulator(): UseBudgetSimulatorReturn {
  const { categories, getCategoryStats, isLoading: budgetLoading } = useBudget();

  // Filter States
  const [selectedDetailedProject, setSelectedDetailedProject] = useState<string>('');
  const [selectedStatItem, setSelectedStatItem] = useState<string>('');

  // Simulation Entries State with SSR-safe localStorage Initialization
  const [entries, setEntries] = useState<SimulationEntry[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(SIMULATION_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed as SimulationEntry[];
        }
      } catch (err) {
        console.warn('[useBudgetSimulator] Failed to load simulation entries:', err);
      }
    }
    return [];
  });

  // Sync entries to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SIMULATION_STORAGE_KEY, JSON.stringify(entries));
      } catch (err) {
        console.warn('[useBudgetSimulator] Failed to save simulation entries:', err);
      }
    }
  }, [entries]);

  // 1. Resolve categoryId from detailedProject + statItem
  const resolveCategoryId = useCallback((detailedProject: string, statItem: string): string | undefined => {
    if (!detailedProject || !statItem || !categories) return undefined;
    const matched = categories.find(
      c => c.detailedProject === detailedProject && c.statItem === statItem
    );
    return matched?.id;
  }, [categories]);

  // 2. Extract Available Detailed Projects (Unique Set)
  const availableDetailedProjects = useMemo(() => {
    if (!categories) return [];
    const set = new Set<string>();
    categories.forEach(c => {
      if (c.detailedProject && c.detailedProject.trim()) {
        set.add(c.detailedProject.trim());
      }
    });
    return Array.from(set).sort();
  }, [categories]);

  // Helper: getDetailedProjects
  const getDetailedProjects = useCallback(() => {
    return availableDetailedProjects;
  }, [availableDetailedProjects]);

  // Helper: getStatItemsForProject
  const getStatItemsForProject = useCallback((dp: string) => {
    if (!categories) return [];
    const set = new Set<string>();
    categories.forEach(c => {
      if ((!dp || c.detailedProject === dp) && c.statItem && c.statItem.trim()) {
        set.add(c.statItem.trim());
      }
    });
    return Array.from(set).sort();
  }, [categories]);

  // 3. Extract Available Stat Items (Filtered by selectedDetailedProject)
  const availableStatItems = useMemo(() => {
    return getStatItemsForProject(selectedDetailedProject);
  }, [getStatItemsForProject, selectedDetailedProject]);

  // 4. CRUD Operations
  const addEntry = useCallback((
    rawInput: Omit<SimulationEntry, 'id' | 'createdAt' | 'amount'> & { amount?: number }
  ): SimulationEntry => {
    const unitPrice = rawInput.unitPrice || 0;
    const quantity = rawInput.quantity || 1;
    const computedAmount = rawInput.amount !== undefined 
      ? rawInput.amount 
      : unitPrice * quantity;
    
    const categoryId = rawInput.categoryId || resolveCategoryId(rawInput.detailedProject, rawInput.statItem);

    const newEntry: SimulationEntry = {
      ...rawInput,
      id: generateId(),
      unitPrice,
      quantity,
      amount: computedAmount,
      categoryId,
      createdAt: new Date().toISOString(),
    };

    setEntries(prev => [newEntry, ...prev]);
    return newEntry;
  }, [resolveCategoryId]);

  const updateEntry = useCallback((id: string, partial: Partial<SimulationEntry>) => {
    setEntries(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, ...partial };
      if (partial.unitPrice !== undefined || partial.quantity !== undefined) {
        const u = updated.unitPrice || 0;
        const q = updated.quantity || 1;
        updated.amount = u * q;
      }
      if (partial.detailedProject !== undefined || partial.statItem !== undefined) {
        updated.categoryId = resolveCategoryId(updated.detailedProject, updated.statItem);
      }
      return updated;
    }));
  }, [resolveCategoryId]);

  const deleteEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(item => item.id !== id));
  }, []);

  const resetEntries = useCallback(() => {
    setEntries([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SIMULATION_STORAGE_KEY);
    }
  }, []);

  const loadTestPreset = useCallback(() => {
    const presetEntriesWithIds: SimulationEntry[] = TEST_PRESET_ENTRIES.map(item => ({
      ...item,
      id: generateId(),
      categoryId: resolveCategoryId(item.detailedProject, item.statItem),
      createdAt: new Date().toISOString(),
    }));
    setEntries(presetEntriesWithIds);
  }, [resolveCategoryId]);

  const loadFestivalPreset = useCallback(() => {
    const presetEntriesWithIds: SimulationEntry[] = FESTIVAL_PRESET_SIMULATION_ENTRIES.map(item => ({
      ...item,
      id: generateId(),
      categoryId: resolveCategoryId(item.detailedProject, item.statItem),
      createdAt: new Date().toISOString(),
    }));
    setEntries(presetEntriesWithIds);
  }, [resolveCategoryId]);

  // 5. Calculate Real-Time Memoized Summaries (projectSummaries & statItemSummaries)
  const projectSummaries = useMemo<ProjectSimulationSummary[]>(() => {
    if (!categories) return [];

    const map = new Map<string, {
      totalBudget: number;
      currentSpent: number;
      simulatedExpenditure: number;
    }>();

    // Initialize with existing categories
    categories.forEach(cat => {
      const dp = cat.detailedProject || '기타';
      if (!map.has(dp)) {
        map.set(dp, { totalBudget: 0, currentSpent: 0, simulatedExpenditure: 0 });
      }
      const stats = getCategoryStats(cat.id);
      const target = map.get(dp)!;
      target.totalBudget += cat.totalBudget || 0;
      target.currentSpent += stats?.spent || 0;
    });

    // Add simulation entries
    entries.forEach(entry => {
      const dp = entry.detailedProject || '기타';
      if (!map.has(dp)) {
        map.set(dp, { totalBudget: 0, currentSpent: 0, simulatedExpenditure: 0 });
      }
      const target = map.get(dp)!;
      target.simulatedExpenditure += entry.amount || 0;
    });

    // Convert map to summary objects
    const results: ProjectSimulationSummary[] = [];
    map.forEach((val, dp) => {
      const currentRemaining = val.totalBudget - val.currentSpent;
      const finalExpectedBalance = currentRemaining - val.simulatedExpenditure;
      const executionRate = val.totalBudget > 0 
        ? ((val.currentSpent + val.simulatedExpenditure) / val.totalBudget) * 100 
        : 0;
      
      results.push({
        detailedProject: dp,
        totalBudget: val.totalBudget,
        currentSpent: val.currentSpent,
        currentRemaining,
        simulatedExpenditure: val.simulatedExpenditure,
        finalExpectedBalance,
        executionRate,
        isDeficit: finalExpectedBalance < 0,
      });
    });

    return results.sort((a, b) => a.detailedProject.localeCompare(b.detailedProject));
  }, [categories, getCategoryStats, entries]);

  const statItemSummaries = useMemo<StatItemSimulationSummary[]>(() => {
    if (!categories) return [];

    const map = new Map<string, {
      statItem: string;
      detailedProject: string;
      totalBudget: number;
      currentSpent: number;
      simulatedExpenditure: number;
    }>();

    // Key format: `${dp}::${st}`
    categories.forEach(cat => {
      const dp = cat.detailedProject || '기타';
      const st = cat.statItem || '일반';
      const key = `${dp}::${st}`;

      if (!map.has(key)) {
        map.set(key, {
          statItem: st,
          detailedProject: dp,
          totalBudget: 0,
          currentSpent: 0,
          simulatedExpenditure: 0,
        });
      }
      const stats = getCategoryStats(cat.id);
      const target = map.get(key)!;
      target.totalBudget += cat.totalBudget || 0;
      target.currentSpent += stats?.spent || 0;
    });

    // Add simulation entries
    entries.forEach(entry => {
      const dp = entry.detailedProject || '기타';
      const st = entry.statItem || '일반';
      const key = `${dp}::${st}`;

      if (!map.has(key)) {
        map.set(key, {
          statItem: st,
          detailedProject: dp,
          totalBudget: 0,
          currentSpent: 0,
          simulatedExpenditure: 0,
        });
      }
      const target = map.get(key)!;
      target.simulatedExpenditure += entry.amount || 0;
    });

    // Convert map to summary objects
    const results: StatItemSimulationSummary[] = [];
    map.forEach((val) => {
      const currentRemaining = val.totalBudget - val.currentSpent;
      const finalExpectedBalance = currentRemaining - val.simulatedExpenditure;

      results.push({
        statItem: val.statItem,
        detailedProject: val.detailedProject,
        totalBudget: val.totalBudget,
        currentSpent: val.currentSpent,
        currentRemaining,
        simulatedExpenditure: val.simulatedExpenditure,
        finalExpectedBalance,
        isDeficit: finalExpectedBalance < 0,
      });
    });

    return results.sort((a, b) => {
      const dpComp = a.detailedProject.localeCompare(b.detailedProject);
      if (dpComp !== 0) return dpComp;
      return a.statItem.localeCompare(b.statItem);
    });
  }, [categories, getCategoryStats, entries]);

  return {
    entries,
    isLoading: budgetLoading,
    selectedDetailedProject,
    selectedStatItem,
    availableDetailedProjects,
    availableStatItems,
    getDetailedProjects,
    getStatItemsForProject,
    setSelectedDetailedProject,
    setSelectedStatItem,
    addEntry,
    updateEntry,
    deleteEntry,
    resetEntries,
    loadTestPreset,
    loadFestivalPreset,
    projectSummaries,
    statItemSummaries,
    resolveCategoryId,
  };
}
