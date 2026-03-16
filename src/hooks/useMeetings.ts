'use client';

import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { Meeting, generateId } from '@/types';

export function useMeetings() {
  const [meetings, setMeetings] = useLocalStorage<Meeting[]>('hchps-meetings', []);

  const addMeeting = useCallback((meeting: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newMeeting: Meeting = { ...meeting, id: generateId(), createdAt: now, updatedAt: now };
    setMeetings(prev => [newMeeting, ...prev]);
    return newMeeting;
  }, [setMeetings]);

  const updateMeeting = useCallback((id: string, updates: Partial<Meeting>) => {
    setMeetings(prev => prev.map(m => m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m));
  }, [setMeetings]);

  const deleteMeeting = useCallback((id: string) => {
    setMeetings(prev => prev.filter(m => m.id !== id));
  }, [setMeetings]);

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
