'use client';

import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, TaskPriority, KnowledgeEntry } from '@/types';
import { Modal } from './ui/modal';
import { Lightbulb } from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  editTask?: Task | null;
  onUpdate?: (id: string, updates: Partial<Task>) => void;
  categories: string[];
  projects: { id: string; name: string }[];
  knowledgeEntries: KnowledgeEntry[];
}

export function TaskModal({ isOpen, onClose, onSave, editTask, onUpdate, categories, projects, knowledgeEntries }: TaskModalProps) {
  const [title, setTitle] = useState(editTask?.title || '');
  const [description, setDescription] = useState(editTask?.description || '');
  const [status, setStatus] = useState<TaskStatus>(editTask?.status || 'todo');
  const [priority, setPriority] = useState<TaskPriority>(editTask?.priority || 'medium');
  const [category, setCategory] = useState(editTask?.category || '');
  const [dueDate, setDueDate] = useState(editTask?.dueDate || '');
  const [projectId, setProjectId] = useState(editTask?.projectId || '');
  const [recurrence, setRecurrence] = useState(editTask?.recurrence || '');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(editTask?.recurrenceEndDate || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(editTask?.tags || []);

  React.useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setDescription(editTask.description || '');
      setStatus(editTask.status);
      setPriority(editTask.priority);
      setCategory(editTask.category);
      setDueDate(editTask.dueDate || '');
      setProjectId(editTask.projectId || '');
      setRecurrence(editTask.recurrence || '');
      setRecurrenceEndDate(editTask.recurrenceEndDate || '');
      setTags(editTask.tags);
    } else {
      setTitle(''); setDescription(''); setStatus('todo'); setPriority('medium');
      setCategory(''); setDueDate(''); setProjectId(''); setRecurrence(''); setRecurrenceEndDate(''); setTags([]);
    }
  }, [editTask, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editTask && onUpdate) {
      onUpdate(editTask.id, { title, description, status, priority, category, dueDate: dueDate || undefined, projectId: projectId || undefined, recurrence: recurrence || undefined, recurrenceEndDate: recurrenceEndDate || undefined, tags });
    } else {
      onSave({ title, description, status, priority, category, dueDate: dueDate || undefined, projectId: projectId || undefined, recurrence: recurrence || undefined, recurrenceEndDate: recurrenceEndDate || undefined, tags });
    }
    onClose();
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const matchedAdvice = useMemo(() => {
    if (!knowledgeEntries || knowledgeEntries.length === 0) return [];
    
    return knowledgeEntries.filter(entry => {
      // 1. Direct tag match (task has a tag that matches entry's tag)
      if (entry.tags && entry.tags.some(t => tags.includes(t))) return true;
      // 2. Category match
      if (entry.category && entry.category === category) return true;
      // 3. Keyword match from title
      if (title) {
        // Very basic keyword check: if entry tags or title exist in task title
        if (entry.tags && entry.tags.some(t => title.includes(t))) return true;
        
        // Exclude generic terms before checking title inclusion
        const genericTerms = ['보고', '회의', '미팅', '작성', '확인', '검토', '기획'];
        if (!genericTerms.includes(entry.title) && title.includes(entry.title)) return true;
      }
      return false;
    });
  }, [knowledgeEntries, tags, category, title]);

  const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-shadow";
  const labelClass = "block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editTask ? '업무 수정' : '새 업무'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {matchedAdvice.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <h4 className="flex items-center gap-1.5 text-xs font-bold text-yellow-800 mb-2">
              <Lightbulb size={14} className="text-yellow-600" />
              💡 참고할 조언 / 어드바이스 ({matchedAdvice.length}건)
            </h4>
            <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
              {matchedAdvice.map(advice => (
                <div key={advice.id} className="bg-white/80 rounded-lg p-2 text-xs">
                  <div className="font-semibold text-gray-800 mb-0.5">{advice.title}</div>
                  <div className="text-gray-600 whitespace-pre-wrap leading-relaxed">{advice.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className={labelClass}>제목 *</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputClass} placeholder="업무 제목을 입력하세요" required autoFocus />
        </div>

        <div>
          <label className={labelClass}>설명</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} className={`${inputClass} resize-none`} rows={3} placeholder="상세 설명 (선택)" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>상태</label>
            <select value={status} onChange={e => setStatus(e.target.value as TaskStatus)} className={inputClass}>
              <option value="todo">대기</option>
              <option value="in-progress">진행중</option>
              <option value="done">완료</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>우선순위</label>
            <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} className={inputClass}>
              <option value="low">낮음</option>
              <option value="medium">보통</option>
              <option value="high">높음</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>카테고리</label>
            <input type="text" value={category} onChange={e => setCategory(e.target.value)} className={inputClass} placeholder="카테고리" list="category-list" />
            <datalist id="category-list">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className={labelClass}>마감일</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputClass} />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>반복 일정</label>
            <input type="text" value={recurrence} onChange={e => setRecurrence(e.target.value)} className={inputClass} placeholder="예: 매일, 매주 화요일" />
          </div>
          <div>
            <label className={labelClass}>반복 종료일 (선택)</label>
            <input type="date" value={recurrenceEndDate} onChange={e => setRecurrenceEndDate(e.target.value)} className={inputClass} disabled={!recurrence} />
          </div>
        </div>

        {projects.length > 0 && (
          <div>
            <label className={labelClass}>프로젝트</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} className={inputClass}>
              <option value="">없음</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className={labelClass}>태그</label>
          <div className="flex gap-2">
            <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} className={`${inputClass} flex-1`} placeholder="태그 입력 후 추가" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} />
            <button type="button" onClick={addTag} className="px-3 py-2 rounded-lg bg-gray-100 text-sm hover:bg-gray-200 transition-colors cursor-pointer">추가</button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map(tag => (
                <span key={tag} className="badge bg-gray-100 text-[var(--color-text-secondary)] cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => setTags(tags.filter(t => t !== tag))}>
                  {tag} ×
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer">
            취소
          </button>
          <button type="submit" className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">
            {editTask ? '수정' : '생성'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
