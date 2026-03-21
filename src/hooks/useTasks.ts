'use client';

import { useCallback, useMemo, useRef, useEffect } from 'react';
import { useGoogleSheet, useSheetCrud } from './useGoogleSheet';
import { Task, TaskStatus, TaskPriority, generateId } from '@/types';
import { isHoliday } from '@/lib/holidays';

const WEEKDAYS_MAP: Record<string, number> = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
const adjustedDay = (d: number) => (d === 0 ? 6 : d - 1); // Mon=0, Sun=6

function formatYMD(nextDate: Date) {
  return new Date(nextDate.getTime() - (nextDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
}

function calculateNextDueDate(currentDueDate?: string, recurrence?: string): string | undefined {
  if (!recurrence) return currentDueDate;
  
  const baseDate = currentDueDate ? new Date(currentDueDate) : new Date();
  
  if (recurrence === '매일') {
    let nextDate = new Date(baseDate);
    do {
      nextDate.setDate(nextDate.getDate() + 1);
    } while (isHoliday(nextDate));
    return formatYMD(nextDate);
  }

  if (recurrence.startsWith('매주 ') || recurrence.startsWith('격주 ')) {
    const isBiweekly = recurrence.startsWith('격주 ');
    const daysStr = recurrence.replace(isBiweekly ? '격주 ' : '매주 ', '');
    const allowedDays = daysStr.split(', ').map(d => d.replace('요일', '')); 
    const allowedIndices = allowedDays.map(d => WEEKDAYS_MAP[d]).filter(i => i !== undefined);
    
    if (allowedIndices.length > 0) {
      let nextDate = new Date(baseDate);
      let baseAdjDay = adjustedDay(baseDate.getDay());
      let weeksSkipped = false;
      
      while (true) {
        nextDate.setDate(nextDate.getDate() + 1);
        let currAdjDay = adjustedDay(nextDate.getDay());
        
        // If we wrap around to a new week
        if (currAdjDay < baseAdjDay) {
          if (isBiweekly && !weeksSkipped) {
            nextDate.setDate(nextDate.getDate() + 7); // Skip one week
            weeksSkipped = true;
            currAdjDay = adjustedDay(nextDate.getDay());
          }
          baseAdjDay = -1; // reset base so we don't skip again in this loop
        }
        
        if (allowedIndices.includes(nextDate.getDay())) {
          if (!isHoliday(nextDate)) {
            return formatYMD(nextDate);
          }
        }
      }
    }
  }

  // Monthly or simple weekly fallback
  let nextDate = new Date(baseDate);
  if (recurrence.includes('월') || recurrence.includes('달')) {
    nextDate.setMonth(nextDate.getMonth() + 1);
    while (isHoliday(nextDate)) nextDate.setDate(nextDate.getDate() + 1);
  } else {
    nextDate.setDate(nextDate.getDate() + 7);
    while (isHoliday(nextDate)) nextDate.setDate(nextDate.getDate() + 1);
  }
  
  return formatYMD(nextDate);
}

export function useTasks() {
  const [tasks, setTasks] = useGoogleSheet<Task>('TASKS', 'hchps-tasks', []);
  const { syncAdd, syncUpdate, syncDelete } = useSheetCrud<Task>('TASKS');

  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newTask: Task = { ...task, id: generateId(), createdAt: now, updatedAt: now };
    setTasks(prev => [newTask, ...prev]);
    syncAdd(newTask);
    return newTask;
  }, [setTasks, syncAdd]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    const task = tasksRef.current.find(t => t.id === id);

    if (task && updates.status === 'done' && task.status !== 'done' && task.recurrence) {
      // Auto-duplicate recurring task for the next cycle
      const nextDate = calculateNextDueDate(task.dueDate, task.recurrence);
      
      // Check if nextDate is beyond recurrenceEndDate
      let shouldDuplicate = true;
      if (nextDate && task.recurrenceEndDate) {
        if (new Date(nextDate) > new Date(task.recurrenceEndDate)) {
          shouldDuplicate = false;
        }
      }

      if (shouldDuplicate) {
        const nextTask = {
          title: task.title,
          description: task.description,
          status: 'todo' as TaskStatus,
          priority: task.priority,
          category: task.category,
          dueDate: nextDate,
          projectId: task.projectId,
          tags: [...task.tags],
          recurrence: task.recurrence,
          recurrenceStartDate: task.recurrenceStartDate,
          recurrenceEndDate: task.recurrenceEndDate,
          recurrenceCount: task.recurrenceCount
        };
        // Delay scheduling the next task to prevent state conflict during current render
        setTimeout(() => addTask(nextTask), 50);
      }
    }

    const updatedFields = { ...updates, updatedAt: new Date().toISOString() };
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updatedFields } : t));
    syncUpdate(id, updatedFields);
  }, [setTasks, syncUpdate, addTask]);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    syncDelete(id);
  }, [setTasks, syncDelete]);

  const moveTask = useCallback((id: string, status: TaskStatus) => {
    updateTask(id, { status });
  }, [updateTask]);

  const stats = useMemo(() => {
    const now = new Date();
    let todo = 0, inProgress = 0, done = 0, overdue = 0;
    for (const t of tasks) {
      if (t.status === 'todo') todo++;
      else if (t.status === 'in-progress') inProgress++;
      else if (t.status === 'done') done++;
      if (t.dueDate && new Date(t.dueDate) < now && t.status !== 'done') overdue++;
    }
    const total = tasks.length;
    return { total, todo, inProgress, done, overdue, completionRate: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [tasks]);

  const filterTasks = useCallback((filters: { status?: TaskStatus; priority?: TaskPriority; category?: string; search?: string; projectId?: string }) => {
    return tasks.filter(t => {
      if (filters.status && t.status !== filters.status) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.category && t.category !== filters.category) return false;
      if (filters.projectId && t.projectId !== filters.projectId) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!t.title.toLowerCase().includes(s) && !(t.description || '').toLowerCase().includes(s) && !t.tags.some(tag => tag.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [tasks]);

  return { tasks, addTask, updateTask, deleteTask, moveTask, stats, filterTasks };
}
