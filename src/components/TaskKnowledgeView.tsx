'use client';

import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, Meeting, Project, KnowledgeEntry } from '@/types';
import { SignalEntry } from '@/hooks/useSignal';
import { TaskModal } from '@/components/TaskModal';
import { AddDataModal } from '@/components/AddDataModal';
import { useGraphCustomization } from '@/hooks/useGraphCustomization';
import { Card } from '@/components/ui/card';
import { 
  Zap, ListTodo, Archive, CalendarDays, Edit2, Trash2, 
  MapPin, Users, FileText, CheckCircle2, Circle, Clock, Tag, ExternalLink, BrainCircuit
} from 'lucide-react';
import { WikiEditor } from './WikiEditor';

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
  addSignal?: (text: string) => void;
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
  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalMode, setAddModalMode] = useState<'memo' | 'pdf'>('memo');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo');
  const [editingWikiNode, setEditingWikiNode] = useState<{id: string; title: string; initialBlocks?: any[]} | null>(null);
  const [viewingRawData, setViewingRawData] = useState<{title: string; content: string} | null>(null);
  const [activeFeedTab, setActiveFeedTab] = useState<'all' | 'memo' | 'pdf'>('all');

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

  const filteredFeed = useMemo(() => {
    return feed.filter(item => {
      if (activeFeedTab === 'all') return true;
      if (item.type === 'signal') {
        const isPdf = item.data.text?.includes('[PDF 원본:');
        if (activeFeedTab === 'pdf') return isPdf;
        if (activeFeedTab === 'memo') return !isPdf;
      }
      return false; // Hide non-signal items if not in 'all' view when filtering by signal types
    });
  }, [feed, activeFeedTab]);

  const [extractingId, setExtractingId] = useState<string | null>(null);

  const handleExtractWiki = async (e: React.MouseEvent, nodeId: string, itemType: string, itemTitle: string, rawContent: string) => {
    e.stopPropagation();
    if (extractingId) return;
    
    try {
      setExtractingId(nodeId);
      const { askLlama } = await import('@/lib/llm-client');
      
      const prompt = `다음은 사용자가 남긴 '${itemType}' 형태의 RAW 데이터입니다:
제목: ${itemTitle}
원문:
${rawContent}

[지시사항]
이 본문에 포함된 모든 디테일(세세한 항목, 설명, 수치, 문장 등)을 절대로 누락하거나 임의로 '요약'하지 마십시오. 분량을 축소시키지 말고, 원문에 있는 내용을 가급적 '충분한 길이의 서술형 문장'과 풍부한 텍스트로 보존하십시오. 
단순 명사형 단답이나 지나친 요약식 글머리기호 사용을 지양하고, 원문의 깊이를 100% 살려 공식적인 마크다운(Markdown) 위키 문서 형태로 구조화(대제목, 중제목 등)만 수행하여 작성해 주십시오.
인사말이나 부가 설명은 절대 출력하지 마십시오.`;
      
      const response = await askLlama([
        { role: 'system', content: '당신은 입력된 텍스트의 분량과 디테일을 완벽하게 보존하면서 구조만 마크다운(Markdown) 백과사전 형태로 다듬는 수석 지식 큐레이터입니다. 내용을 요약하여 짧게 만들면 안 됩니다.' },
        { role: 'user', content: prompt }
      ]);

      const lines = response.split('\n');
      const blocks = lines.map(line => ({ type: 'paragraph', content: line }));
      
      // Save locally
      localStorage.setItem(`HCHPS-Wiki-${nodeId}`, JSON.stringify(blocks));
      
      // Save to Cloudflare SSOT
      const { replaceAll } = await import('@/lib/sheets-api');
      await replaceAll(`WIKI_DOC_${nodeId}`, [{ id: 'singleton', blocks }]);

      alert('✨ 지정된 RAW 데이터가 위키 문서로 정제되어 연동 전송되었습니다!');
      // Force re-render to update the button status
      setExtractingId(nodId => nodId); 
    } catch (e) {
      console.error(e);
      alert('위키 다큐 변환 중 오류가 발생했습니다.');
    } finally {
      setExtractingId(null);
    }
  };

  const renderFeedItem = (item: FeedItem) => {
    switch (item.type) {
      case 'signal': {
        const sig = item.data;
        const isPdf = sig.text?.includes('[PDF 원본:');
        return (
          <Card key={`sig-${sig.id}`} className={`p-4 transition-colors group ${isPdf ? 'hover:border-amber-200' : 'hover:border-emerald-200'}`}>
            <div className="flex justify-between items-start mb-2">
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${isPdf ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50'}`}>
                {isPdf ? <FileText size={12} /> : <Zap size={12} />} 
                {isPdf ? 'PDF 원문 데이터' : '빠른 텍스트 메모'}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{formatRelativeTime(sig.createdAt)}</span>
                
                {localStorage.getItem(`HCHPS-Wiki-${sig.id}`) ? (
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const blocks = JSON.parse(localStorage.getItem(`HCHPS-Wiki-${sig.id}`) || '[]');
                        setEditingWikiNode({ id: sig.id, title: isPdf ? 'PDF 지식' : '메모 아이디어', initialBlocks: blocks });
                      }}
                      className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50/80 px-2 py-1 rounded-md border border-blue-100 hover:bg-blue-100 transition-colors"
                    >
                      ✅ 위키 문서 보기/수정
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('기존 위키 문서 내용이 삭제되고 AI가 새로 작성합니다. 계속 진행하시겠습니까?')) {
                          handleExtractWiki(e, sig.id, isPdf ? 'PDF 지식' : '빠른 메모', isPdf ? 'PDF 원문 구조화' : '메모 아이디어', sig.text);
                        }
                      }}
                      className="flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-50/80 px-2 py-1 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      {extractingId === sig.id ? '정제중...' : '🔄 다시 정제'}
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={(e) => handleExtractWiki(e, sig.id, isPdf ? 'PDF 지식' : '빠른 메모', isPdf ? 'PDF 원문 구조화' : '메모 아이디어', sig.text)}
                    className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border transition-colors ${isPdf ? 'text-amber-600 bg-amber-50/80 border-amber-100 hover:bg-amber-100' : 'text-emerald-600 bg-emerald-50/80 border-emerald-100 hover:bg-emerald-100'}`}
                  >
                    {extractingId === sig.id ? '정제중...' : '✨ 위키 정제 (LLM)'}
                  </button>
                )}

                {props.deleteSignal && (
                  <button onClick={() => { if(window.confirm('정말 삭제하시겠습니까?')) props.deleteSignal?.(sig.id); }} className="text-gray-400 hover:text-red-500 cursor-pointer opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
            <p 
              onClick={() => setViewingRawData({ title: isPdf ? 'PDF 원문 데이터' : '빠른 텍스트 메모', content: sig.text })}
              className="text-[15px] text-gray-800 font-medium truncate cursor-pointer hover:text-blue-600 transition-colors"
              title="클릭하여 전체 내용 보기"
            >
              {sig.text}
            </p>
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
                    <button 
                      onClick={(e) => handleExtractWiki(e, `task-${task.id}`, '업무(Task)', task.title, task.description || '')}
                      className="flex items-center gap-1 text-[11px] font-medium text-blue-600 bg-blue-50/80 px-2 py-1 rounded-md border border-blue-100 hover:bg-blue-100 transition-colors"
                    >
                      {extractingId === `task-${task.id}` ? '정제중...' : '✨ 위키 정제 (LLM)'}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); openTaskModal(task); }} className="text-gray-300 hover:text-blue-500 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); if(window.confirm('정말 삭제하시겠습니까?')) props.deleteTask(task.id); }} className="text-gray-400 hover:text-red-500 cursor-pointer opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
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
                <button 
                  onClick={(e) => handleExtractWiki(e, `meet-${m.id}`, '미팅/회의', m.title, (m.agenda || '') + '\n' + (m.notes || ''))}
                  className="flex items-center gap-1 text-[11px] font-medium text-purple-600 bg-purple-50/80 px-2 py-1 rounded-md border border-purple-100 hover:bg-purple-100 transition-colors"
                >
                  {extractingId === `meet-${m.id}` ? '정제중...' : '✨ 위키 정제 (LLM)'}
                </button>
                <button onClick={(e) => { e.stopPropagation(); if(window.confirm('정말 삭제하시겠습니까?')) props.deleteMeeting(m.id); }} className="text-gray-400 hover:text-red-500 cursor-pointer opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
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
                <button 
                  onClick={(e) => handleExtractWiki(e, `know-${k.id}`, '지식/문서', k.title, k.content)}
                  className="flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50/80 px-2 py-1 rounded-md border border-amber-100 hover:bg-amber-100 transition-colors"
                >
                  {extractingId === `know-${k.id}` ? '정제중...' : '✨ 위키 정제 (LLM)'}
                </button>
                <button onClick={(e) => { e.stopPropagation(); if(window.confirm('정말 삭제하시겠습니까?')) props.deleteKnowledge(k.id); }} className="text-gray-400 hover:text-red-500 cursor-pointer opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
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
    <div className="flex flex-col gap-4 h-full">
      {/* Header Area */}
      <div className="flex justify-end shrink-0 gap-2">
        <button 
          onClick={() => { setAddModalMode('pdf'); setShowAddModal(true); }}
          className="w-full sm:w-auto px-4 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl shadow-sm font-medium hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
        >
          <FileText size={16} className="text-amber-500" />PDF 분석
        </button>
        <button 
          onClick={() => { setAddModalMode('memo'); setShowAddModal(true); }}
          className="w-full sm:w-auto px-5 py-2.5 bg-gray-900 text-white rounded-xl shadow-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
        >
          <Zap size={16} className="text-amber-400" />새 메모 작성
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pt-2 pb-10">
        <div className="max-w-4xl mx-auto flex flex-col space-y-4">
          
          <div className="flex flex-row flex-nowrap whitespace-nowrap bg-gray-100 p-1.5 rounded-xl mb-2 w-full sm:w-fit self-center mx-auto shadow-inner overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setActiveFeedTab('all')}
              className={`px-6 py-2 text-sm font-bold rounded-lg transition-all flex-shrink-0 ${activeFeedTab === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              모든 항목
            </button>
            <button
              onClick={() => setActiveFeedTab('memo')}
              className={`px-6 py-2 text-sm font-bold rounded-lg transition-all flex-shrink-0 ${activeFeedTab === 'memo' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              빠른 메모
            </button>
            <button
              onClick={() => setActiveFeedTab('pdf')}
              className={`px-6 py-2 text-sm font-bold rounded-lg transition-all flex-shrink-0 ${activeFeedTab === 'pdf' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              PDF 분석
            </button>
          </div>

          {filteredFeed.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-[var(--color-border-light)] border-dashed">
              <FileText size={48} className="mx-auto text-gray-200 mb-4" />
              <p className="text-[var(--color-text-secondary)]">해당 탭에 기록된 항목이 없습니다.</p>
              {activeFeedTab === 'pdf' ? (
                <button 
                  onClick={() => { setAddModalMode('pdf'); setShowAddModal(true); }}
                  className="mt-4 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-amber-50 transition-colors"
                >
                  새 PDF 추가하기
                </button>
              ) : (
                <button 
                  onClick={() => { setAddModalMode('memo'); setShowAddModal(true); }}
                  className="mt-4 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-emerald-50 transition-colors"
                >
                  새 메모 추가하기
                </button>
              )}
            </div>
          ) : (
            filteredFeed.map(item => renderFeedItem(item))
          )}
        </div>
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

      <AddDataModal
        isOpen={showAddModal}
        initialMode={addModalMode}
        onClose={() => setShowAddModal(false)}
        onAddSignal={(text) => props.addSignal?.(text)}
        onAddTask={(title, desc) => props.addTask({ title, description: desc, status: 'todo', priority: 'medium', category: '', tags: [] })}
        onAddKnowledge={(title, content) => props.addKnowledge({ title, content, tags: [], category: '' })}
        onAddMeeting={(title, notes) => props.addMeeting({ title, notes, datetime: new Date().toISOString(), attendees: [] })}
      />

      {editingWikiNode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col pt-4 px-4 pb-4">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-bold flex items-center gap-2">📝 정제된 위키 문서 열람 및 수정</h2>
              <button 
                onClick={() => setEditingWikiNode(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
              >
                닫기
              </button>
            </div>
            <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
              <WikiEditor 
                nodeId={editingWikiNode.id} 
                nodeTitle={editingWikiNode.title} 
                initialBlocks={editingWikiNode.initialBlocks} 
                onChange={(blocks) => {
                  localStorage.setItem(`HCHPS-Wiki-${editingWikiNode.id}`, JSON.stringify(blocks));
                  import('@/lib/sheets-api').then(({ replaceAll }) => {
                    replaceAll(`WIKI_DOC_${editingWikiNode.id}`, [{ id: 'singleton', blocks }]);
                  });
                }}
              />
            </div>
          </div>
        </div>
      )}

      {viewingRawData && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50" onClick={() => setViewingRawData(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold flex items-center gap-2">🔍 {viewingRawData.title} 원문 보기</h2>
              <button 
                onClick={() => setViewingRawData(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
              >
                닫기
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <p className="text-[15px] text-gray-800 leading-relaxed font-medium whitespace-pre-wrap">
                {viewingRawData.content}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
