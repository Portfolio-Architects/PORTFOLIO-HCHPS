'use client';

import { useCallback, useMemo } from 'react';
import { useGoogleSheet, useSheetCrud } from './useGoogleSheet';
import { Schedule, generateId } from '@/types';

const EMPTY_SCHEDULES: Schedule[] = [];

export function useSchedules() {
  const [schedules, setSchedules, loading] = useGoogleSheet<Schedule>(
    'SCHEDULES',
    'hchps-schedules',
    []
  );
  const { syncAdd, syncUpdate, syncDelete } = useSheetCrud<Schedule>('SCHEDULES');

  const schedulesByDateMap = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    for (const s of schedules) {
      let list = map.get(s.date);
      if (!list) {
        list = [];
        map.set(s.date, list);
      }
      list.push(s);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [schedules]);

  const addSchedule = useCallback((schedule: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newSchedule: Schedule = {
      ...schedule,
      id: generateId(),
      createdAt: now,
      updatedAt: now
    };
    setSchedules(prev => [newSchedule, ...prev]);
    syncAdd(newSchedule);
    return newSchedule;
  }, [setSchedules, syncAdd]);

  const updateSchedule = useCallback((id: string, updates: Partial<Schedule>) => {
    const updatedFields = { ...updates, updatedAt: new Date().toISOString() };
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...updatedFields } : s));
    syncUpdate(id, updatedFields);
  }, [setSchedules, syncUpdate]);

  const deleteSchedule = useCallback((id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
    syncDelete(id);
  }, [setSchedules, syncDelete]);

  // O(1) 특정 일자의 일정 가져오기
  const getSchedulesForDate = useCallback((dateStr: string) => {
    return schedulesByDateMap.get(dateStr) || EMPTY_SCHEDULES;
  }, [schedulesByDateMap]);

  const importCalendar = useCallback(async (params: { icsUrl?: string; rawIcs?: string }) => {
    const res = await fetch('/api/calendar/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (data.success) {
      // Data reload will be triggered via cloud sync or local reload
      return { success: true, count: data.importedCount || 0 };
    }
    return { success: false, error: data.error || '일정 가져오기에 실패했습니다.' };
  }, []);

  return {
    schedules,
    loading,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    getSchedulesForDate,
    importCalendar
  };
}

