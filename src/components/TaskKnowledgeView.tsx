'use client';

import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, Meeting, Project, KnowledgeEntry } from '@/types';
import { SignalEntry } from '@/hooks/useSignal';
import { TaskModal } from '@/components/TaskModal';
import { useGraphCustomization } from '@/hooks/useGraphCustomization';
import { Card } from '@/components/ui/card';
import { 
  Zap, ListTodo, Archive, CalendarDays, Edit2, Trash2, 
  MapPin, Users, FileText, CheckCircle2, Circle, Clock
} from 'lucide-react';

interface TaskKnowledgeViewProps {
  // Tasks
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, status: TaskStatus) => void;
  // Meetings
  meetings: Meeting[];
  addMeeting: (meeting: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateMeeting: (id: string, updates: Partial<Meeting>) => void;
  deleteMeeting: (id: string) => void;
  // Projects
  projects: Project[];
  addProject: (p: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'checklistItems'>) => void;
  deleteProject: (id: string) => void;
  // Knowledge
  knowledgeEntries: KnowledgeEntry[];
  addKnowledge: (entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateKnowledge: (id: string, updates: Partial<KnowledgeEntry>) => void;
  deleteKnowledge: (id: string) => void;
  filterKnowledge: (filters: { search?: string; category?: string; tag?: string }) => KnowledgeEntry[];
  knowledgeMetadata?: { categories: string[]; tags: string[] };
  // Signals
  signalEntries?: SignalEntry[];
  deleteSignal?: (id: string) => void;
}

type FeedItem = 
  | { type: 'signal'; data: SignalEntry; dateMs: number }
  | { type: 'task'; data: Task; dateMs: number }
  | { type: 'meeting'; data: Meeting; dateMs: number }
  | { type: 'knowledge'; data: KnowledgeEntry; dateMs: number };

function formatRelativeTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHrs < 24) return `${diffHrs}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export function TaskKnowledgeView(props: TaskKnowledgeViewProps) {
  // Task Modal State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo');

  const openTaskModal = (task?: Task, status?: TaskStatus) => {
    setEditTask(task || null);
    setDefaultStatus(status || 'todo');
    setShowTaskModal(true);
  };

  const { overrides, customNodes } = useGraphCustomization();

  const allTags = useMemo(() => {
    return [
      ...new Set([
        ...props.tasks.flatMap(t => t.tags).filter(Boolean),
        ...customNodes
          .filter(n => n.group === 'MACRO_RESEARCH' || overrides[n.id]?.customGroup === 'MACRO_RESEARCH')
          .map(n => overrides[n.id]?.customLabel || n.label)
          .map(label => label.startsWith('#') ? label.slice(1) : label)
      ])
    ];
  }, [props.tasks, customNodes, overrides]);

  // Build the chronological feed
  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    
    (props.signalEntries || []).forEach(sig => {
      items.push({ type: 'signal', data: sig, dateMs: new Date(sig.createdAt).getTime() });
    });
    
    props.tasks.forEach(task => {
      items.push({ type: 'task', data: task, dateMs: new Date(task.createdAt).getTime() });
    });

    props.meetings.forEach(meeting => {
      items.push({ type: 'meeting', data: meeting, dateMs: new Date(meeting.createdAt).getTime() });
    });

    props.knowledgeEntries.forEach(know => {
      items.push({ type: 'knowledge', data: know, dateMs: new Date(know.createdAt).getTime() });
    });

    // Sort descending (newest first)
    return items.sort((a, b) => b.dateMs - a.dateMs);
  }, [props.signalEntries, props.tasks, props.meetings, props.knowledgeEntries]);

  const renderFeedItem = (item: FeedItem) => {
    switch (item.type) {
      case 'signal': {
        const sig = item.data;
        return (
          <Card key={`sig-${sig.id}`} className="p-4 hover:border-emerald-200 transition-colors group">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-xs font-semibold">
                <Zap size={12} /> 시그널 (아무말)
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{formatRelativeTime(sig.createdAt)}</span>
                {props.deleteSignal && (
                  <button onClick={() => props.deleteSignal!(sig.id)} className="text-gray-300 hover:text-red-500 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
            <p className="text-[15px] text-gray-800 leading-relaxed font-medium">{sig.text}</p>
            {sig.keywords && sig.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {sig.keywords.map(kw => (
                  <span key={kw} className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md">#{kw}</span>
                ))}
              </div>
            )}
          </Card>
        );
      }
      
      case 'task': {
        const task = item.data;
        return (
          <Card key={`task-${task.id}`} className="p-0 overflow-hidden group hover:border-blue-200 transition-colors">
            <div className="flex items-stretch">
              {/* Checkbox Ribbon */}
              <div 
                className={`w-12 flex flex-col items-center justify-start pt-4 cursor-pointer transition-colors ${task.status === 'done' ? 'bg-gray-50' : 'bg-blue-50/30 hover:bg-blue-50'}`}
                onClick={() => props.moveTask(task.id, task.status === 'done' ? 'todo' : 'done')}
              >
                {task.status === 'done' 
                  ? <CheckCircle2 size={20} className="text-emerald-500" />
                  : <Circle size={20} className="text-blue-300 hover:text-blue-500" />
                }
              </div>
              
              <div className="flex-1 p-4">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full text-xs font-semibold mb-1 w-fit">
                    <ListTodo size={12} /> 업무
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{formatRelativeTime(task.createdAt)}</span>
                    <button onClick={() => openTaskModal(task)} className="text-gray-300 hover:text-blue-500 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => props.deleteTask(task.id)} className="text-gray-300 hover:text-red-500 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <h3 className={`text-[15px] font-semibold ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                  {task.title}
                </h3>
                {task.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                )}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {task.dueDate && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                      <Clock size={10} /> 마감: {task.dueDate.replace('T', ' ')}
                    </span>
                  )}
                  {task.tags.map(tag => (
                    <span key={tag} className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md">#{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        );
      }

      case 'meeting': {
        const m = item.data;
        return (
          <Card key={`meet-${m.id}`} className="p-4 hover:border-purple-200 transition-colors group">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-1.5 text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full text-xs font-semibold">
                <CalendarDays size={12} /> 미팅/일정
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{formatRelativeTime(m.createdAt)}</span>
                <button onClick={() => props.deleteMeeting(m.id)} className="text-gray-300 hover:text-red-500 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <h3 className="text-[15px] font-semibold text-gray-900 mb-1">{m.title}</h3>
            <div className="flex flex-col gap-1 text-xs text-gray-500 mt-2 bg-gray-50 p-3 rounded-lg">
              <div className="flex items-center gap-1.5"><Clock size={12} />일시: {new Date(m.datetime).toLocaleString('ko-KR')}</div>
              {m.location && <div className="flex items-center gap-1.5"><MapPin size={12} />장소: {m.location}</div>}
              {m.attendees && m.attendees.length > 0 && <div className="flex items-center gap-1.5"><Users size={12} />참석: {m.attendees.join(', ')}</div>}
            </div>
          </Card>
        );
      }

      case 'knowledge': {
        const k = item.data;
        return (
          <Card key={`know-${k.id}`} className="p-4 hover:border-amber-200 transition-colors group">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-xs font-semibold">
                <Archive size={12} /> 지식/문서
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{formatRelativeTime(k.createdAt)}</span>
                <button onClick={() => props.deleteKnowledge(k.id)} className="text-gray-300 hover:text-red-500 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              {k.category && <span className="text-[10px] font-bold text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded">{k.category}</span>}
              <h3 className="text-[15px] font-semibold text-gray-900">{k.title}</h3>
            </div>
            <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed whitespace-pre-wrap">{k.content}</p>
            {k.tags && k.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {k.tags.map(tag => (
                  <span key={tag} className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md">#{tag}</span>
                ))}
              </div>
            )}
          </Card>
        );
      }
    }
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
        <h2 className="text-lg font-bold text-gray-800">통합 피드</h2>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{feed.length}개의 기록</span>
      </div>

      <div className="space-y-4 max-w-3xl mx-auto pb-12">
        {feed.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Archive className="mx-auto mb-3 opacity-20" size={48} />
            <p>기록된 데이터가 없습니다.</p>
            <p className="text-xs mt-1">위에 위치한 단축 입력창에 아무 말이나 입력해 보세요!</p>
          </div>
        ) : (
          feed.map(item => renderFeedItem(item))
        )}
      </div>

      <TaskModal
        isOpen={showTaskModal}
        onClose={() => { setShowTaskModal(false); setEditTask(null); }}
        onSave={(task) => props.addTask({ ...task, status: defaultStatus })}
        editTask={editTask}
        onUpdate={props.updateTask}
        allTags={allTags}
        projects={props.projects.map(p => ({ id: p.id, name: p.name }))}
        knowledgeEntries={props.knowledgeEntries}
      />
    </>
  );
}
