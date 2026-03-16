'use client';

import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { Task, TaskStatus, TaskPriority, generateId } from '@/types';

export function useTasks() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('hchps-tasks', []);

  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newTask: Task = { ...task, id: generateId(), createdAt: now, updatedAt: now };
    setTasks(prev => [newTask, ...prev]);
    return newTask;
  }, [setTasks]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t));
  }, [setTasks]);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, [setTasks]);

  const moveTask = useCallback((id: string, status: TaskStatus) => {
    updateTask(id, { status });
  }, [updateTask]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const todo = tasks.filter(t => t.status === 'todo').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const done = tasks.filter(t => t.status === 'done').length;
    const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done').length;
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
