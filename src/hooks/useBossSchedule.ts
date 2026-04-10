import { useState, useCallback, useEffect, useRef } from 'react';
import { useGoogleSheet, useSheetCrud } from './useGoogleSheet';

export interface BossScheduleEntry {
  id: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm 또는 문자열 설명
  endTime?: string;
  title: string;      // 회의명 또는 일정명
  location?: string;  // 장소
  attendees?: string; // 참석자
  createdAt: string;
  updatedAt: string;
}

export const useBossSchedule = () => {
  const [entries, setEntries, loading] = useGoogleSheet<BossScheduleEntry>('BOSS_SCHEDULE', 'hchps-boss-schedule', []);
  const { syncAdd, syncUpdate, syncDelete } = useSheetCrud<BossScheduleEntry>('BOSS_SCHEDULE');

  const addEntry = async (entry: Omit<BossScheduleEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newEntry: BossScheduleEntry = {
      ...entry,
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      createdAt: now,
      updatedAt: now,
    };
    setEntries(prev => [...prev, newEntry]);
    syncAdd(newEntry);
  };

  const updateEntry = async (id: string, updates: Partial<BossScheduleEntry>) => {
    const now = new Date().toISOString();
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates, updatedAt: now } : e));
    syncUpdate(id, { ...updates, updatedAt: now });
  };

  const deleteEntry = async (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    syncDelete(id);
  };

  const syncMultiple = async (parsedEntries: Omit<BossScheduleEntry, 'id' | 'createdAt' | 'updatedAt'>[]) => {
    const now = new Date().toISOString();
    const newEntries = parsedEntries.map(e => ({
      ...e,
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5) + Math.random().toString(36).substr(2, 5),
      createdAt: now,
      updatedAt: now,
    }));
    
    setEntries(prev => [...prev, ...newEntries]);
    for (const entry of newEntries) {
      syncAdd(entry);
    }
  };

  return {
    entries,
    loading,
    addEntry,
    updateEntry,
    deleteEntry,
    syncMultiple
  };
};
