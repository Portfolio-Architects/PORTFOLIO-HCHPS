'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { readSheet, addRow, updateRow, deleteRow } from '@/lib/sheets-api';
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
    const nextDate = new Date(baseDate);
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
      const nextDate = new Date(baseDate);
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
  const nextDate = new Date(baseDate);
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
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['TASKS'],
    queryFn: () => readSheet<Task>('TASKS'),
    staleTime: 1000 * 60 * 5,
  });

  const addTaskMut = useMutation({
    mutationFn: (newTask: Task) => addRow('TASKS', newTask),
    onMutate: async (newTask) => {
      await queryClient.cancelQueries({ queryKey: ['TASKS'] });
      const previousTasks = queryClient.getQueryData<Task[]>(['TASKS']);
      queryClient.setQueryData<Task[]>(['TASKS'], (old) => [newTask, ...(old || [])]);
      return { previousTasks };
    },
    onError: (err, newTask, context) => {
      if (context?.previousTasks) queryClient.setQueryData(['TASKS'], context.previousTasks);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['TASKS'] })
  });

  const updateTaskMut = useMutation({
    mutationFn: ({ id, updates }: { id: string, updates: Partial<Task> }) => updateRow('TASKS', id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['TASKS'] });
      const previousTasks = queryClient.getQueryData<Task[]>(['TASKS']);
      
      const updatedFields = { ...updates, updatedAt: new Date().toISOString() };
      queryClient.setQueryData<Task[]>(['TASKS'], (old) => 
        (old || []).map(t => t.id === id ? { ...t, ...updatedFields } : t)
      );
      
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) queryClient.setQueryData(['TASKS'], context.previousTasks);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['TASKS'] })
  });

  const deleteTaskMut = useMutation({
    mutationFn: (id: string) => deleteRow('TASKS', id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['TASKS'] });
      const previousTasks = queryClient.getQueryData<Task[]>(['TASKS']);
      queryClient.setQueryData<Task[]>(['TASKS'], (old) => (old || []).filter(t => t.id !== id));
      return { previousTasks };
    },
    onError: (err, id, context) => {
      if (context?.previousTasks) queryClient.setQueryData(['TASKS'], context.previousTasks);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['TASKS'] })
  });

  const addTask = useCallback((taskPayload: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newTask: Task = { ...taskPayload, id: generateId(), createdAt: now, updatedAt: now };
    addTaskMut.mutate(newTask);
    return newTask;
  }, [addTaskMut]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    const task = tasks.find(t => t.id === id);

    if (task && updates.status === 'done' && task.status !== 'done' && task.recurrence) {
      const nextDate = calculateNextDueDate(task.dueDate, task.recurrence);
      
      let shouldDuplicate = true;
      if (nextDate && task.recurrenceEndDate) {
        if (new Date(nextDate) > new Date(task.recurrenceEndDate)) {
          shouldDuplicate = false;
        }
      }

      if (shouldDuplicate) {
        const nextTaskPayload = {
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
        const now = new Date().toISOString();
        const nextTask: Task = { ...nextTaskPayload, id: generateId(), createdAt: now, updatedAt: now };
        
        try {
          // Serialized mutation chain to prevent queryClient race conditions
          await addTaskMut.mutateAsync(nextTask);
        } catch (err) {
          console.error('[Concurrency Error] Failed to auto-duplicate recurring task:', err);
        }
      }
    }

    updateTaskMut.mutate({ id, updates });
  }, [tasks, updateTaskMut, addTaskMut]);

  const deleteTask = useCallback((id: string) => {
    deleteTaskMut.mutate(id);
  }, [deleteTaskMut]);

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

  return { tasks, isLoading, error, addTask, updateTask, deleteTask, moveTask, stats, filterTasks };
}
