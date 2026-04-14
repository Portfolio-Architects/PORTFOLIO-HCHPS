'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { readSheet, addRow, updateRow, deleteRow } from '@/lib/sheets-api';
import { BudgetCategory, BudgetEntry, generateId } from '@/types';

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
      const key = `${c.name}-${c.policyProject}-${c.unitProject}-${c.detailedProject}-${c.statItem}-${c.totalBudget}-${c.budgetType || '본예산'}`;
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
    mutationFn: ({ id, updates }: { id: string, updates: Partial<BudgetCategory> }) => updateRow('BUDGET_CATEGORIES', id, updates),
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
    mutationFn: ({ id, updates }: { id: string, updates: Partial<BudgetEntry> }) => updateRow('BUDGET_ENTRIES', id, updates),
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
    deleteEntryMut.mutate(id);
  }, [deleteEntryMut]);

  // Derived Stats
  const getCategoryStats = useCallback((categoryId: string) => {
    const cat = uniqueCategories.find(c => c.id === categoryId);
    if (!cat) return null;
    const catEntries = entries.filter(e => e.categoryId === categoryId);
    const generalSpent = catEntries.filter(e => !e.isPlanned && (!e.actionType || e.actionType === 'general')).reduce((sum, e) => sum + e.amount, 0);
    const dailyExpenseIssued = catEntries.filter(e => !e.isPlanned && e.actionType === 'issuance').reduce((sum, e) => sum + e.amount, 0);
    const dailyExpenseSpent = catEntries.filter(e => !e.isPlanned && e.actionType === 'daily_expense').reduce((sum, e) => sum + e.amount, 0);
    
    // 원인행위 (가배정) 한도액 = 진행 중(isSettled==false)인 품의서 금액 총합
    const planned = catEntries.filter(e => e.isPlanned && !e.isSettled).reduce((sum, e) => sum + e.amount, 0);
    
    const spent = generalSpent + dailyExpenseIssued;
    const remaining = cat.totalBudget - spent - planned; // 남은 진짜 잔액 = 총예산 - 결제완료지출 - 묶인금액(가배정)
    const dailyExpenseRemaining = dailyExpenseIssued - dailyExpenseSpent;
    
    const usageRate = cat.totalBudget > 0 ? ((spent + planned) / cat.totalBudget) * 100 : 0;
    
    return { 
      totalBudget: cat.totalBudget, 
      spent, 
      planned, 
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
    const generalSpent = entries.filter(e => !e.isPlanned && (!e.actionType || e.actionType === 'general')).reduce((sum, e) => sum + e.amount, 0);
    const dailyExpenseIssued = entries.filter(e => !e.isPlanned && e.actionType === 'issuance').reduce((sum, e) => sum + e.amount, 0);
    const dailyExpenseSpent = entries.filter(e => !e.isPlanned && e.actionType === 'daily_expense').reduce((sum, e) => sum + e.amount, 0);
    const totalPlanned = entries.filter(e => e.isPlanned && !e.isSettled).reduce((sum, e) => sum + e.amount, 0);
    
    const totalSpent = generalSpent + dailyExpenseIssued;
    
    return { 
      totalBudget, 
      totalSpent, 
      totalPlanned, 
      remaining: totalBudget - totalSpent - totalPlanned,
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
    overallStats 
  };
}
