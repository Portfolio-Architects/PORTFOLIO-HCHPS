'use client';

import { useCallback } from 'react';
import { useGoogleSheet, useSheetCrud } from './useGoogleSheet';
import { Meeting, generateId } from '@/types';

export function useMeetings() {
  const [meetings, setMeetings] = useGoogleSheet<Meeting>('MEETINGS', 'hchps-meetings', []);
  const { syncAdd, syncUpdate, syncDelete } = useSheetCrud<Meeting>('MEETINGS');

  const addMeeting = useCallback((meeting: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newMeeting: Meeting = { ...meeting, id: generateId(), createdAt: now, updatedAt: now };
    setMeetings(prev => [newMeeting, ...prev]);
    syncAdd(newMeeting);
    return newMeeting;
  }, [setMeetings, syncAdd]);

  const updateMeeting = useCallback((id: string, updates: Partial<Meeting>) => {
    const updatedFields = { ...updates, updatedAt: new Date().toISOString() };
    setMeetings(prev => prev.map(m => m.id === id ? { ...m, ...updatedFields } : m));
    syncUpdate(id, updatedFields);
  }, [setMeetings, syncUpdate]);

  const deleteMeeting = useCallback((id: string) => {
    setMeetings(prev => prev.filter(m => m.id !== id));
    syncDelete(id);
  }, [setMeetings, syncDelete]);

  const getUpcomingMeetings = useCallback((limit: number = 5) => {
    const now = new Date();
    return meetings
      .filter(m => new Date(m.datetime) >= now)
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
      .slice(0, limit);
  }, [meetings]);

  const getTodayMeetings = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    return meetings.filter(m => m.datetime.startsWith(today));
  }, [meetings]);

  return { meetings, addMeeting, updateMeeting, deleteMeeting, getUpcomingMeetings, getTodayMeetings };
}
