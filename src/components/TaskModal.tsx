'use client';

import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, KnowledgeEntry } from '@/types';
import { Modal } from './ui/modal';
import { Lightbulb, CalendarDays } from 'lucide-react';

type RecurrenceType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'custom';
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

function parseRecurrence(text: string): { type: RecurrenceType; days: string[]; custom: string } {
  if (!text) return { type: 'none', days: [], custom: '' };
  if (text === '매일') return { type: 'daily', days: [], custom: '' };
  if (text.startsWith('매주 ')) {
    const daysStr = text.replace('매주 ', '');
    const days = daysStr.split(', ').map(d => d.replace('요일', ''));
    if (days.every(d => WEEKDAYS.includes(d))) return { type: 'weekly', days, custom: '' };
  }
  if (text.startsWith('격주 ')) {
    const daysStr = text.replace('격주 ', '');
    const days = daysStr.split(', ').map(d => d.replace('요일', ''));
    if (days.every(d => WEEKDAYS.includes(d))) return { type: 'biweekly', days, custom: '' };
  }
  return { type: 'custom', days: [], custom: text };
}

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  editTask?: Task | null;
  onUpdate?: (id: string, updates: Partial<Task>) => void;
  allTags: string[];
  projects: { id: string; name: string }[];
  knowledgeEntries: KnowledgeEntry[];
}

export function TaskModal({ isOpen, onClose, onSave, editTask, onUpdate, allTags, projects, knowledgeEntries }: TaskModalProps) {
  const [title, setTitle] = useState(editTask?.title || '');
  const [description, setDescription] = useState(editTask?.description || '');
  const [status, setStatus] = useState<TaskStatus>(editTask?.status || 'todo');
  const [dueDate, setDueDate] = useState(() => {
    const dd = editTask?.dueDate || '';
    return dd.includes('T') ? dd.split('T')[0] : dd;
  });
  const [dueTime, setDueTime] = useState(() => {
    const dd = editTask?.dueDate || '';
    return dd.includes('T') ? dd.split('T')[1]?.slice(0, 5) || '' : '';
  });
  const [projectId, setProjectId] = useState(editTask?.projectId || '');
  
  const initRecurrence = useMemo(() => parseRecurrence(editTask?.recurrence || ''), [editTask?.recurrence]);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(initRecurrence.type);
  const [recurrenceDays, setRecurrenceDays] = useState<string[]>(initRecurrence.days);
  const [customRecurrence, setCustomRecurrence] = useState(initRecurrence.custom);
  
  const [recurrenceStartDate, setRecurrenceStartDate] = useState(editTask?.recurrenceStartDate || '');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(editTask?.recurrenceEndDate || '');
  const [recurrenceCount, setRecurrenceCount] = useState<number | ''>(editTask?.recurrenceCount || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(editTask?.tags || []);

  React.useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setDescription(editTask.description || '');
      setStatus(editTask.status);
      setDueDate(editTask.dueDate?.includes('T') ? editTask.dueDate.split('T')[0] : editTask.dueDate || '');
      setDueTime(editTask.dueDate?.includes('T') ? editTask.dueDate.split('T')[1]?.slice(0, 5) || '' : '');
      setProjectId(editTask.projectId || '');
      
      const parsed = parseRecurrence(editTask.recurrence || '');
      setRecurrenceType(parsed.type);
      setRecurrenceDays(parsed.days);
      setCustomRecurrence(parsed.custom);
      
      setRecurrenceStartDate(editTask.recurrenceStartDate || '');
      setRecurrenceEndDate(editTask.recurrenceEndDate || '');
      setRecurrenceCount(editTask.recurrenceCount || '');
      setTags(editTask.tags);
    } else {
      setTitle(''); setDescription(''); setStatus('todo');
      setDueDate(''); setDueTime(''); setProjectId('');
      setRecurrenceType('none'); setRecurrenceDays([]); setCustomRecurrence('');
      setRecurrenceStartDate(''); setRecurrenceEndDate(''); setRecurrenceCount(''); setTags([]);
    }
  }, [editTask, isOpen]);

  // Auto-fill dueDate from recurrence start date
  React.useEffect(() => {
    if (recurrenceStartDate && recurrenceType !== 'none') {
      setDueDate(recurrenceStartDate);
    }
  }, [recurrenceStartDate, recurrenceType]);

  // Auto-calculate end date from start date + count + pattern
  React.useEffect(() => {
    if (!recurrenceStartDate || !recurrenceCount || recurrenceType === 'none') return;
    const count = typeof recurrenceCount === 'number' ? recurrenceCount : parseInt(String(recurrenceCount));
    if (!count || count <= 0) return;
    
    const [sy, sm, sd] = recurrenceStartDate.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd);
    if (recurrenceType === 'daily') {
      start.setDate(start.getDate() + (count - 1));
    } else if (recurrenceType === 'biweekly') {
      start.setDate(start.getDate() + (count - 1) * 14);
    } else if (recurrenceType === 'weekly') {
      const numDays = recurrenceDays.length || 1;
      const weeks = Math.ceil(count / numDays);
      start.setDate(start.getDate() + (weeks - 1) * 7);
    } else {
      // custom/monthly fallback
      start.setDate(start.getDate() + (count - 1) * 30);
    }
    const yyyy = start.getFullYear();
    const mm = String(start.getMonth() + 1).padStart(2, '0');
    const dd = String(start.getDate()).padStart(2, '0');
    setRecurrenceEndDate(`${yyyy}-${mm}-${dd}`);
  }, [recurrenceStartDate, recurrenceCount, recurrenceType, recurrenceDays]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let finalRecurrence = '';
    if (recurrenceType === 'daily') finalRecurrence = '매일';
    else if (recurrenceType === 'weekly' && recurrenceDays.length > 0) {
      finalRecurrence = `매주 ${recurrenceDays.map(d => d + '요일').join(', ')}`;
    }
    else if (recurrenceType === 'biweekly' && recurrenceDays.length > 0) {
      finalRecurrence = `격주 ${recurrenceDays.map(d => d + '요일').join(', ')}`;
    }
    else if (recurrenceType === 'custom') {
      finalRecurrence = customRecurrence.trim();
    }

    const countVal = typeof recurrenceCount === 'number' ? recurrenceCount : (parseInt(String(recurrenceCount)) || undefined);

    // Combine date + time
    const combinedDueDate = dueDate ? (dueTime ? `${dueDate}T${dueTime}` : dueDate) : undefined;

    if (editTask && onUpdate) {
      onUpdate(editTask.id, { title, description, status, priority: 'medium', category: '', dueDate: combinedDueDate, projectId: projectId || undefined, recurrence: finalRecurrence || undefined, recurrenceStartDate: recurrenceStartDate || undefined, recurrenceEndDate: recurrenceEndDate || undefined, recurrenceCount: countVal, tags });
    } else {
      onSave({ title, description, status, priority: 'medium', category: '', dueDate: combinedDueDate, projectId: projectId || undefined, recurrence: finalRecurrence || undefined, recurrenceStartDate: recurrenceStartDate || undefined, recurrenceEndDate: recurrenceEndDate || undefined, recurrenceCount: countVal, tags });
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
      // 2. Keyword match from title
      if (title) {
        // Very basic keyword check: if entry tags or title exist in task title
        if (entry.tags && entry.tags.some(t => title.includes(t))) return true;
        
        // Exclude generic terms before checking title inclusion
        const genericTerms = ['보고', '회의', '미팅', '작성', '확인', '검토', '기획'];
        if (!genericTerms.includes(entry.title) && title.includes(entry.title)) return true;
      }
      return false;
    });
  }, [knowledgeEntries, tags, title]);

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
            <label className={labelClass}>
              D-Day
              {dueDate && (() => {
                const today = new Date(); today.setHours(0,0,0,0);
                const due = new Date(dueDate + 'T00:00:00'); 
                const diff = Math.ceil((due.getTime() - today.getTime()) / (1000*60*60*24));
                const label = diff === 0 ? 'D-Day' : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
                const color = diff < 0 ? 'text-red-500' : diff === 0 ? 'text-orange-500' : diff <= 3 ? 'text-amber-500' : 'text-emerald-500';
                return <span className={`ml-1.5 text-[11px] font-bold ${color}`}>({label})</span>;
              })()}
            </label>
            <div className="flex gap-2">
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={`${inputClass} flex-1`} />
              <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} className={`${inputClass} w-28`} placeholder="시간" />
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2 col-span-2 sm:col-span-1">
            <label className={labelClass}>반복 일정</label>
            <select value={recurrenceType} onChange={e => {
              const val = e.target.value as RecurrenceType;
              setRecurrenceType(val);
              if (val !== 'weekly' && val !== 'biweekly') setRecurrenceDays([]);
            }} className={inputClass}>
              <option value="none">반복 안함</option>
              <option value="daily">매일</option>
              <option value="weekly">매주</option>
              <option value="biweekly">격주</option>
              <option value="custom">직접 입력 (매월 등)</option>
            </select>
            
            {(recurrenceType === 'weekly' || recurrenceType === 'biweekly') && (
              <div className="flex flex-wrap gap-1 mt-2">
                {WEEKDAYS.map(day => {
                  const isSelected = recurrenceDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        if (isSelected) setRecurrenceDays(prev => prev.filter(d => d !== day));
                        else setRecurrenceDays(prev => [...prev, day].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b)));
                      }}
                      className={`w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center transition-colors cursor-pointer ${
                        isSelected ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'bg-gray-100 text-[var(--color-text-secondary)] hover:bg-gray-200'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            )}
            
            {recurrenceType === 'custom' && (
              <input type="text" value={customRecurrence} onChange={e => setCustomRecurrence(e.target.value)} className={`${inputClass} mt-2`} placeholder="예: 매월 15일, 주 2회 화목" autoFocus />
            )}
          </div>
          
          {recurrenceType !== 'none' && (
            <div className="col-span-2 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>시작일</label>
                  <input type="date" value={recurrenceStartDate} onChange={e => setRecurrenceStartDate(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>총 횟수</label>
                  <input type="number" min="1" value={recurrenceCount} onChange={e => setRecurrenceCount(e.target.value ? parseInt(e.target.value) : '')} className={inputClass} placeholder="예: 12" />
                </div>
                <div>
                  <label className={labelClass}>종료일 (자동계산)</label>
                  <input type="date" value={recurrenceEndDate} onChange={e => setRecurrenceEndDate(e.target.value)} className={inputClass} />
                </div>
              </div>
              
              {recurrenceStartDate && recurrenceCount && recurrenceEndDate && (
                <div className="text-xs bg-teal-50 border border-teal-100 rounded-lg px-3 py-2 text-teal-700 flex items-center gap-2">
                  <CalendarDays size={12} />
                  <span>
                    {recurrenceStartDate.replace(/-/g, '.')} ~ {recurrenceEndDate.replace(/-/g, '.')} · 총 <strong>{recurrenceCount}회</strong> 반복
                  </span>
                </div>
              )}
            </div>
          )}
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
          {/* Existing tags as clickable chips */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {allTags.map(tag => {
                const isSelected = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (isSelected) setTags(tags.filter(t => t !== tag));
                      else setTags([...tags, tag]);
                    }}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--color-primary)] text-white shadow-sm'
                        : 'bg-gray-100 text-[var(--color-text-secondary)] hover:bg-gray-200'
                    }`}
                  >
                    {isSelected ? '✓ ' : '#'}{tag}
                  </button>
                );
              })}
            </div>
          )}
          {/* New tag input */}
          <div className="flex gap-2">
            <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} className={`${inputClass} flex-1`} placeholder="새 태그 입력 후 추가" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} />
            <button type="button" onClick={addTag} className="px-3 py-2 rounded-lg bg-gray-100 text-sm hover:bg-gray-200 transition-colors cursor-pointer">추가</button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.filter(t => !allTags.includes(t)).map(tag => (
                <span key={tag} className="badge bg-[var(--color-primary)] text-white cursor-pointer hover:opacity-80 transition-colors" onClick={() => setTags(tags.filter(t => t !== tag))}>
                  ✓ {tag} ×
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
