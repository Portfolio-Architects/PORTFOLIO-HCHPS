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

  // Seeder for Budget Analysis
  useEffect(() => {
    if (typeof window !== 'undefined' && categories.length === 0 && !localStorage.getItem('hchps-budget-seeded-v7')) {
      localStorage.setItem('hchps-budget-seeded-v7', 'true');
      const defaults: Omit<BudgetCategory, 'id'>[] = [
        { name: '인력운영비 (기본 보수 등)', totalBudget: 20908048000, color: '#4A6CF7', policyProject: '행정운영경비', unitProject: '인력운영비', detailedProject: '기본 보수', statItem: '기본급' },
        { name: '기본경비 (부서운영)', totalBudget: 14876000, color: '#3B82F6', policyProject: '행정운영경비', unitProject: '기본경비', detailedProject: '부서운영 기본수용비', statItem: '일반수용비(210-01)' },
        { name: '보건소 운영지원 (청사유지)', totalBudget: 1805177000, color: '#F59E0B', policyProject: '건강증진', unitProject: '보건소 운영지원', detailedProject: '보건소 기능유지 및 청사관리', statItem: '일반수용비(210-01)' },
        { name: '건강증진사업관리 (의료비)', totalBudget: 16360000, color: '#FCD34D', policyProject: '건강증진', unitProject: '건강증진사업관리', detailedProject: '의료비 지원업무 추진', statItem: '사무관리비' },
        { name: '건강도시사업 활성화', totalBudget: 45860000, color: '#10B981', policyProject: '건강도시 조성', unitProject: '건강도시사업 활성화', detailedProject: '시민건강관리', statItem: '행사운영비' },
        { name: '건강생활 실천사업', totalBudget: 225502000, color: '#34D399', policyProject: '건강도시 조성', unitProject: '건강생활 실천사업', detailedProject: '지역사회 건강조사', statItem: '연구용역비' },
      ];
      defaults.forEach(d => addCategory(d));
    }
  }, [categories.length, addCategory]);



  const updateCategory = useCallback((id: string, updates: Partial<BudgetCategory>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    catCrud.syncUpdate(id, updates);
  }, [setCategories, catCrud]);

  const deleteCategory = useCallback((id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    setEntries(prev => prev.filter(e => e.categoryId !== id));
    catCrud.syncDelete(id);
  }, [setCategories, setEntries, catCrud]);

  // V10 Migration
  useEffect(() => {
    if (typeof window !== 'undefined' && categories.length > 0 && !localStorage.getItem('hchps-budget-seeded-v10')) {
      localStorage.setItem('hchps-budget-seeded-v10', 'true');
      
      // Delete all old corrupted categories
      categories.forEach(cat => {
        deleteCategory(cat.id);
      });
      
      // Inject ALL 6 precise unit projects to ensure they cascade perfectly under the 3 Policy Projects
      const fullDefaults: Omit<BudgetCategory, 'id'>[] = [
        { name: '행정운영경비 (인력운영비)', totalBudget: 20908048000, color: '#4A6CF7', policyProject: '행정운영경비', unitProject: '인력운영비', detailedProject: '기본 보수', statItem: '기본급' },
        { name: '행정운영경비 (기본경비)', totalBudget: 14876000, color: '#3B82F6', policyProject: '행정운영경비', unitProject: '기본경비', detailedProject: '부서운영 기본수용비', statItem: '일반수용비(210-01)' },
        { name: '건강증진 (보건소운영지원)', totalBudget: 1805177000, color: '#F59E0B', policyProject: '건강증진', unitProject: '보건소 운영지원', detailedProject: '보건소 기능유지 및 청사관리', statItem: '일반수용비(210-01)' },
        { name: '건강증진 (사업관리)', totalBudget: 16360000, color: '#FCD34D', policyProject: '건강증진', unitProject: '건강증진사업관리', detailedProject: '의료비 지원업무 추진', statItem: '사무관리비' },
        { name: '건강도시조성 (사업활성화)', totalBudget: 45860000, color: '#10B981', policyProject: '건강도시 조성', unitProject: '건강도시사업 활성화', detailedProject: '시민건강관리', statItem: '행사운영비' },
        { name: '건강도시조성 (실천사업)', totalBudget: 225502000, color: '#34D399', policyProject: '건강도시 조성', unitProject: '건강생활 실천사업', detailedProject: '지역사회 건강조사', statItem: '연구용역비' },
      ];
      fullDefaults.forEach(d => addCategory(d));
    }
  }, [categories, deleteCategory, addCategory]);

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

  // Stats per category
  const getCategoryStats = useCallback((categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return null;
    const catEntries = entries.filter(e => e.categoryId === categoryId);
    const spent = catEntries.filter(e => !e.isPlanned).reduce((sum, e) => sum + e.amount, 0);
    const planned = catEntries.filter(e => e.isPlanned).reduce((sum, e) => sum + e.amount, 0);
    const remaining = cat.totalBudget - spent;
    const usageRate = cat.totalBudget > 0 ? Math.round((spent / cat.totalBudget) * 100) : 0;
    return { totalBudget: cat.totalBudget, spent, planned, remaining, usageRate };
  }, [categories, entries]);

  // Overall stats
  const overallStats = useMemo(() => {
    const totalBudget = categories.reduce((sum, c) => sum + c.totalBudget, 0);
    const totalSpent = entries.filter(e => !e.isPlanned).reduce((sum, e) => sum + e.amount, 0);
    const totalPlanned = entries.filter(e => e.isPlanned).reduce((sum, e) => sum + e.amount, 0);
    return { totalBudget, totalSpent, totalPlanned, remaining: totalBudget - totalSpent };
  }, [categories, entries]);

  return { categories, entries, addCategory, updateCategory, deleteCategory, addEntry, updateEntry, deleteEntry, getCategoryStats, overallStats };
}
