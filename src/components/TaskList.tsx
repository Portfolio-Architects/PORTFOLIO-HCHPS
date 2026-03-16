'use client';

import React, { useState } from 'react';
import { Task, TaskStatus, TaskPriority } from '@/types';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Plus, Pencil, Trash2, CheckCircle2, Circle, Search, Filter } from 'lucide-react';

interface TaskListProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onAdd: () => void;
}

const priorityLabel: Record<TaskPriority, string> = { low: '낮음', medium: '보통', high: '높음' };
const priorityVariant: Record<TaskPriority, 'success' | 'warning' | 'danger'> = { low: 'success', medium: 'warning', high: 'danger' };
const statusLabel: Record<TaskStatus, string> = { todo: '대기', 'in-progress': '진행중', done: '완료' };

function getDDay(dueDate?: string) {
  if (!dueDate) return null;
  const diff = Math.ceil((new Date(dueDate).getTime() - new Date().setHours(0,0,0,0)) / (1000*60*60*24));
  if (diff < 0) return { label: `D+${Math.abs(diff)}`, color: 'text-[var(--color-danger)]' };
  if (diff === 0) return { label: 'D-Day', color: 'text-[var(--color-danger)]' };
  if (diff <= 3) return { label: `D-${diff}`, color: 'text-[var(--color-warning)]' };
  return { label: `D-${diff}`, color: 'text-[var(--color-text-tertiary)]' };
}

export function TaskListView({ tasks, onEdit, onDelete, onStatusChange, onAdd }: TaskListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | ''>('');

  const filtered = tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !(t.description || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">업무 목록</h2>
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">
          <Plus size={16} /> 새 업무
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow" placeholder="업무 검색..." />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as TaskStatus | '')} className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
          <option value="">전체 상태</option>
          <option value="todo">대기</option>
          <option value="in-progress">진행중</option>
          <option value="done">완료</option>
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as TaskPriority | '')} className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
          <option value="">전체 우선순위</option>
          <option value="high">높음</option>
          <option value="medium">보통</option>
          <option value="low">낮음</option>
        </select>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card>
            <div className="px-5 py-10 text-center text-sm text-[var(--color-text-tertiary)]">
              {tasks.length === 0 ? '업무를 추가해 보세요!' : '검색 결과가 없습니다'}
            </div>
          </Card>
        ) : (
          filtered.map(task => {
            const dday = getDDay(task.dueDate);
            return (
              <Card key={task.id} hover>
                <div className="px-4 py-3 flex items-center gap-3">
                  <button
                    onClick={() => onStatusChange(task.id, task.status === 'done' ? 'todo' : 'done')}
                    className="shrink-0 cursor-pointer"
                  >
                    {task.status === 'done' ?
                      <CheckCircle2 size={20} className="text-[var(--color-success)]" /> :
                      <Circle size={20} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] transition-colors" />
                    }
                  </button>
                  <div className="flex-1 min-w-0" onClick={() => onEdit(task)}>
                    <div className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-[var(--color-text-tertiary)]' : ''}`}>
                      {task.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant={priorityVariant[task.priority]}>{priorityLabel[task.priority]}</Badge>
                      {task.category && <span className="text-xs text-[var(--color-text-tertiary)]">{task.category}</span>}
                      {dday && <span className={`text-xs font-semibold ${dday.color}`}>{dday.label}</span>}
                      {task.tags.map(tag => (
                        <span key={tag} className="text-xs bg-gray-100 text-[var(--color-text-secondary)] px-1.5 py-0.5 rounded">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => onEdit(task)} className="p-1.5 rounded hover:bg-gray-100 text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] transition-colors cursor-pointer">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => onDelete(task.id)} className="p-1.5 rounded hover:bg-gray-100 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] transition-colors cursor-pointer">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
