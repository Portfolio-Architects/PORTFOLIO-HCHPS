'use client';

import { useCallback, useMemo } from 'react';
import { useGoogleSheet, useSheetCrud } from './useGoogleSheet';
import { Task, TaskStatus, TaskPriority, generateId } from '@/types';

export function useTasks() {
  const [tasks, setTasks] = useGoogleSheet<Task>('TASKS', 'hchps-tasks', []);
  const { syncAdd, syncUpdate, syncDelete } = useSheetCrud<Task>('TASKS');

  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newTask: Task = { ...task, id: generateId(), createdAt: now, updatedAt: now };
    setTasks(prev => [newTask, ...prev]);
    syncAdd(newTask);
    return newTask;
  }, [setTasks, syncAdd]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    const updatedFields = { ...updates, updatedAt: new Date().toISOString() };
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updatedFields } : t));
    syncUpdate(id, updatedFields);
  }, [setTasks, syncUpdate]);

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
