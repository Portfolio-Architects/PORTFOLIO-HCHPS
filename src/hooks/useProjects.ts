'use client';

import { useCallback } from 'react';
import { useGoogleSheet, useSheetCrud } from './useGoogleSheet';
import { Project, ChecklistItem, generateId } from '@/types';

export function useProjects() {
  const [projects, setProjects] = useGoogleSheet<Project>('PROJECTS', 'hchps-projects', []);
  const { syncAdd, syncUpdate, syncDelete } = useSheetCrud<Project>('PROJECTS');

  const addProject = useCallback((project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'checklistItems'>) => {
    const now = new Date().toISOString();
    const newProject: Project = { ...project, id: generateId(), checklistItems: [], createdAt: now, updatedAt: now };
    setProjects(prev => [newProject, ...prev]);
    syncAdd(newProject);
    return newProject;
  }, [setProjects, syncAdd]);

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    const updatedFields = { ...updates, updatedAt: new Date().toISOString() };
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updatedFields } : p));
    syncUpdate(id, updatedFields);
  }, [setProjects, syncUpdate]);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    syncDelete(id);
  }, [setProjects, syncDelete]);

  const addChecklistItem = useCallback((projectId: string, text: string) => {
    const item: ChecklistItem = { id: generateId(), text, completed: false };
    setProjects(prev => prev.map(p => p.id === projectId
      ? { ...p, checklistItems: [...p.checklistItems, item], updatedAt: new Date().toISOString() }
      : p
    ));
    // Sync entire checklistItems array for this project
    const project = projects.find(p => p.id === projectId);
    if (project) {
      syncUpdate(projectId, { checklistItems: [...project.checklistItems, item] as unknown as Project['checklistItems'], updatedAt: new Date().toISOString() });
    }
    return item;
  }, [setProjects, projects, syncUpdate]);

  const toggleChecklistItem = useCallback((projectId: string, itemId: string) => {
    setProjects(prev => prev.map(p => p.id === projectId
      ? { ...p, checklistItems: p.checklistItems.map(i => i.id === itemId ? { ...i, completed: !i.completed } : i), updatedAt: new Date().toISOString() }
      : p
    ));
    const project = projects.find(p => p.id === projectId);
    if (project) {
      const updated = project.checklistItems.map(i => i.id === itemId ? { ...i, completed: !i.completed } : i);
      syncUpdate(projectId, { checklistItems: updated as unknown as Project['checklistItems'], updatedAt: new Date().toISOString() });
    }
  }, [setProjects, projects, syncUpdate]);

  const deleteChecklistItem = useCallback((projectId: string, itemId: string) => {
    setProjects(prev => prev.map(p => p.id === projectId
      ? { ...p, checklistItems: p.checklistItems.filter(i => i.id !== itemId), updatedAt: new Date().toISOString() }
      : p
    ));
    const project = projects.find(p => p.id === projectId);
    if (project) {
      const updated = project.checklistItems.filter(i => i.id !== itemId);
      syncUpdate(projectId, { checklistItems: updated as unknown as Project['checklistItems'], updatedAt: new Date().toISOString() });
    }
  }, [setProjects, projects, syncUpdate]);

  const getProjectProgress = useCallback((projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project || project.checklistItems.length === 0) return 0;
    const completed = project.checklistItems.filter(i => i.completed).length;
    return Math.round((completed / project.checklistItems.length) * 100);
  }, [projects]);

  return { projects, addProject, updateProject, deleteProject, addChecklistItem, toggleChecklistItem, deleteChecklistItem, getProjectProgress };
}
