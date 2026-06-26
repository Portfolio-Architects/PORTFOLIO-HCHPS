'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { readSheet, addRow, updateRow, deleteRow, replaceAll } from '@/lib/sheets-api';
import { BudgetCategory, BudgetEntry, generateId } from '@/types';

let kvWriteQueue = Promise.resolve<any>(null);

function enqueueKvWrite<T>(fn: () => Promise<T>): Promise<T> {
  const p = kvWriteQueue.then(() => 
    fn()
      .then(res => new Promise<T>(resolve => setTimeout(() => resolve(res), 300)))
      .catch(err => new Promise<never>((_, reject) => setTimeout(() => reject(err), 300)))
  );
  kvWriteQueue = p.catch(() => null); // Prevent queue from dying on error
  return p;
}

export function useBudget() {
  const queryClient = useQueryClient();

  const { data: rawCategories = [], isLoading: catLoading } = useQuery({
    queryKey: ['BUDGET_CATEGORIES'],
    queryFn: () => readSheet<BudgetCategory>('BUDGET_CATEGORIES'),
    staleTime: 1000 * 60 * 5,
  });

  const { data: entries = [], isLoading: entryLoading } = useQuery({
    queryKey: ['BUDGET_ENTRIES'],
    queryFn: () => readSheet<BudgetEntry>('BUDGET_ENTRIES'),
    staleTime: 1000 * 60 * 5,
  });

  // Deduplicate categories based on a composite key to prevent double-counting
  // FIX: Include 'name' in the key to prevent merging distinct categories
  const uniqueCategories = useMemo(() => {
    const seen = new Set();
    return rawCategories.filter(c => {
      const key = `${c.name}-${c.policyProject}-${c.unitProject}-${c.detailedProject}-${c.statItem}-${c.budgetType || '본예산'}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rawCategories]);

  // ================= Category Mutations =================
  const addCategoryMut = useMutation({
    mutationFn: (newCat: BudgetCategory) => addRow('BUDGET_CATEGORIES', newCat),
    onMutate: async (newCat) => {
      await queryClient.cancelQueries({ queryKey: ['BUDGET_CATEGORIES'] });
      const previous = queryClient.getQueryData<BudgetCategory[]>(['BUDGET_CATEGORIES']);
      queryClient.setQueryData<BudgetCategory[]>(['BUDGET_CATEGORIES'], (old) => [...(old || []), newCat]);
      return { previous };
    },
    onError: (err, newCat, context) => {
      if (context?.previous) queryClient.setQueryData(['BUDGET_CATEGORIES'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['BUDGET_CATEGORIES'] })
  });

  const updateCategoryMut = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<BudgetCategory> }) => {
      // E2EE requires full payload replacement. Merge frontend state first.
      const existing = queryClient.getQueryData<BudgetCategory[]>(['BUDGET_CATEGORIES'])?.find(c => c.id === id);
      if (!existing) throw new Error("Item not found in cache");
      const fullItem = { ...existing, ...updates };
      return enqueueKvWrite(() => updateRow('BUDGET_CATEGORIES', id, fullItem));
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['BUDGET_CATEGORIES'] });
      const previous = queryClient.getQueryData<BudgetCategory[]>(['BUDGET_CATEGORIES']);
      queryClient.setQueryData<BudgetCategory[]>(['BUDGET_CATEGORIES'], (old) => (old || []).map(c => c.id === id ? { ...c, ...updates } : c));
      return { previous };
    },
    onError: (err, vars, context) => {
      if (context?.previous) queryClient.setQueryData(['BUDGET_CATEGORIES'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['BUDGET_CATEGORIES'] })
  });

  const deleteCategoryMut = useMutation({
    mutationFn: (id: string) => deleteRow('BUDGET_CATEGORIES', id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['BUDGET_CATEGORIES'] });
      const previous = queryClient.getQueryData<BudgetCategory[]>(['BUDGET_CATEGORIES']);
      queryClient.setQueryData<BudgetCategory[]>(['BUDGET_CATEGORIES'], (old) => (old || []).filter(c => c.id !== id));
      return { previous };
    },
    onError: (err, id, context) => {
      if (context?.previous) queryClient.setQueryData(['BUDGET_CATEGORIES'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['BUDGET_CATEGORIES'] })
  });

  const replaceCategoriesMut = useMutation({
    mutationFn: (newCategories: BudgetCategory[]) => replaceAll('BUDGET_CATEGORIES', newCategories),
    onMutate: async (newCategories) => {
      await queryClient.cancelQueries({ queryKey: ['BUDGET_CATEGORIES'] });
      const previous = queryClient.getQueryData<BudgetCategory[]>(['BUDGET_CATEGORIES']);
      queryClient.setQueryData<BudgetCategory[]>(['BUDGET_CATEGORIES'], newCategories);
      return { previous };
    },
    onError: (err, newCategories, context) => {
      if (context?.previous) queryClient.setQueryData(['BUDGET_CATEGORIES'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['BUDGET_CATEGORIES'] })
  });

  // ================= Entry Mutations =================
  const addEntryMut = useMutation({
    mutationFn: (newEntry: BudgetEntry) => addRow('BUDGET_ENTRIES', newEntry),
    onMutate: async (newEntry) => {
      await queryClient.cancelQueries({ queryKey: ['BUDGET_ENTRIES'] });
      const previous = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']);
      queryClient.setQueryData<BudgetEntry[]>(['BUDGET_ENTRIES'], (old) => [newEntry, ...(old || [])]);
      return { previous };
    },
    onError: (err, newEntry, context) => {
      if (context?.previous) queryClient.setQueryData(['BUDGET_ENTRIES'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['BUDGET_ENTRIES'] })
  });

  const updateEntryMut = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<BudgetEntry> }) => {
      // E2EE requires full payload replacement. Merge frontend state first.
      const existing = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES'])?.find(e => e.id === id);
      if (!existing) throw new Error("Item not found in cache");
      const fullItem = { ...existing, ...updates };
      return enqueueKvWrite(() => updateRow('BUDGET_ENTRIES', id, fullItem));
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['BUDGET_ENTRIES'] });
      const previous = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']);
      queryClient.setQueryData<BudgetEntry[]>(['BUDGET_ENTRIES'], (old) => (old || []).map(e => e.id === id ? { ...e, ...updates } : e));
      return { previous };
    },
    onError: (err, vars, context) => {
      if (context?.previous) queryClient.setQueryData(['BUDGET_ENTRIES'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['BUDGET_ENTRIES'] })
  });

  const deleteEntryMut = useMutation({
    mutationFn: (id: string) => deleteRow('BUDGET_ENTRIES', id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['BUDGET_ENTRIES'] });
      const previous = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']);
      queryClient.setQueryData<BudgetEntry[]>(['BUDGET_ENTRIES'], (old) => (old || []).filter(e => e.id !== id));
      return { previous };
    },
    onError: (err, id, context) => {
      if (context?.previous) queryClient.setQueryData(['BUDGET_ENTRIES'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['BUDGET_ENTRIES'] })
  });

  const replaceEntriesMut = useMutation({
    mutationFn: (newEntries: BudgetEntry[]) => replaceAll('BUDGET_ENTRIES', newEntries),
    onMutate: async (newEntries) => {
      await queryClient.cancelQueries({ queryKey: ['BUDGET_ENTRIES'] });
      const previous = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']);
      queryClient.setQueryData<BudgetEntry[]>(['BUDGET_ENTRIES'], newEntries);
      return { previous };
    },
    onError: (err, newEntries, context) => {
      if (context?.previous) queryClient.setQueryData(['BUDGET_ENTRIES'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['BUDGET_ENTRIES'] })
  });

  // Action Wrappers
  const addCategory = useCallback((cat: Omit<BudgetCategory, 'id'>) => {
    const newCat: BudgetCategory = { ...cat, id: generateId() };
    addCategoryMut.mutate(newCat);
    return newCat;
  }, [addCategoryMut]);

  const updateCategory = useCallback((id: string, updates: Partial<BudgetCategory>) => {
    updateCategoryMut.mutate({ id, updates });
  }, [updateCategoryMut]);

  const deleteCategory = useCallback((id: string) => {
    deleteCategoryMut.mutate(id);
    // Filter out associated entries and update with a single replace call to prevent cascading mutations and file-lock race conditions
    const remainingEntries = entries.filter(e => e.categoryId !== id);
    replaceEntriesMut.mutate(remainingEntries);
  }, [entries, deleteCategoryMut, replaceEntriesMut]);

  const replaceCategories = useCallback((newCategories: BudgetCategory[]) => {
    replaceCategoriesMut.mutate(newCategories);
  }, [replaceCategoriesMut]);

  // checkLimit and Entry mutations moved below getCategoryStats

  // Pre-calculate statistics Map for all unique categories to avoid O(N * M) overhead
  const categoryStatsMap = useMemo(() => {
    // Group entries by categoryId first for O(M) grouping
    const entriesMap = new Map<string, BudgetEntry[]>();
    for (const e of entries) {
      if (!entriesMap.has(e.categoryId)) {
        entriesMap.set(e.categoryId, []);
      }
      entriesMap.get(e.categoryId)!.push(e);
    }

    const statsMap = new Map<string, {
      totalBudget: number; spent: number; planned: number; locked: number; remaining: number; usageRate: number;
      generalSpent: number; dailyExpenseIssued: number; dailyExpenseSpent: number; dailyExpenseRemaining: number;
    }>();

    for (const cat of uniqueCategories) {
      const catEntries = entriesMap.get(cat.id) || [];
      
      let generalSpent = 0;
      let dailyExpenseIssued = 0;
      let dailyExpenseSpent = 0;
      let planned = 0;

      for (const e of catEntries) {
        if (e.isPlanned) {
          if (!e.isSettled) planned += e.amount;
        } else {
          if (!e.actionType || e.actionType === 'general' || e.actionType === 'correction' || e.actionType === 'transfer') {
            if (e.actionType === 'transfer') {
              if (e.transferDirection === 'out') generalSpent += e.amount;
              else generalSpent -= e.amount;
            } else {
              generalSpent += e.amount;
            }
          } else if (e.actionType === 'issuance') {
            dailyExpenseIssued += e.amount;
          } else if (e.actionType === 'daily_expense') {
            dailyExpenseSpent += e.amount;
          }
        }
      }

      const spent = generalSpent + dailyExpenseIssued;
      
      let lockedAmount = 0;
      if (cat.subItems) {
        for (const sub of cat.subItems) {
          if (sub.isLocked) {
            lockedAmount += sub.amount;
          } else if (sub.calculations) {
            for (const calc of sub.calculations) {
              if (calc.isLocked) lockedAmount += calc.amount;
            }
          }
        }
      }

      const remaining = cat.totalBudget - spent - planned - lockedAmount;
      const dailyExpenseRemaining = dailyExpenseIssued - dailyExpenseSpent;
      const usageRate = cat.totalBudget > 0 ? ((spent + planned) / cat.totalBudget) * 100 : 0;

      statsMap.set(cat.id, {
        totalBudget: cat.totalBudget,
        spent,
        planned,
        locked: lockedAmount,
        remaining,
        usageRate,
        generalSpent,
        dailyExpenseIssued,
        dailyExpenseSpent,
        dailyExpenseRemaining
      });
    }

    return statsMap;
  }, [uniqueCategories, entries]);

  // Derived Stats
  const getCategoryStats = useCallback((categoryId: string, excludePlanned = false) => {
    const cached = categoryStatsMap.get(categoryId);
    if (!cached) return null;
    if (!excludePlanned) return cached;

    const cat = uniqueCategories.find(c => c.id === categoryId);
    if (!cat) return null;
    const remaining = cat.totalBudget - cached.spent - cached.locked; 
    const usageRate = cat.totalBudget > 0 ? (cached.spent / cat.totalBudget) * 100 : 0;
    return {
      ...cached,
      planned: 0,
      remaining,
      usageRate
    };
  }, [categoryStatsMap, uniqueCategories]);

  const checkLimit = useCallback((categoryId: string, amount: number, actionType?: string, entryId?: string, transferDirection?: string) => {
    if (actionType === 'correction') return true;
    if (actionType === 'transfer' && transferDirection !== 'out') return true;
    
    const stats = getCategoryStats(categoryId);
    if (!stats) return true;
    
    let oldAmount = 0;
    if (entryId) {
      const oldEntry = entries.find(e => e.id === entryId);
      if (oldEntry && oldEntry.categoryId === categoryId) {
        oldAmount = oldEntry.amount;
      }
    }
    const delta = amount - oldAmount;
    if (delta <= 0) return true;

    if (actionType === 'daily_expense') {
      if (delta > stats.dailyExpenseRemaining) {
        alert(`[일상경비 한도 초과] 등록하려는 금액이 일상경비 잔액(${stats.dailyExpenseRemaining.toLocaleString()}원)을 초과하여 등록을 차단합니다.`);
        return false;
      }
    } else {
      if (delta > stats.remaining) {
        alert(`[예산 한도 초과] 등록하려는 금액이 가용 예산 잔액(${stats.remaining.toLocaleString()}원)을 초과하여 등록을 차단합니다.`);
        return false;
      }
    }
    return true;
  }, [entries, getCategoryStats]);

  const addEntry = useCallback((entry: Omit<BudgetEntry, 'id'>) => {
    if (!checkLimit(entry.categoryId, entry.amount, entry.actionType, undefined, entry.transferDirection)) {
      return null;
    }
    const newEntry: BudgetEntry = { ...entry, id: generateId() };
    addEntryMut.mutate(newEntry);
    return newEntry;
  }, [addEntryMut, checkLimit]);

  const updateEntry = useCallback((id: string, updates: Partial<BudgetEntry>) => {
    const existing = entries.find(e => e.id === id);
    if (existing) {
      const targetCatId = updates.categoryId || existing.categoryId;
      const targetAmount = updates.amount !== undefined ? updates.amount : existing.amount;
      const targetActionType = updates.actionType || existing.actionType;
      const targetTransferDir = updates.transferDirection !== undefined ? updates.transferDirection : existing.transferDirection;
      
      if (!checkLimit(targetCatId, targetAmount, targetActionType, id, targetTransferDir)) {
        return;
      }
    }
    updateEntryMut.mutate({ id, updates });
  }, [updateEntryMut, entries, checkLimit]);

  const deleteEntry = useCallback((id: string) => {
    const entryToDelete = entries.find(e => e.id === id);
    if (entryToDelete && entryToDelete.isPlanned) {
      const hasSettledChildren = entries.some(e => e.relatedPlanId === id);
      if (hasSettledChildren) {
        alert('이 품의서(원인행위)에 연결된 실제 지출 내역이 존재하여 삭제할 수 없습니다. 연결된 지출 내역을 먼저 삭제하거나 수정해주세요.');
        return;
      }
    }
    deleteEntryMut.mutate(id);
  }, [deleteEntryMut, entries]);

  const overallStats = useMemo(() => {
    const totalBudget = uniqueCategories.reduce((sum, c) => sum + c.totalBudget, 0);
    const generalSpent = entries.filter(e => !e.isPlanned && (!e.actionType || e.actionType === 'general' || e.actionType === 'correction' || e.actionType === 'transfer')).reduce((sum, e) => {
      if (e.actionType === 'transfer') return sum - e.amount;
      return sum + e.amount;
    }, 0);
    const dailyExpenseIssued = entries.filter(e => !e.isPlanned && e.actionType === 'issuance').reduce((sum, e) => sum + e.amount, 0);
    const dailyExpenseSpent = entries.filter(e => !e.isPlanned && e.actionType === 'daily_expense').reduce((sum, e) => sum + e.amount, 0);
    const totalPlanned = entries.filter(e => e.isPlanned && !e.isSettled).reduce((sum, e) => sum + e.amount, 0);
    
    const totalSpent = generalSpent + dailyExpenseIssued;
    
    let totalLocked = 0;
    uniqueCategories.forEach(cat => {
      if (cat.subItems) {
        cat.subItems.forEach(sub => {
           if (sub.isLocked) {
             totalLocked += sub.amount;
           } else if (sub.calculations) {
             sub.calculations.forEach(calc => {
               if (calc.isLocked) totalLocked += calc.amount;
             });
           }
        });
      }
    });
    
    return { 
      totalBudget, 
      totalSpent, 
      totalPlanned, 
      totalLocked,
      remaining: totalBudget - totalSpent - totalPlanned - totalLocked,
      dailyExpenseIssued,
      dailyExpenseSpent,
      dailyExpenseRemaining: dailyExpenseIssued - dailyExpenseSpent
    };
  }, [uniqueCategories, entries]);

  const overallStatsActual = useMemo(() => {
    const totalBudget = uniqueCategories.reduce((sum, c) => sum + c.totalBudget, 0);
    const filteredEntries = entries.filter(e => !e.isPlanned);
    const generalSpent = filteredEntries.filter(e => !e.isPlanned && (!e.actionType || e.actionType === 'general' || e.actionType === 'correction' || e.actionType === 'transfer')).reduce((sum, e) => {
      if (e.actionType === 'transfer') return sum - e.amount;
      return sum + e.amount;
    }, 0);
    const dailyExpenseIssued = filteredEntries.filter(e => !e.isPlanned && e.actionType === 'issuance').reduce((sum, e) => sum + e.amount, 0);
    const dailyExpenseSpent = filteredEntries.filter(e => !e.isPlanned && e.actionType === 'daily_expense').reduce((sum, e) => sum + e.amount, 0);
    const totalPlanned = 0;
    
    const totalSpent = generalSpent + dailyExpenseIssued;
    
    let totalLocked = 0;
    uniqueCategories.forEach(cat => {
      if (cat.subItems) {
        cat.subItems.forEach(sub => {
           if (sub.isLocked) {
             totalLocked += sub.amount;
           } else if (sub.calculations) {
             sub.calculations.forEach(calc => {
               if (calc.isLocked) totalLocked += calc.amount;
             });
           }
        });
      }
    });
    
    return { 
      totalBudget, 
      totalSpent, 
      totalPlanned, 
      totalLocked,
      remaining: totalBudget - totalSpent - totalPlanned - totalLocked,
      dailyExpenseIssued,
      dailyExpenseSpent,
      dailyExpenseRemaining: dailyExpenseIssued - dailyExpenseSpent
    };
  }, [uniqueCategories, entries]);

  return { 
    categories: uniqueCategories, 
    entries, 
    isLoading: catLoading || entryLoading,
    addCategory, 
    updateCategory, 
    deleteCategory, 
    replaceCategories,
    addEntry, 
    updateEntry, 
    deleteEntry, 
    getCategoryStats, 
    checkLimit,
    overallStats,
    overallStatsActual
  };
}
