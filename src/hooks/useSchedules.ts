'use client';

import { useCallback } from 'react';
import { useGoogleSheet, useSheetCrud } from './useGoogleSheet';
import { Schedule, generateId } from '@/types';

export function useSchedules() {
  const [schedules, setSchedules, loading] = useGoogleSheet<Schedule>(
    'SCHEDULES',
    'hchps-schedules',
    []
  );
  const { syncAdd, syncUpdate, syncDelete } = useSheetCrud<Schedule>('SCHEDULES');

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

  // 특정 일자의 일정을 정렬하여 가져오기
  const getSchedulesForDate = useCallback((dateStr: string) => {
    return schedules
      .filter(s => s.date === dateStr)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [schedules]);

  return {
    schedules,
    loading,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    getSchedulesForDate
  };
}
