'use client';

import { useState, useCallback, useMemo } from 'react';
import { useGoogleSheet, useSheetCrud } from './useGoogleSheet';
import { KnowledgeEntry, generateId } from '@/types';

export function useKnowledge() {
  const [entries, setEntries] = useGoogleSheet<KnowledgeEntry>('KNOWLEDGE', 'hchps-knowledge', []);
  const { syncAdd, syncUpdate, syncDelete } = useSheetCrud<KnowledgeEntry>('KNOWLEDGE');

  const addKnowledge = useCallback((entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newEntry: KnowledgeEntry = { ...entry, id: generateId(), createdAt: now, updatedAt: now };
    setEntries(prev => [newEntry, ...prev]);
    syncAdd(newEntry);
    return newEntry;
  }, [setEntries, syncAdd]);

  const updateKnowledge = useCallback((id: string, updates: Partial<KnowledgeEntry>) => {
    const updatedFields = { ...updates, updatedAt: new Date().toISOString() };
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updatedFields } : e));
    syncUpdate(id, updatedFields);
  }, [setEntries, syncUpdate]);

  const deleteKnowledge = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    syncDelete(id);
  }, [setEntries, syncDelete]);

  const filterKnowledge = useCallback((filters: { search?: string; category?: string; tag?: string }) => {
    return (entries || []).filter(e => {
      if (filters.category && e.category !== filters.category) return false;
      if (filters.tag && !e.tags.includes(filters.tag)) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!e.title.toLowerCase().includes(s) && 
            !e.content.toLowerCase().includes(s) && 
            !e.tags.some(tag => tag.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [entries]);

  // Extract all unique categories and tags for filter UI
  const metadata = useMemo(() => {
    const categories = new Set<string>();
    const tags = new Set<string>();
    for (const e of (entries || [])) {
      if (e.category) categories.add(e.category);
      e.tags.forEach(t => tags.add(t));
    }
    return {
      categories: Array.from(categories).sort(),
      tags: Array.from(tags).sort()
    };
  }, [entries]);

  return { entries, addKnowledge, updateKnowledge, deleteKnowledge, filterKnowledge, metadata };
}
