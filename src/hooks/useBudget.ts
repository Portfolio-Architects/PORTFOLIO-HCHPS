'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { readSheet, addRow, updateRow, deleteRow } from '@/lib/sheets-api';
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
    // Also delete associated entries to match legacy behavior
    const entriesToDelete = entries.filter(e => e.categoryId === id);
    entriesToDelete.forEach(e => deleteEntryMut.mutate(e.id));
  }, [entries, deleteCategoryMut, deleteEntryMut]);

  const addEntry = useCallback((entry: Omit<BudgetEntry, 'id'>) => {
    const newEntry: BudgetEntry = { ...entry, id: generateId() };
    addEntryMut.mutate(newEntry);
    return newEntry;
  }, [addEntryMut]);

  const updateEntry = useCallback((id: string, updates: Partial<BudgetEntry>) => {
    updateEntryMut.mutate({ id, updates });
  }, [updateEntryMut]);

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

  // Derived Stats
  const getCategoryStats = useCallback((categoryId: string, excludePlanned = false) => {
    const cat = uniqueCategories.find(c => c.id === categoryId);
    if (!cat) return null;
    const catEntries = entries.filter(e => e.categoryId === categoryId);
    const filteredCatEntries = excludePlanned ? catEntries.filter(e => !e.isPlanned) : catEntries;

    const generalSpent = filteredCatEntries.filter(e => !e.isPlanned && (!e.actionType || e.actionType === 'general' || e.actionType === 'correction' || e.actionType === 'transfer')).reduce((sum, e) => {
      if (e.actionType === 'transfer') return sum - e.amount;
      return sum + e.amount;
    }, 0);
    const dailyExpenseIssued = filteredCatEntries.filter(e => !e.isPlanned && e.actionType === 'issuance').reduce((sum, e) => sum + e.amount, 0);
    const dailyExpenseSpent = filteredCatEntries.filter(e => !e.isPlanned && e.actionType === 'daily_expense').reduce((sum, e) => sum + e.amount, 0);
    
    // 원인행위 (가배정) 한도액 = 진행 중(isSettled==false)인 품의서 금액 총합
    const planned = filteredCatEntries.filter(e => e.isPlanned && !e.isSettled).reduce((sum, e) => sum + e.amount, 0);
    
    const spent = generalSpent + dailyExpenseIssued;
    // 예산 차단(사용 방지)된 세부 산출내역 금액 계산
    let lockedAmount = 0;
    if (cat.subItems) {
      cat.subItems.forEach(sub => {
         if (sub.isLocked) {
           lockedAmount += sub.amount;
         } else if (sub.calculations) {
           sub.calculations.forEach(calc => {
             if (calc.isLocked) lockedAmount += calc.amount;
           });
         }
      });
    }
    
    // 남은 진짜 잔액 = 총예산 - 결제완료지출 - 묶인금액(가배정) - 사용불가/잠김 금액(lockedAmount)
    const remaining = cat.totalBudget - spent - planned - lockedAmount; 
    const dailyExpenseRemaining = dailyExpenseIssued - dailyExpenseSpent;
    
    const usageRate = cat.totalBudget > 0 ? ((spent + planned) / cat.totalBudget) * 100 : 0;
    
    return { 
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
    };
  }, [uniqueCategories, entries]);

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
    addEntry, 
    updateEntry, 
    deleteEntry, 
    getCategoryStats, 
    overallStats,
    overallStatsActual
  };
}
