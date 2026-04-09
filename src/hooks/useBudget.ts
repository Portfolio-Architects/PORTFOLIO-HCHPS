'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useGoogleSheet, useSheetCrud } from './useGoogleSheet';
import { BudgetCategory, BudgetEntry, generateId } from '@/types';

export function useBudget() {
  const [categories, setCategories] = useGoogleSheet<BudgetCategory>('BUDGET_CATEGORIES', 'hchps-budget-categories', []);
  const [entries, setEntries] = useGoogleSheet<BudgetEntry>('BUDGET_ENTRIES', 'hchps-budget-entries', []);
  const catCrud = useSheetCrud<BudgetCategory>('BUDGET_CATEGORIES');
  const entryCrud = useSheetCrud<BudgetEntry>('BUDGET_ENTRIES');

  // Category CRUD
  const addCategory = useCallback((cat: Omit<BudgetCategory, 'id'>) => {
    const newCat: BudgetCategory = { ...cat, id: generateId() };
    setCategories(prev => [...prev, newCat]);
    catCrud.syncAdd(newCat);
    return newCat;
  }, [setCategories, catCrud]);

  // Seeder logic removed due to conflict with BudgetDashboard factory reset.

  const updateCategory = useCallback((id: string, updates: Partial<BudgetCategory>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    catCrud.syncUpdate(id, updates);
  }, [setCategories, catCrud]);

  const deleteCategory = useCallback((id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    setEntries(prev => prev.filter(e => e.categoryId !== id));
    catCrud.syncDelete(id);
  }, [setCategories, setEntries, catCrud]);

  // V13 migration logic removed due to conflict with manual factory reset.


  // Entry CRUD
  const addEntry = useCallback((entry: Omit<BudgetEntry, 'id'>) => {
    const newEntry: BudgetEntry = { ...entry, id: generateId() };
    setEntries(prev => [newEntry, ...prev]);
    entryCrud.syncAdd(newEntry);
    return newEntry;
  }, [setEntries, entryCrud]);

  const updateEntry = useCallback((id: string, updates: Partial<BudgetEntry>) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    entryCrud.syncUpdate(id, updates);
  }, [setEntries, entryCrud]);

  const deleteEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    entryCrud.syncDelete(id);
  }, [setEntries, entryCrud]);

  // Deduplicate categories based on a composite key to prevent double-counting when migrating/importing
  const uniqueCategories = useMemo(() => {
    const seen = new Set();
    return categories.filter(c => {
      // Create a unique key that represents a distinct row
      const key = `${c.policyProject}-${c.unitProject}-${c.detailedProject}-${c.statItem}-${c.totalBudget}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [categories]);

  // Stats per category
  const getCategoryStats = useCallback((categoryId: string) => {
    const cat = uniqueCategories.find(c => c.id === categoryId);
    if (!cat) return null;
    const catEntries = entries.filter(e => e.categoryId === categoryId);
    const spent = catEntries.filter(e => !e.isPlanned).reduce((sum, e) => sum + e.amount, 0);
    const planned = catEntries.filter(e => e.isPlanned).reduce((sum, e) => sum + e.amount, 0);
    const remaining = cat.totalBudget - spent;
    const usageRate = cat.totalBudget > 0 ? Math.round((spent / cat.totalBudget) * 100) : 0;
    return { totalBudget: cat.totalBudget, spent, planned, remaining, usageRate };
  }, [uniqueCategories, entries]);

  // Overall stats
  const overallStats = useMemo(() => {
    const totalBudget = uniqueCategories.reduce((sum, c) => sum + c.totalBudget, 0);
    const totalSpent = entries.filter(e => !e.isPlanned).reduce((sum, e) => sum + e.amount, 0);
    const totalPlanned = entries.filter(e => e.isPlanned).reduce((sum, e) => sum + e.amount, 0);
    return { totalBudget, totalSpent, totalPlanned, remaining: totalBudget - totalSpent };
  }, [uniqueCategories, entries]);

  return { categories: uniqueCategories, entries, addCategory, updateCategory, deleteCategory, addEntry, updateEntry, deleteEntry, getCategoryStats, overallStats };
}
