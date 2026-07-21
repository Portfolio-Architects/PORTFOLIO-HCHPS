'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGoogleSheet, useSheetCrud } from './useGoogleSheet';
import { Project, ChecklistItem, generateId } from '@/types';

export function useProjects() {
  const queryClient = useQueryClient();
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
    
    // CASCADE DELETE: Delete associated tasks
    import('@/lib/sheets-api').then(({ readSheet, deleteRow }) => {
      readSheet<import('@/types').Task>('TASKS').then(tasks => {
        const tasksToDelete = tasks.filter(t => t.projectId === id);
        if (tasksToDelete.length > 0) {
          Promise.all(tasksToDelete.map(t => deleteRow('TASKS', t.id))).then(() => {
            queryClient.invalidateQueries({ queryKey: ['TASKS'] });
          }).catch(err => console.error('Cascade delete tasks failed:', err));
        }
      }).catch(err => console.error('Failed to read TASKS for cascade delete:', err));
    });
  }, [setProjects, syncDelete, queryClient]);

  const addChecklistItem = useCallback((projectId: string, text: string) => {
    const item: ChecklistItem = { id: generateId(), text, completed: false };
    let updatedChecklist: ChecklistItem[] = [];
    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        updatedChecklist = [...p.checklistItems, item];
        return { ...p, checklistItems: updatedChecklist, updatedAt: new Date().toISOString() };
      }
      return p;
    }));
    if (updatedChecklist.length > 0) {
      syncUpdate(projectId, { checklistItems: updatedChecklist as unknown as Project['checklistItems'], updatedAt: new Date().toISOString() });
    }
    return item;
  }, [setProjects, syncUpdate]);

  const toggleChecklistItem = useCallback((projectId: string, itemId: string) => {
    let updatedChecklist: ChecklistItem[] = [];
    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        updatedChecklist = p.checklistItems.map(i => i.id === itemId ? { ...i, completed: !i.completed } : i);
        return { ...p, checklistItems: updatedChecklist, updatedAt: new Date().toISOString() };
      }
      return p;
    }));
    if (updatedChecklist.length > 0) {
      syncUpdate(projectId, { checklistItems: updatedChecklist as unknown as Project['checklistItems'], updatedAt: new Date().toISOString() });
    }
  }, [setProjects, syncUpdate]);

  const deleteChecklistItem = useCallback((projectId: string, itemId: string) => {
    let updatedChecklist: ChecklistItem[] = [];
    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        updatedChecklist = p.checklistItems.filter(i => i.id !== itemId);
        return { ...p, checklistItems: updatedChecklist, updatedAt: new Date().toISOString() };
      }
      return p;
    }));
    if (updatedChecklist.length > 0) {
      syncUpdate(projectId, { checklistItems: updatedChecklist as unknown as Project['checklistItems'], updatedAt: new Date().toISOString() });
    }
  }, [setProjects, syncUpdate]);

  const getProjectProgress = useCallback((projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project || !project.checklistItems || project.checklistItems.length === 0) return 0;
    const completed = project.checklistItems.filter(i => i.completed).length;
    return Math.round((completed / project.checklistItems.length) * 100);
  }, [projects]);

  return { projects, addProject, updateProject, deleteProject, addChecklistItem, toggleChecklistItem, deleteChecklistItem, getProjectProgress };
}
