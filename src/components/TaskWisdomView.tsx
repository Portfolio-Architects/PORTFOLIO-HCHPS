'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Task, TaskStatus, Meeting, Project, KnowledgeEntry } from '@/types';
import { SignalEntry } from '@/hooks/useSignal';
import { TaskModal } from '@/components/TaskModal';
import { AddDataModal } from '@/components/AddDataModal';
import { useGraphCustomization } from '@/hooks/useGraphCustomization';
import { Card } from '@/components/ui/card';
import { 
  Zap, ListTodo, Archive, CalendarDays, Edit2, Trash2, 
  MapPin, Users, FileText, CheckCircle2, Circle, Clock, Tag, ExternalLink, BrainCircuit, BookOpen,
  Plus, X, HelpCircle, AlertTriangle, ArrowRight, Loader2, Sparkles, FolderKanban, Link, Check, RefreshCw
} from 'lucide-react';

interface TaskWisdomViewProps {
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, status: TaskStatus) => void;
  meetings: Meeting[];
  addMeeting: (meeting: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateMeeting: (id: string, updates: Partial<Meeting>) => void;
  deleteMeeting: (id: string) => void;
  projects: Project[];
  addProject: (p: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'checklistItems'>) => void;
  deleteProject: (id: string) => void;
  knowledgeEntries: KnowledgeEntry[];
  addKnowledge: (entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>) => KnowledgeEntry;
  updateKnowledge: (id: string, updates: Partial<KnowledgeEntry>) => void;
  deleteKnowledge: (id: string) => void;
  filterKnowledge: (filters: { search?: string; category?: string; tag?: string }) => KnowledgeEntry[];
  knowledgeMetadata?: { categories: string[]; tags: string[] };
  signalEntries?: SignalEntry[];
  addSignal?: (text: string) => void;
  updateSignal?: (id: string, text: string) => void;
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

export function TaskWisdomView(props: TaskWisdomViewProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalMode, setAddModalMode] = useState<'memo' | 'pdf'>('memo');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo');
  
  // Filter tabs
  const [activeFeedTab, setActiveFeedTab] = useState<'all' | 'guide' | 'pitfall' | 'linked'>('all');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Edit / Form state
  const [isEditing, setIsEditing] = useState(false);
  const [isNewWisdom, setIsNewWisdom] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editPitfalls, setEditPitfalls] = useState('');
  const [editSteps, setEditSteps] = useState<string[]>(['']);
  const [editLinkedTasks, setEditLinkedTasks] = useState<string[]>([]);
  const [editLinkedProjects, setEditLinkedProjects] = useState<string[]>([]);
  const [editTagsString, setEditTagsString] = useState('');

  // AI Extractor state
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiRawInput, setAiRawInput] = useState('');
  const [aiExtracting, setAiExtracting] = useState(false);

  const openTaskModal = (task?: Task, status?: TaskStatus) => {
    setEditTask(task || null);
    setDefaultStatus(status || 'todo');
    setShowTaskModal(true);
  };

  const { overrides, customNodes } = useGraphCustomization();
  
  // Tags aggregation
  const allTags = useMemo(() => {
    return [
      ...new Set([
        ...props.tasks.flatMap(t => t.tags).filter(Boolean),
        ...(props.knowledgeMetadata?.tags || []),
        ...customNodes
          .filter(n => n.group === 'MACRO_RESEARCH' || overrides[n.id]?.customGroup === 'MACRO_RESEARCH')
          .map(n => overrides[n.id]?.customLabel || n.label)
          .map(label => label.startsWith('#') ? label.slice(1) : label)
      ])
    ];
  }, [props.tasks, props.knowledgeMetadata, customNodes, overrides]);

  // Feed items compilation
  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    (props.signalEntries || []).forEach(sig => items.push({ type: 'signal', data: sig, dateMs: new Date(sig.createdAt).getTime() }));
    props.tasks.forEach(task => items.push({ type: 'task', data: task, dateMs: new Date(task.createdAt).getTime() }));
    props.meetings.forEach(meeting => items.push({ type: 'meeting', data: meeting, dateMs: new Date(meeting.createdAt).getTime() }));
    props.knowledgeEntries.forEach(know => items.push({ type: 'knowledge', data: know, dateMs: new Date(know.createdAt).getTime() }));
    return items.sort((a, b) => b.dateMs - a.dateMs);
  }, [props.signalEntries, props.tasks, props.meetings, props.knowledgeEntries]);

  // Tab Filtering logic
  const filteredFeed = useMemo(() => {
    return feed.filter(item => {
      if (activeFeedTab === 'all') return true;
      if (item.type === 'knowledge') {
        const k = item.data as KnowledgeEntry;
        if (activeFeedTab === 'guide') return k.steps && k.steps.length > 0;
        if (activeFeedTab === 'pitfall') return k.pitfalls && k.pitfalls.trim().length > 0;
        if (activeFeedTab === 'linked') return k.linkedTaskIds && k.linkedTaskIds.length > 0;
      }
      return false;
    });
  }, [feed, activeFeedTab]);

  const activeItem = useMemo(() => {
    if (!selectedItemId) return null;
    return feed.find(i => 
      (i.type === 'signal' && i.data.id === selectedItemId) ||
      (i.type === 'task' && i.data.id === selectedItemId) ||
      (i.type === 'meeting' && i.data.id === selectedItemId) ||
      (i.type === 'knowledge' && i.data.id === selectedItemId)
    ) || null;
  }, [feed, selectedItemId]);

  // Setup form states when edit mode triggers
  const startEdit = (entry?: KnowledgeEntry) => {
    if (entry) {
      setIsNewWisdom(false);
      setEditTitle(entry.title || '');
      setEditContent(entry.content || '');
      setEditPitfalls(entry.pitfalls || '');
      setEditSteps(entry.steps && entry.steps.length > 0 ? [...entry.steps] : ['']);
      setEditLinkedTasks(entry.linkedTaskIds || []);
      setEditLinkedProjects(entry.linkedProjectIds || []);
      setEditTagsString(entry.tags ? entry.tags.join(', ') : '');
    } else {
      setIsNewWisdom(true);
      setEditTitle('');
      setEditContent('');
      setEditPitfalls('');
      setEditSteps(['']);
      setEditLinkedTasks([]);
      setEditLinkedProjects([]);
      setEditTagsString('');
    }
    setIsEditing(true);
  };

  const addStep = () => setEditSteps([...editSteps, '']);
  const removeStep = (idx: number) => {
    const updated = editSteps.filter((_, i) => i !== idx);
    setEditSteps(updated.length === 0 ? [''] : updated);
  };
  const handleStepChange = (idx: number, val: string) => {
    const updated = [...editSteps];
    updated[idx] = val;
    setEditSteps(updated);
  };

  // AI Wisdom Extractor function
  const handleAiExtract = async () => {
    if (!aiRawInput.trim()) {
      alert('분석할 원시 텍스트를 입력해주세요.');
      return;
    }
    setAiExtracting(true);
    try {
      const prompt = `다음은 업무 수행과 관련된 원시 기록(텍스트/로그/메시지 등)입니다. 이 기록을 분석하여 사용자가 나중에 참고할 수 있는 명확한 '업무 처리 노하우 및 암묵지' 문서로 정제해 주세요.
반드시 아래의 JSON 구조로만 출력해야 하며, 앞뒤 설명이나 다른 텍스트는 일체 포함하지 마세요. 오직 유효한 JSON만 반환하세요.

JSON 구조:
{
  "title": "업무/노하우를 명확히 요약한 제목 (예: '정기 예산 교부 신청 절차')",
  "content": "이 업무의 목표와 전체적인 맥락에 대한 설명 (문맥이 풍부하도록 작성)",
  "steps": [
    "1단계 구체적 지시사항 (예: '부서 내부 기안 결재 요청')",
    "2단계 구체적 지시사항"
  ],
  "pitfalls": "실패를 방지하기 위해 반드시 주의해야 하는 함정, 꿀팁, 경고 사항",
  "tags": ["키워드1", "키워드2"]
}

기록 내용:
${aiRawInput}`;

      const res = await fetch('/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          contextData: { signals: [], knowledge: [] },
          appMode: 'VITAL'
        })
      });

      if (!res.ok) throw new Error('API 요청 실패');
      const data = await res.json();
      
      // Parse structured JSON block from assistant content
      const contentText = data.content || '';
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JSON 형식을 분석할 수 없습니다. AI가 일반 텍스트로 답했습니다:\n' + contentText);
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Populate form state and switch to edit mode
      setIsNewWisdom(true);
      setEditTitle(parsed.title || '');
      setEditContent(parsed.content || '');
      setEditPitfalls(parsed.pitfalls || '');
      setEditSteps(parsed.steps && parsed.steps.length > 0 ? parsed.steps : ['']);
      setEditTagsString(parsed.tags ? parsed.tags.join(', ') : '');
      setEditLinkedTasks([]);
      setEditLinkedProjects([]);
      
      setIsEditing(true);
      setShowAiModal(false);
      setAiRawInput('');
    } catch (err: any) {
      console.error(err);
      alert('AI 분석 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setAiExtracting(false);
    }
  };

  const handleSave = () => {
    if (!editTitle.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }

    const cleanSteps = editSteps.map(s => s.trim()).filter(Boolean);
    const cleanTags = editTagsString
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const payload = {
      title: editTitle.trim(),
      content: editContent.trim(),
      pitfalls: editPitfalls.trim(),
      steps: cleanSteps,
      linkedTaskIds: editLinkedTasks,
      linkedProjectIds: editLinkedProjects,
      tags: cleanTags,
      category: '암묵지'
    };

    if (isNewWisdom) {
      const added = props.addKnowledge(payload);
      setSelectedItemId(added.id);
    } else {
      if (selectedItemId) {
        props.updateKnowledge(selectedItemId, payload);
      }
    }

    setIsEditing(false);
  };

  const toggleLinkedTask = (taskId: string) => {
    setEditLinkedTasks(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const toggleLinkedProject = (projId: string) => {
    setEditLinkedProjects(prev => 
      prev.includes(projId) ? prev.filter(id => id !== projId) : [...prev, projId]
    );
  };

  const renderLeftFeedItem = (item: FeedItem) => {
    const isSelected = selectedItemId === (item.data as { id: string }).id;
    let titleStr = '';
    let previewStr = '';
    let categoryBadge = null;
    const timeStr = formatRelativeTime(item.data.createdAt);
    const itemId = (item.data as { id: string }).id;

    if (item.type === 'signal') {
      const sig = item.data as SignalEntry;
      const isPdf = sig.text?.includes('[PDF 원본:');
      titleStr = isPdf ? 'PDF 분석 원본' : '빠른 메모';
      previewStr = sig.text;
      categoryBadge = (
        <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${isPdf ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {isPdf ? <FileText size={10} /> : <Zap size={10} />} {titleStr}
        </span>
      );
      titleStr = previewStr.substring(0, 30) + '...';
    } else if (item.type === 'task') {
      const t = item.data as Task;
      titleStr = t.title;
      previewStr = t.description || '';
      categoryBadge = <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700"><ListTodo size={10} /> 업무</span>;
    } else if (item.type === 'meeting') {
      const m = item.data as Meeting;
      titleStr = m.title;
      previewStr = (m.location ? `[${m.location}] ` : '') + (m.notes || '');
      categoryBadge = <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700"><CalendarDays size={10} /> 미팅</span>;
    } else if (item.type === 'knowledge') {
      const k = item.data as KnowledgeEntry;
      titleStr = k.title;
      previewStr = k.content;
      
      const hasSteps = k.steps && k.steps.length > 0;
      const hasPitfalls = k.pitfalls && k.pitfalls.trim().length > 0;
      
      categoryBadge = (
        <span className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm">
          <BrainCircuit size={10} /> 업무 암묵지
          {hasSteps && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" title="실행 가이드 포함" />}
          {hasPitfalls && <span className="w-1.5 h-1.5 bg-red-500 rounded-full" title="주의사항 포함" />}
        </span>
      );
    }

    return (
      <div 
        key={`feed-${item.type}-${itemId}`}
        onClick={() => { setSelectedItemId(itemId); setIsEditing(false); }}
        className={`p-4 rounded-2xl border cursor-pointer transition-all ${isSelected ? 'border-indigo-500 bg-indigo-50/20 ring-1 ring-indigo-500/20 shadow-md scale-[1.01]' : 'border-slate-100 bg-white hover:border-indigo-300'}`}
      >
        <div className="flex justify-between items-start mb-2.5 gap-2">
          {categoryBadge}
          <span className="text-[10px] text-slate-400 font-bold">{timeStr}</span>
        </div>
        <h3 className={`text-[14px] font-bold line-clamp-1 mb-1.5 ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>{titleStr}</h3>
        {previewStr && previewStr !== titleStr && (
          <p className="text-[12px] text-slate-500 line-clamp-2 leading-relaxed">{previewStr}</p>
        )}
        
        {item.type === 'knowledge' && (item.data as KnowledgeEntry).linkedTaskIds && (item.data as KnowledgeEntry).linkedTaskIds!.length > 0 && (
          <div className="flex items-center gap-1 mt-2.5 text-[10px] font-bold text-slate-400">
            <Link size={10} /> 연동된 업무 {(item.data as KnowledgeEntry).linkedTaskIds!.length}개
          </div>
        )}
      </div>
    );
  };

  const renderRightDetailPane = () => {
    if (!selectedItemId || !activeItem) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 bg-slate-50/20 h-[450px] lg:h-full">
          <div className="w-16 h-16 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-center mb-4 text-indigo-400">
            <BrainCircuit size={32} />
          </div>
          <h3 className="text-[15px] font-black text-slate-700 mb-1">암묵지 항목을 선택하세요</h3>
          <p className="text-[12px] font-bold text-slate-400 text-center max-w-sm">
            좌측 목록에서 항목을 선택하거나, &quot;AI 암묵지 추출&quot; 또는 &quot;새 암묵지&quot;를 눌러 업무 수행 팁을 체계적으로 구조화하세요.
          </p>
        </div>
      );
    }

    const itemId = (activeItem.data as { id: string }).id;

    if (isEditing) {
      return (
        <div className="flex flex-col h-full bg-white relative">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-black">
                <BrainCircuit size={12} /> {isNewWisdom ? '새 암묵지 작성' : '암묵지 편집 수정'}
              </span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsEditing(false)} 
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-[12px] font-bold rounded-xl transition-colors cursor-pointer"
              >
                취소
              </button>
              <button 
                onClick={handleSave}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-bold rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                저장하기
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/20">
            {/* Title */}
            <div>
              <label className="block text-[12px] font-black text-slate-700 mb-1.5">노하우 제목</label>
              <input 
                type="text" 
                value={editTitle} 
                onChange={e => setEditTitle(e.target.value)} 
                className="w-full text-[14px] font-black text-slate-900 bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all" 
                placeholder="어떤 지식/노하우인가요? 명확하게 기재해주세요."
              />
            </div>

            {/* Content Summary */}
            <div>
              <label className="block text-[12px] font-black text-slate-700 mb-1.5">핵심 설명 및 개요</label>
              <textarea 
                value={editContent} 
                onChange={e => setEditContent(e.target.value)} 
                className="w-full h-32 text-[14px] text-slate-700 bg-white border border-slate-200 rounded-xl p-4 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all resize-none"
                placeholder="이 업무 노하우의 전체적인 취지와 목표를 설명해 주세요."
              />
            </div>

            {/* Steps Timeline Editor */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[12px] font-black text-slate-700">실행 절차 (Step-by-Step)</label>
                <button 
                  onClick={addStep}
                  className="flex items-center gap-1 text-[11px] font-black text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  <Plus size={12} /> 단계 추가
                </button>
              </div>
              <div className="space-y-2">
                {editSteps.map((step, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <span className="w-6 shrink-0 text-center text-[12px] font-black text-indigo-500">{idx + 1}</span>
                    <input 
                      type="text" 
                      value={step}
                      onChange={e => handleStepChange(idx, e.target.value)}
                      placeholder={`${idx + 1}단계 지시 사항을 입력하세요.`}
                      className="flex-1 text-[13px] font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-3.5 py-2 outline-none focus:border-indigo-500 transition-all"
                    />
                    <button 
                      onClick={() => removeStep(idx)}
                      className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Pitfalls & Trapdoors */}
            <div>
              <label className="block text-[12px] font-black text-slate-700 mb-1.5">주의사항 및 함정 피하기</label>
              <textarea 
                value={editPitfalls} 
                onChange={e => setEditPitfalls(e.target.value)} 
                className="w-full h-24 text-[13px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl p-4 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all resize-none"
                placeholder="자주 실수하거나 발생하기 쉬운 경고 사항, 함정 팁 등을 기술해주세요."
              />
            </div>

            {/* Link Tasks Checklist */}
            <div>
              <label className="block text-[12px] font-black text-slate-700 mb-2">연동할 업무 (선택)</label>
              <div className="bg-white border border-slate-200 rounded-xl max-h-48 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {props.tasks.map(task => {
                  const isChecked = editLinkedTasks.includes(task.id);
                  return (
                    <div 
                      key={task.id} 
                      onClick={() => toggleLinkedTask(task.id)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${isChecked ? 'bg-indigo-50 text-indigo-800' : 'hover:bg-slate-50 text-slate-700'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isChecked ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-300'}`}>
                          {isChecked && <Check size={10} strokeWidth={3} />}
                        </div>
                        <span className="text-[12px] font-bold truncate">{task.title}</span>
                      </div>
                      <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded shrink-0 ${task.status === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {task.status}
                      </span>
                    </div>
                  );
                })}
                {props.tasks.length === 0 && (
                  <p className="text-center text-xs text-slate-400 py-4">등록된 업무가 없습니다.</p>
                )}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-[12px] font-black text-slate-700 mb-1.5">태그</label>
              <input 
                type="text" 
                value={editTagsString} 
                onChange={e => setEditTagsString(e.target.value)} 
                className="w-full text-[13px] font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 transition-all" 
                placeholder="쉼표(,)로 구분하여 입력하세요 (예: 품의서, 주의사항, 가이드)"
              />
            </div>
          </div>
        </div>
      );
    }

    // Detail View Render Mode
    let titleStr = '';
    let contentStr = '';
    let categoryBadge = null;
    let extraMeta: React.ReactNode = null;
    let linkedTasksRender: React.ReactNode = null;
    let stepsRender: React.ReactNode = null;
    let pitfallsRender: React.ReactNode = null;

    if (activeItem.type === 'signal') {
      const sig = activeItem.data as SignalEntry;
      const isPdf = sig.text?.includes('[PDF 원본:');
      titleStr = isPdf ? 'PDF 원본 데이터 전문' : '빠른 메모 전문';
      contentStr = sig.text;
      categoryBadge = (
        <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black border ${isPdf ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'}`}>
          {isPdf ? <FileText size={12} /> : <Zap size={12} />} {isPdf ? 'PDF 분석본' : '빠른 메모'}
        </span>
      );
    } else if (activeItem.type === 'task') {
      const t = activeItem.data as Task;
      titleStr = t.title;
      contentStr = t.description || '상세 설명이 등록되지 않았습니다.';
      categoryBadge = (
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-50 border border-blue-100 text-blue-700">
          <ListTodo size={12} /> 연동 업무
        </span>
      );
      extraMeta = (
        <div className="flex flex-wrap items-center gap-2 my-3">
          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${t.status === 'done' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-blue-700 border-blue-200 bg-blue-50'}`}>
            상태: {t.status}
          </span>
          {t.dueDate && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 bg-white">마감일: {t.dueDate}</span>}
          {t.tags.map(tag => <span key={tag} className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50">#{tag}</span>)}
        </div>
      );
    } else if (activeItem.type === 'meeting') {
      const m = activeItem.data as Meeting;
      titleStr = m.title;
      contentStr = `[일시]\n${new Date(m.datetime).toLocaleString('ko-KR')}\n\n[장소]\n${m.location || '미정'}\n\n[참석자]\n${m.attendees?.join(', ') || '없음'}\n\n[아젠다/내용]\n${m.notes || m.agenda || '내용 없음'}`;
      categoryBadge = (
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-purple-50 border border-purple-100 text-purple-700">
          <CalendarDays size={12} /> 미팅/회의록
        </span>
      );
    } else if (activeItem.type === 'knowledge') {
      const k = activeItem.data as KnowledgeEntry;
      titleStr = k.title;
      contentStr = k.content;
      categoryBadge = (
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-indigo-50 border border-indigo-100 text-indigo-700">
          <BrainCircuit size={12} /> 업무 암묵지
        </span>
      );

      // Render tags
      extraMeta = k.tags && k.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 my-3">
          {k.tags.map(tag => (
            <span key={tag} className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
              #{tag}
            </span>
          ))}
        </div>
      );

      // Steps roadmap rendering
      if (k.steps && k.steps.length > 0) {
        stepsRender = (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <h3 className="text-[13px] font-black text-slate-800 mb-4 flex items-center gap-2">
              <ArrowRight size={14} className="text-indigo-600" />
              권장 실행 순서 (Roadmap)
            </h3>
            <div className="relative pl-6 border-l-2 border-dashed border-indigo-200 space-y-5 ml-3">
              {k.steps.map((step, idx) => (
                <div key={idx} className="relative group">
                  {/* Step bullet */}
                  <div className="absolute -left-[35px] top-0 w-6 h-6 rounded-full bg-white border-2 border-indigo-500 flex items-center justify-center text-[11px] font-black text-indigo-600 shadow-sm">
                    {idx + 1}
                  </div>
                  <div className="bg-slate-50/50 hover:bg-slate-50 p-3 rounded-xl border border-slate-100 transition-colors">
                    <p className="text-[13px] font-bold text-slate-800">{step}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      // Pitfalls caution card rendering
      if (k.pitfalls && k.pitfalls.trim().length > 0) {
        pitfallsRender = (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="bg-rose-50/65 border border-rose-200/50 rounded-2rem p-5 flex gap-3.5 relative overflow-hidden">
              <div className="absolute right-0 bottom-0 text-rose-100 translate-x-3 translate-y-3 pointer-events-none">
                <AlertTriangle size={80} strokeWidth={1} />
              </div>
              <div className="shrink-0 w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mt-0.5">
                <AlertTriangle size={16} />
              </div>
              <div className="space-y-1.5 relative z-10">
                <h4 className="text-[13px] font-black text-rose-900">절대 주의! 경고 및 꿀팁 (Pitfalls Avoidance)</h4>
                <p className="text-[12px] font-semibold text-rose-700/90 leading-relaxed whitespace-pre-wrap">
                  {k.pitfalls}
                </p>
              </div>
            </div>
          </div>
        );
      }

      // Associated tasks link box
      if (k.linkedTaskIds && k.linkedTaskIds.length > 0) {
        const linkedTasks = props.tasks.filter(t => k.linkedTaskIds!.includes(t.id));
        if (linkedTasks.length > 0) {
          linkedTasksRender = (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <h3 className="text-[13px] font-black text-slate-800 mb-3.5 flex items-center gap-2">
                <Link size={14} className="text-slate-500" />
                이 노하우와 관련된 사내 업무 ({linkedTasks.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {linkedTasks.map(t => (
                  <div 
                    key={t.id}
                    onClick={() => openTaskModal(t)}
                    className="group border border-slate-100 rounded-2xl p-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-all hover:border-slate-200 shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] font-black text-slate-800 truncate group-hover:text-indigo-600">{t.title}</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">마감: {t.dueDate || '없음'}</p>
                    </div>
                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border shrink-0 ${t.status === 'done' ? 'text-emerald-700 border-emerald-100 bg-emerald-50' : 'text-blue-700 border-blue-100 bg-blue-50'}`}>
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
      }
    }

    return (
      <div className="flex flex-col h-full bg-white relative">
        {/* Top bar header */}
        <div className="p-6 border-b border-slate-100 shrink-0 flex items-center justify-between shadow-sm relative z-10 bg-white">
          <div>
            {categoryBadge}
          </div>
          
          <div className="flex items-center gap-2">
            {(activeItem.type === 'knowledge') && (
              <button 
                onClick={() => startEdit(activeItem.data as KnowledgeEntry)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-[12px] font-bold transition-colors cursor-pointer text-slate-600"
              >
                <Edit2 size={13} /> 편집
              </button>
            )}

            <button 
              onClick={() => {
                if(window.confirm('정말 삭제하시겠습니까?')) {
                  if (activeItem.type === 'signal') props.deleteSignal?.(itemId);
                  else if (activeItem.type === 'task') props.deleteTask(itemId);
                  else if (activeItem.type === 'meeting') props.deleteMeeting(itemId);
                  else if (activeItem.type === 'knowledge') props.deleteKnowledge(itemId);
                  setSelectedItemId(null);
                }
              }} 
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-red-100"
              title="삭제"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Scrollable details */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar bg-slate-50/10">
          <h1 className="text-[20px] font-black text-slate-900 leading-snug mb-2">{titleStr}</h1>
          {extraMeta}
          <div className="text-[11px] font-bold text-slate-400 mb-6">등록 일시: {new Date(activeItem.data.createdAt).toLocaleString('ko-KR')}</div>

          {/* Description Content */}
          <div className="text-[13px] font-semibold text-slate-700 leading-[1.8] whitespace-pre-wrap bg-white rounded-2rem p-5 border border-slate-100 shadow-inner">
            {contentStr}
          </div>

          {/* Steps Timeline (Roadmap) */}
          {stepsRender}

          {/* Caution pitfalls warnings */}
          {pitfallsRender}

          {/* Linked tasks */}
          {linkedTasksRender}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 h-full relative">
      {/* Top Header Grid */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm shrink-0">
        <div className="flex flex-row flex-nowrap whitespace-nowrap bg-slate-50 border border-slate-100 p-1.5 rounded-2xl w-full lg:w-auto overflow-x-auto custom-scrollbar">
          {(['all', 'guide', 'pitfall', 'linked'] as const).map(tabKey => (
            <button
              key={tabKey}
              onClick={() => { setActiveFeedTab(tabKey); setSelectedItemId(null); }}
              className={`px-5 py-2.5 text-[12px] font-black rounded-xl transition-all flex-shrink-0 cursor-pointer ${activeFeedTab === tabKey ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/50'}`}
            >
              {tabKey === 'all' ? '전체 암묵지 목록' : tabKey === 'guide' ? '🔧 실행 가이드' : tabKey === 'pitfall' ? '⚠️ 주의사항 포함' : '🔗 업무 연결'}
            </button>
          ))}
        </div>
        
        <div className="flex gap-2 w-full lg:w-auto">
          <button 
            onClick={() => setShowAiModal(true)}
            className="flex-1 lg:flex-none px-4.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-xl text-[12px] font-extrabold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Sparkles size={14} className="text-indigo-600" />
            AI 암묵지 추출
          </button>
          <button 
            onClick={() => startEdit()}
            className="flex-1 lg:flex-none px-4.5 py-2.5 bg-slate-900 text-white rounded-xl text-[12px] font-extrabold hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus size={14} />
            새 암묵지 등록
          </button>
        </div>
      </div>

      {/* Main Panel View */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left column master list */}
        <div className="w-full lg:w-[350px] xl:w-[380px] flex flex-col gap-2.5 overflow-y-auto pr-1 flex-shrink-0 custom-scrollbar pb-6">
          {filteredFeed.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 border-dashed">
              <BrainCircuit size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-[12px] font-black text-slate-400">조회된 암묵지가 없습니다.</p>
              <button 
                onClick={() => startEdit()}
                className="mt-4 px-4 py-2 border border-slate-200 rounded-xl text-[11px] font-extrabold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                + 첫 암묵지 만들기
              </button>
            </div>
          ) : (
            filteredFeed.map(item => renderLeftFeedItem(item))
          )}
        </div>

        {/* Right column detailed viewer */}
        <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden min-h-[500px] lg:min-h-0">
          {renderRightDetailPane()}
        </div>
      </div>

      {/* AI Extraction Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-indigo-50/50 shrink-0">
              <h3 className="text-[15px] font-black text-indigo-900 flex items-center gap-2">
                <Sparkles size={18} className="text-indigo-600" />
                AI 암묵지 추출기 (Wisdom Extractor)
              </h3>
              <button 
                onClick={() => setShowAiModal(false)}
                className="p-1 rounded-full text-slate-400 hover:bg-indigo-100 hover:text-indigo-700 cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              <p className="text-[12px] font-bold text-slate-500">
                업무 처리 과정에서 메모했던 피드백, 메신저 대화 캡처 텍스트, 혹은 에러 로그 등을 자유롭게 붙여넣으세요.
                AI가 핵심 노하우, 실행 절차(Steps), 주의점(Pitfalls)을 한눈에 보기 쉽게 구조화하여 입력 폼에 채워드립니다.
              </p>
              
              <textarea 
                value={aiRawInput}
                onChange={e => setAiRawInput(e.target.value)}
                placeholder="여기에 자유로운 업무 수행 기록을 입력하거나 복사하여 붙여넣으세요..."
                className="w-full h-64 border border-slate-200 rounded-2rem p-4 text-[13px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none shadow-inner"
              />
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 shrink-0">
              <button 
                onClick={() => setShowAiModal(false)}
                className="px-4 py-2 text-[12px] font-bold text-slate-500 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors"
                disabled={aiExtracting}
              >
                취소
              </button>
              <button 
                onClick={handleAiExtract}
                className="px-5 py-2.5 text-[12px] font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                disabled={aiExtracting}
              >
                {aiExtracting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    노하우 분석 및 추출 중...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    AI 노하우 분석 시작
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task & Data Modals */}
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

      <AddDataModal
        isOpen={showAddModal}
        initialMode={addModalMode}
        onClose={() => setShowAddModal(false)}
        onAddSignal={(text) => props.addSignal?.(text)}
        onAddTask={(title, desc) => props.addTask({ title, description: desc, status: 'todo', priority: 'medium', category: '', tags: [] })}
        onAddKnowledge={(title, content) => props.addKnowledge({ title, content, tags: [], category: '' })}
        onAddMeeting={(title, notes) => props.addMeeting({ title, notes, datetime: new Date().toISOString(), attendees: [] })}
      />
    </div>
  );
}
