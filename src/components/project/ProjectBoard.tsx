'use client';

import React, { useState } from 'react';
import { Project } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Modal } from '@/components/ui/modal';
import { Plus, Trash2, CheckCircle2, Circle, ChevronDown, ChevronRight } from 'lucide-react';

interface ProjectBoardProps {
  projects: Project[];
  addProject: (p: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'checklistItems'>) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  addChecklistItem: (projectId: string, text: string) => void;
  toggleChecklistItem: (projectId: string, itemId: string) => void;
  deleteChecklistItem: (projectId: string, itemId: string) => void;
  getProjectProgress: (projectId: string) => number;
}

const COLORS = ['#4A6CF7', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

export function ProjectBoard({ projects, addProject, updateProject, deleteProject, addChecklistItem, toggleChecklistItem, deleteChecklistItem, getProjectProgress }: ProjectBoardProps) {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState('');

  const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow";

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addProject({ name, description: description || undefined, color: COLORS[projects.length % COLORS.length] });
    setName(''); setDescription(''); setShowModal(false);
  };

  const handleAddItem = (projectId: string) => {
    if (!newItemText.trim()) return;
    addChecklistItem(projectId, newItemText.trim());
    setNewItemText('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">프로젝트</h2>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">
          <Plus size={16} /> 새 프로젝트
        </button>
      </div>

      {projects.length === 0 ? (
        <Card><div className="px-5 py-10 text-center text-sm text-[var(--color-text-tertiary)]">프로젝트를 추가해 보세요</div></Card>
      ) : (
        <div className="space-y-3">
          {projects.map(project => {
            const progress = getProjectProgress(project.id);
            const isExpanded = expandedId === project.id;
            const completedCount = project.checklistItems.filter(i => i.completed).length;
            return (
              <Card key={project.id}>
                <div className="px-5 py-4">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : project.id)}>
                    {isExpanded ? <ChevronDown size={16} className="text-[var(--color-text-tertiary)]" /> : <ChevronRight size={16} className="text-[var(--color-text-tertiary)]" />}
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{project.name}</div>
                      {project.description && <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{project.description}</div>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-[var(--color-text-tertiary)]">{completedCount}/{project.checklistItems.length}</span>
                      <div className="w-24"><ProgressBar value={progress} color={project.color} /></div>
                      <span className="text-xs font-semibold" style={{ color: project.color }}>{progress}%</span>
                      <button onClick={e => { e.stopPropagation(); deleteProject(project.id); }} className="p-1 rounded hover:bg-gray-100 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] cursor-pointer"><Trash2 size={14} /></button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 ml-8 space-y-1.5">
                      {project.checklistItems.map(item => (
                        <div key={item.id} className="flex items-center gap-2 group py-1">
                          <button onClick={() => toggleChecklistItem(project.id, item.id)} className="shrink-0 cursor-pointer">
                            {item.completed ? <CheckCircle2 size={16} className="text-[var(--color-success)]" /> : <Circle size={16} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] transition-colors" />}
                          </button>
                          <span className={`text-sm flex-1 ${item.completed ? 'line-through text-[var(--color-text-tertiary)]' : ''}`}>{item.text}</span>
                          <button onClick={() => deleteChecklistItem(project.id, item.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] cursor-pointer transition-opacity"><Trash2 size={12} /></button>
                        </div>
                      ))}
                      <div className="flex gap-2 mt-2">
                        <input type="text" value={newItemText} onChange={e => setNewItemText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddItem(project.id)} className={`${inputClass} flex-1`} placeholder="새 항목 추가..." />
                        <button onClick={() => handleAddItem(project.id)} className="px-3 py-2 rounded-lg bg-gray-100 text-sm hover:bg-gray-200 transition-colors cursor-pointer">추가</button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="새 프로젝트" size="sm">
        <form onSubmit={handleAdd} className="space-y-4">
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">프로젝트명 *</label><input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} required /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">설명</label><textarea value={description} onChange={e => setDescription(e.target.value)} className={`${inputClass} resize-none`} rows={2} /></div>
          <button type="submit" className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">생성</button>
        </form>
      </Modal>
    </div>
  );
}
