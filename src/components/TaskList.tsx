'use client';

import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, Meeting, Project, generateId } from '@/types';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { ProgressBar } from './ui/progress-bar';
import { Modal } from './ui/modal';
import {
  Plus, Pencil, Trash2, CheckCircle2, Circle, Search,
  CalendarDays, MapPin, Users, FileText, FolderKanban,
  ListTodo, ChevronDown, ChevronRight, Repeat, Tag,
  ArrowUpDown, ArrowUp, ArrowDown, Settings, X
} from 'lucide-react';

type SortBy = 'default' | 'dueDate' | 'createdAt' | 'status' | 'tag';

type ItemFilter = 'all' | 'tasks' | 'meetings';

interface TaskListProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onAdd: () => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  // Meeting props
  meetings: Meeting[];
  addMeeting: (m: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateMeeting: (id: string, updates: Partial<Meeting>) => void;
  deleteMeeting: (id: string) => void;
  // Project props
  projects: Project[];
  addProject: (p: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'checklistItems'>) => void;
  deleteProject: (id: string) => void;
}


function getDDay(dueDate?: string) {
  if (!dueDate) return null;
  // Parse as local time — new Date('YYYY-MM-DD') parses as UTC, causing timezone issues
  const [y, m, d] = dueDate.split('-').map(Number);
  const due = new Date(y, m - 1, d).getTime();
  const diff = Math.ceil((due - new Date().setHours(0,0,0,0)) / (1000*60*60*24));
  if (diff < 0) return { label: `D+${Math.abs(diff)}`, color: 'text-[var(--color-danger)]' };
  if (diff === 0) return { label: 'D-Day', color: 'text-[var(--color-danger)]' };
  if (diff <= 3) return { label: `D-${diff}`, color: 'text-[var(--color-warning)]' };
  return { label: `D-${diff}`, color: 'text-[var(--color-text-tertiary)]' };
}

function formatDT(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' }) + ' ' + d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

const PROJECT_COLORS = ['#4A6CF7', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

export function TaskListView({
  tasks, onEdit, onDelete, onStatusChange, onAdd, onUpdateTask,
  meetings, addMeeting, updateMeeting, deleteMeeting,
  projects, addProject, deleteProject
}: TaskListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [itemFilter, setItemFilter] = useState<ItemFilter>('all');
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [showRecurringOnly, setShowRecurringOnly] = useState(false);

  // Sort state
  const [sortBy, setSortBy] = useState<SortBy>('default');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Tag management state
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [editingTagFrom, setEditingTagFrom] = useState<string | null>(null);
  const [editingTagTo, setEditingTagTo] = useState('');

  // Meeting modal state
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [mTitle, setMTitle] = useState('');
  const [mDatetime, setMDatetime] = useState('');
  const [mEndTime, setMEndTime] = useState('');
  const [mLocation, setMLocation] = useState('');
  const [mAttendeesStr, setMAttendeesStr] = useState('');
  const [mAgenda, setMAgenda] = useState('');
  const [mNotes, setMNotes] = useState('');
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);

  // Project modal state
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [pName, setPName] = useState('');
  const [pDescription, setPDescription] = useState('');
  const [projectBarExpanded, setProjectBarExpanded] = useState(true);

  const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow";

  // -- Filter + Sort logic --
  const filteredTasks = useMemo(() => {
    const filtered = tasks.filter(t => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !(t.description || '').toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (projectFilter && t.projectId !== projectFilter) return false;
      if (tagFilter && !t.tags.includes(tagFilter)) return false;
      if (showRecurringOnly && !t.recurrence) return false;
      return true;
    });

    // Sort
    if (sortBy === 'default') return filtered;

    const dir = sortOrder === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'dueDate': {
          const aDate = a.dueDate || '9999-12-31';
          const bDate = b.dueDate || '9999-12-31';
          return dir * aDate.localeCompare(bDate);
        }
        case 'createdAt':
          return dir * a.createdAt.localeCompare(b.createdAt);
        case 'status': {
          const statusOrder: Record<string, number> = { 'todo': 0, 'in-progress': 1, 'done': 2 };
          return dir * ((statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0));
        }
        case 'tag': {
          const aTag = a.tags[0] || 'zzz';
          const bTag = b.tags[0] || 'zzz';
          return dir * aTag.localeCompare(bTag);
        }
        default:
          return 0;
      }
    });
  }, [tasks, search, statusFilter, projectFilter, tagFilter, showRecurringOnly, sortBy, sortOrder]);

  // -- Tag management helpers --
  const allTags = useMemo(() => [...new Set(tasks.flatMap(t => t.tags).filter(Boolean))], [tasks]);

  const handleAddTag = () => {
    // Adding a new global tag: this is a no-op by itself since tags live on tasks.
    // The new tag will appear in the list once a task uses it.
    // But we allow creating it in the tag manager so it shows in allTags for TaskModal.
    // We'll add it to the first task that has no tags, or just inform the user.
    if (!newTagName.trim()) return;
    setNewTagName('');
  };

  const handleDeleteTag = (tagToDelete: string) => {
    if (!onUpdateTask) return;
    if (!confirm(`"${tagToDelete}" 태그를 모든 업무에서 제거하시겠습니까?`)) return;
    tasks.forEach(task => {
      if (task.tags.includes(tagToDelete)) {
        onUpdateTask(task.id, { tags: task.tags.filter(t => t !== tagToDelete) });
      }
    });
    if (tagFilter === tagToDelete) setTagFilter('');
  };

  const handleRenameTag = (oldName: string) => {
    if (!onUpdateTask || !editingTagTo.trim() || editingTagTo.trim() === oldName) {
      setEditingTagFrom(null);
      return;
    }
    const newName = editingTagTo.trim();
    tasks.forEach(task => {
      if (task.tags.includes(oldName)) {
        onUpdateTask(task.id, { tags: task.tags.map(t => t === oldName ? newName : t) });
      }
    });
    if (tagFilter === oldName) setTagFilter(newName);
    setEditingTagFrom(null);
    setEditingTagTo('');
  };

  const SORT_OPTIONS: { value: SortBy; label: string }[] = [
    { value: 'default', label: '기본순' },
    { value: 'dueDate', label: '마감일순' },
    { value: 'createdAt', label: '생성일순' },
    { value: 'status', label: '상태순' },
    { value: 'tag', label: '태그순' },
  ];

  const filteredMeetings = useMemo(() => {
    if (!search) return meetings;
    return meetings.filter(m => m.title.toLowerCase().includes(search.toLowerCase()));
  }, [meetings, search]);

  const now = new Date();
  const sortedMeetings = useMemo(() =>
    [...filteredMeetings].sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()),
    [filteredMeetings]
  );

  // -- Project progress (task-based) --
  const getProjectProgress = (projectId: string) => {
    const projectTasks = tasks.filter(t => t.projectId === projectId);
    if (projectTasks.length === 0) return 0;
    const completed = projectTasks.filter(t => t.status === 'done').length;
    return Math.round((completed / projectTasks.length) * 100);
  };

  const getProjectTaskCount = (projectId: string) => {
    const projectTasks = tasks.filter(t => t.projectId === projectId);
    const done = projectTasks.filter(t => t.status === 'done').length;
    return { total: projectTasks.length, done };
  };

  // -- Meeting modal --
  const openAddMeeting = () => {
    setEditMeeting(null); setMTitle(''); setMDatetime(''); setMEndTime(''); setMLocation(''); setMAttendeesStr(''); setMAgenda(''); setMNotes('');
    setShowMeetingModal(true);
  };
  const openEditMeeting = (m: Meeting) => {
    setEditMeeting(m); setMTitle(m.title); setMDatetime(m.datetime.slice(0, 16)); setMEndTime(m.endTime || ''); setMLocation(m.location || ''); setMAttendeesStr(m.attendees.join(', ')); setMAgenda(m.agenda || ''); setMNotes(m.notes || '');
    setShowMeetingModal(true);
  };
  const handleMeetingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mTitle.trim() || !mDatetime) return;
    const data = { title: mTitle, datetime: new Date(mDatetime).toISOString(), endTime: mEndTime || undefined, location: mLocation || undefined, attendees: mAttendeesStr.split(',').map(s => s.trim()).filter(Boolean), agenda: mAgenda || undefined, notes: mNotes || undefined };
    if (editMeeting) { updateMeeting(editMeeting.id, data); } else { addMeeting(data); }
    setShowMeetingModal(false);
  };

  // -- Project modal --
  const handleProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName.trim()) return;
    addProject({ name: pName, description: pDescription || undefined, color: PROJECT_COLORS[projects.length % PROJECT_COLORS.length] });
    setPName(''); setPDescription(''); setShowProjectModal(false);
  };

  // -- Render items --
  const renderTask = (task: Task) => {
    const dday = getDDay(task.dueDate);
    const project = task.projectId ? projects.find(p => p.id === task.projectId) : null;
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
              {task.dueDate && (() => {
                const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
                const [datePart, timePart] = task.dueDate.split('T');
                const [y, mo, day] = datePart.split('-').map(Number);
                const d = new Date(y, mo - 1, day);
                const dateStr = `${mo}/${day}(${weekdays[d.getDay()]})`;
                const timeStr = timePart ? timePart.slice(0, 5) : null;
                return (
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
                    <CalendarDays size={11} className="shrink-0" />
                    {dateStr}{timeStr && <span className="font-medium">{timeStr}</span>}
                  </span>
                );
              })()}
              {dday && <span className={`text-xs font-semibold ${dday.color}`}>{dday.label}</span>}
              {project && (
                <span className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                  {project.name}
                </span>
              )}
              {task.recurrence && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">
                  <Repeat size={10} /> {task.recurrence}{task.recurrenceCount ? ` · ${task.recurrenceCount}회` : ''}
                </span>
              )}
              {task.tags.map(tag => (
                <span key={tag} className="text-xs bg-gray-100 text-[var(--color-text-secondary)] px-1.5 py-0.5 rounded">{tag}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onEdit(task)} className="p-2 rounded hover:bg-gray-100 text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] transition-colors cursor-pointer">
              <Pencil size={14} />
            </button>
            <button onClick={() => onDelete(task.id)} className="p-2 rounded hover:bg-gray-100 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] transition-colors cursor-pointer">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </Card>
    );
  };

  const renderMeeting = (m: Meeting) => {
    const isPast = new Date(m.datetime) < now;
    const isExpanded = expandedMeetingId === m.id;
    return (
      <Card key={m.id} hover onClick={() => setExpandedMeetingId(isExpanded ? null : m.id)}>
        <div className={`px-4 py-3 ${isPast ? 'opacity-60' : ''}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CalendarDays size={14} className="text-[var(--color-primary)] shrink-0" />
                <span className="font-semibold text-sm truncate">{m.title}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-[var(--color-primary)] font-medium shrink-0">미팅</span>
              </div>
              <div className="text-xs text-[var(--color-text-tertiary)] mt-1 ml-[22px]">{formatDT(m.datetime)}</div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={e => { e.stopPropagation(); openEditMeeting(m); }} className="p-1.5 rounded hover:bg-gray-100 text-[var(--color-text-tertiary)] cursor-pointer"><Pencil size={14} /></button>
              <button onClick={e => { e.stopPropagation(); deleteMeeting(m.id); }} className="p-1.5 rounded hover:bg-gray-100 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] cursor-pointer"><Trash2 size={14} /></button>
            </div>
          </div>
          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-[var(--color-border-light)] ml-[22px] space-y-2 text-xs text-[var(--color-text-secondary)]">
              {m.location && <div className="flex items-center gap-1.5"><MapPin size={12} />{m.location}</div>}
              {m.attendees.length > 0 && <div className="flex items-center gap-1.5"><Users size={12} />{m.attendees.join(', ')}</div>}
              {m.agenda && <div className="flex items-start gap-1.5"><FileText size={12} className="mt-0.5 shrink-0" /><span>{m.agenda}</span></div>}
              {m.notes && <div className="bg-gray-50 rounded-lg p-2 mt-1 text-[var(--color-text-secondary)]">{m.notes}</div>}
            </div>
          )}
        </div>
      </Card>
    );
  };

  // Show either tasks, meetings, or both
  const showTasks = itemFilter !== 'meetings';
  const showMeetings = itemFilter !== 'tasks';
  const hasVisibleTasks = showTasks && filteredTasks.length > 0;
  const hasVisibleMeetings = showMeetings && sortedMeetings.length > 0;
  const isEmpty = !hasVisibleTasks && !hasVisibleMeetings;
  const noTasks = filteredTasks.length === 0 && tasks.length > 0;

  return (
    <div className="space-y-4">
      {/* Tag Sub-tabs + Tag Manager */}
      {allTags.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <Tag size={12} className="text-[var(--color-text-tertiary)] shrink-0" />
            {allTags.map(tag => {
              const active = tagFilter === tag;
              const count = tasks.filter(t => t.tags.includes(tag)).length;
              return (
                <button
                  key={tag}
                  onClick={() => setTagFilter(active ? '' : tag)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                    active
                      ? 'bg-violet-100 text-violet-700 shadow-sm ring-1 ring-violet-300'
                      : 'bg-gray-50 text-[var(--color-text-secondary)] hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  #{tag} <span className="font-bold">{count}</span>
                </button>
              );
            })}
            {/* Tag Manager Toggle */}
            <button
              onClick={() => setShowTagManager(!showTagManager)}
              className={`shrink-0 p-1.5 rounded-full transition-all cursor-pointer ${
                showTagManager
                  ? 'bg-violet-100 text-violet-600 shadow-sm ring-1 ring-violet-300'
                  : 'text-[var(--color-text-tertiary)] hover:bg-gray-100 hover:text-[var(--color-text-secondary)]'
              }`}
              title="태그 관리"
            >
              <Settings size={13} />
            </button>
          </div>

          {/* Tag Management Panel */}
          {showTagManager && onUpdateTask && (
            <Card>
              <div className="px-4 py-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] flex items-center gap-1.5">
                    <Tag size={12} /> 태그 관리
                  </h4>
                  <button onClick={() => setShowTagManager(false)} className="p-1 rounded hover:bg-gray-100 text-[var(--color-text-tertiary)] cursor-pointer">
                    <X size={14} />
                  </button>
                </div>
                {/* Tag list */}
                <div className="space-y-1.5">
                  {allTags.map(tag => {
                    const count = tasks.filter(t => t.tags.includes(tag)).length;
                    const isEditing = editingTagFrom === tag;
                    return (
                      <div key={tag} className="flex items-center gap-2 group">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingTagTo}
                            onChange={e => setEditingTagTo(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleRenameTag(tag); if (e.key === 'Escape') setEditingTagFrom(null); }}
                            onBlur={() => handleRenameTag(tag)}
                            className="flex-1 px-2 py-1 rounded border border-violet-300 bg-violet-50 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"
                            autoFocus
                          />
                        ) : (
                          <span
                            className="flex-1 text-xs text-[var(--color-text-primary)] cursor-pointer hover:text-violet-600 transition-colors px-2 py-1 rounded hover:bg-violet-50"
                            onClick={() => { setEditingTagFrom(tag); setEditingTagTo(tag); }}
                            title="클릭하여 이름 변경"
                          >
                            #{tag}
                          </span>
                        )}
                        <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">{count}건</span>
                        <button
                          onClick={() => handleDeleteTag(tag)}
                          className="p-1 rounded hover:bg-red-50 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                          title="이 태그를 모든 업무에서 제거"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                {allTags.length === 0 && (
                  <p className="text-xs text-[var(--color-text-tertiary)] text-center py-2">등록된 태그가 없습니다</p>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold">업무 목록</h2>
        <div className="flex items-center gap-2">
          {(itemFilter === 'all' || itemFilter === 'meetings') && (
            <button onClick={openAddMeeting} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-primary)] text-[var(--color-primary)] text-sm font-medium hover:bg-blue-50 transition-colors cursor-pointer">
              <CalendarDays size={16} /> 새 미팅
            </button>
          )}
          {(itemFilter === 'all' || itemFilter === 'tasks') && (
            <button onClick={onAdd} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">
              <Plus size={16} /> 새 업무
            </button>
          )}
        </div>
      </div>

      {/* Project Summary Bar */}
      {projects.length > 0 && (
        <Card>
          <div className="px-4 py-3">
            <button
              onClick={() => setProjectBarExpanded(!projectBarExpanded)}
              className="flex items-center gap-2 w-full text-left cursor-pointer"
            >
              {projectBarExpanded ? <ChevronDown size={14} className="text-[var(--color-text-tertiary)]" /> : <ChevronRight size={14} className="text-[var(--color-text-tertiary)]" />}
              <FolderKanban size={14} className="text-[var(--color-text-secondary)]" />
              <span className="text-sm font-semibold text-[var(--color-text-secondary)]">프로젝트</span>
              <span className="text-xs text-[var(--color-text-tertiary)] ml-1">{projects.length}개</span>
              <div className="flex-1" />
              <button
                onClick={(e) => { e.stopPropagation(); setShowProjectModal(true); }}
                className="p-1 rounded hover:bg-gray-100 text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] cursor-pointer transition-colors"
              >
                <Plus size={14} />
              </button>
            </button>

            {projectBarExpanded && (
              <div className="mt-3 space-y-2">
                {projects.map(project => {
                  const progress = getProjectProgress(project.id);
                  const counts = getProjectTaskCount(project.id);
                  const isSelected = projectFilter === project.id;
                  return (
                    <div
                      key={project.id}
                      onClick={() => setProjectFilter(isSelected ? '' : project.id)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                        isSelected ? 'bg-blue-50 ring-1 ring-[var(--color-primary)]' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{project.name}</div>
                      </div>
                      <span className="text-xs text-[var(--color-text-tertiary)] shrink-0">{counts.done}/{counts.total}</span>
                      <div className="w-16 sm:w-20 shrink-0"><ProgressBar value={progress} color={project.color} /></div>
                      <span className="text-xs font-semibold shrink-0 w-8 text-right" style={{ color: project.color }}>{progress}%</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }}
                        className="p-1 rounded hover:bg-gray-100 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">

        {/* Search */}
        <div className="relative flex-1 min-w-[160px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow" placeholder="검색..." />
        </div>

        {showTasks && (
          <>
            {/* Sort Dropdown */}
            <div className="flex items-center gap-0.5 shrink-0">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortBy)}
                className={`px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer transition-colors ${
                  sortBy !== 'default'
                    ? 'border-violet-300 bg-violet-50 text-violet-700 font-medium'
                    : 'border-[var(--color-border)] bg-white text-[var(--color-text-secondary)]'
                }`}
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {sortBy !== 'default' && (
                <button
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="p-2 rounded-lg border border-violet-300 bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors cursor-pointer"
                  title={sortOrder === 'asc' ? '오름차순 (클릭하여 내림차순)' : '내림차순 (클릭하여 오름차순)'}
                >
                  {sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                </button>
              )}
            </div>

            <button
              onClick={() => setShowRecurringOnly(!showRecurringOnly)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border cursor-pointer flex items-center gap-1.5 ${
                showRecurringOnly
                  ? 'bg-teal-50 border-teal-200 text-teal-700 shadow-sm'
                  : 'bg-white border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-gray-50'
              }`}
            >
              <Repeat size={14} className={showRecurringOnly ? 'text-teal-600' : 'text-gray-400'} /> 반복 루틴
            </button>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as TaskStatus | '')} className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
              <option value="">전체 상태</option>
              <option value="todo">대기</option>
              <option value="in-progress">진행중</option>
              <option value="done">완료</option>
            </select>
          </>
        )}

        {projectFilter && (
          <button
            onClick={() => setProjectFilter('')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-[var(--color-primary)] text-xs font-medium cursor-pointer hover:bg-blue-100 transition-colors"
          >
            {projects.find(p => p.id === projectFilter)?.name} ×
          </button>
        )}
      </div>

      {/* Items List */}
      <div className="space-y-2">
        {/* Tasks */}
        {showTasks && filteredTasks.length > 0 && (
          <>
            {showMeetings && sortedMeetings.length > 0 && (
              <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide flex items-center gap-1.5 pt-1">
                <ListTodo size={12} /> 업무 · {filteredTasks.length}건
              </h3>
            )}
            {filteredTasks.map(renderTask)}
          </>
        )}

        {/* Meetings */}
        {showMeetings && sortedMeetings.length > 0 && (
          <>
            {showTasks && filteredTasks.length > 0 && <div className="pt-2" />}
            <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide flex items-center gap-1.5 pt-1">
              <CalendarDays size={12} /> 미팅 · {sortedMeetings.length}건
            </h3>
            {sortedMeetings.map(renderMeeting)}
          </>
        )}

        {/* Empty state */}
        {isEmpty && (
          <Card>
            <div className="px-5 py-10 text-center text-sm text-[var(--color-text-tertiary)]">
              {(() => {
                if (itemFilter === 'meetings') return '미팅 일정을 추가해 보세요';
                if (itemFilter === 'tasks') return noTasks ? '검색 결과가 없습니다' : '업무를 추가해 보세요!';
                return '업무 또는 미팅을 추가해 보세요';
              })()}
            </div>
          </Card>
        )}

        {/* Only tasks empty but meetings exist (in "all" or "tasks" mode) */}
        {showTasks && filteredTasks.length === 0 && !showMeetings && (
          <Card>
            <div className="px-5 py-10 text-center text-sm text-[var(--color-text-tertiary)]">
              {noTasks ? '검색 결과가 없습니다' : '업무를 추가해 보세요!'}
            </div>
          </Card>
        )}
      </div>

      {/* Meeting Modal */}
      <Modal isOpen={showMeetingModal} onClose={() => setShowMeetingModal(false)} title={editMeeting ? '미팅 수정' : '새 미팅'}>
        <form onSubmit={handleMeetingSubmit} className="space-y-4">
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">제목 *</label><input type="text" value={mTitle} onChange={e => setMTitle(e.target.value)} className={inputClass} required placeholder="미팅 제목" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">시작 *</label><input type="datetime-local" value={mDatetime} onChange={e => setMDatetime(e.target.value)} className={inputClass} required /></div>
            <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">종료</label><input type="time" value={mEndTime} onChange={e => setMEndTime(e.target.value)} className={inputClass} /></div>
          </div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">장소</label><input type="text" value={mLocation} onChange={e => setMLocation(e.target.value)} className={inputClass} placeholder="회의실, 온라인 링크 등" /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">참석자 (쉼표 구분)</label><input type="text" value={mAttendeesStr} onChange={e => setMAttendeesStr(e.target.value)} className={inputClass} placeholder="홍길동, 김철수" /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">안건</label><textarea value={mAgenda} onChange={e => setMAgenda(e.target.value)} className={`${inputClass} resize-none`} rows={2} placeholder="회의 안건" /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">메모/회의록</label><textarea value={mNotes} onChange={e => setMNotes(e.target.value)} className={`${inputClass} resize-none`} rows={3} placeholder="회의 메모" /></div>
          <button type="submit" className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">{editMeeting ? '수정' : '추가'}</button>
        </form>
      </Modal>

      {/* Project Modal */}
      <Modal isOpen={showProjectModal} onClose={() => setShowProjectModal(false)} title="새 프로젝트" size="sm">
        <form onSubmit={handleProjectSubmit} className="space-y-4">
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">프로젝트명 *</label><input type="text" value={pName} onChange={e => setPName(e.target.value)} className={inputClass} required /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">설명</label><textarea value={pDescription} onChange={e => setPDescription(e.target.value)} className={`${inputClass} resize-none`} rows={2} /></div>
          <button type="submit" className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">생성</button>
        </form>
      </Modal>
    </div>
  );
}
