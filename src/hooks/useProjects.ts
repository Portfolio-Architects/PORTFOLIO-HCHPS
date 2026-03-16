'use client';

import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { Project, ChecklistItem, generateId } from '@/types';

export function useProjects() {
  const [projects, setProjects] = useLocalStorage<Project[]>('hchps-projects', []);

  const addProject = useCallback((project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'checklistItems'>) => {
    const now = new Date().toISOString();
    const newProject: Project = { ...project, id: generateId(), checklistItems: [], createdAt: now, updatedAt: now };
    setProjects(prev => [newProject, ...prev]);
    return newProject;
  }, [setProjects]);

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p));
  }, [setProjects]);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
  }, [setProjects]);

  const addChecklistItem = useCallback((projectId: string, text: string) => {
    const item: ChecklistItem = { id: generateId(), text, completed: false };
    setProjects(prev => prev.map(p => p.id === projectId
      ? { ...p, checklistItems: [...p.checklistItems, item], updatedAt: new Date().toISOString() }
      : p
    ));
    return item;
  }, [setProjects]);

  const toggleChecklistItem = useCallback((projectId: string, itemId: string) => {
    setProjects(prev => prev.map(p => p.id === projectId
      ? { ...p, checklistItems: p.checklistItems.map(i => i.id === itemId ? { ...i, completed: !i.completed } : i), updatedAt: new Date().toISOString() }
      : p
    ));
  }, [setProjects]);

  const deleteChecklistItem = useCallback((projectId: string, itemId: string) => {
    setProjects(prev => prev.map(p => p.id === projectId
      ? { ...p, checklistItems: p.checklistItems.filter(i => i.id !== itemId), updatedAt: new Date().toISOString() }
      : p
    ));
  }, [setProjects]);

  const getProjectProgress = useCallback((projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project || project.checklistItems.length === 0) return 0;
    const completed = project.checklistItems.filter(i => i.completed).length;
    return Math.round((completed / project.checklistItems.length) * 100);
  }, [projects]);

  return { projects, addProject, updateProject, deleteProject, addChecklistItem, toggleChecklistItem, deleteChecklistItem, getProjectProgress };
}
