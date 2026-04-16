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
  MapPin, Users, FileText, CheckCircle2, Circle, Clock, Tag, ExternalLink, BrainCircuit, BookOpen
} from 'lucide-react';
import { WikiEditor } from './WikiEditor';

interface TaskKnowledgeViewProps {
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
  addKnowledge: (entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateKnowledge: (id: string, updates: Partial<KnowledgeEntry>) => void;
  deleteKnowledge: (id: string) => void;
  filterKnowledge: (filters: { search?: string; category?: string; tag?: string }) => KnowledgeEntry[];
  knowledgeMetadata?: { categories: string[]; tags: string[] };
  signalEntries?: SignalEntry[];
  addSignal?: (text: string) => void;
  updateSignal?: (id: string, text: string) => void;
  deleteSignal?: (id: string) => void;
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalMode, setAddModalMode] = useState<'memo' | 'pdf'>('memo');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo');
  
  // Master-Detail State
  const [activeFeedTab, setActiveFeedTab] = useState<'all' | 'memo' | 'pdf' | 'knowledge'>('all');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editingWikiNode, setEditingWikiNode] = useState<{id: string; title: string; initialBlocks?: any[]} | null>(null);
  const [extractingId, setExtractingId] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

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

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    (props.signalEntries || []).forEach(sig => items.push({ type: 'signal', data: sig, dateMs: new Date(sig.createdAt).getTime() }));
    props.tasks.forEach(task => items.push({ type: 'task', data: task, dateMs: new Date(task.createdAt).getTime() }));
    props.meetings.forEach(meeting => items.push({ type: 'meeting', data: meeting, dateMs: new Date(meeting.createdAt).getTime() }));
    props.knowledgeEntries.forEach(know => items.push({ type: 'knowledge', data: know, dateMs: new Date(know.createdAt).getTime() }));
    return items.sort((a, b) => b.dateMs - a.dateMs);
  }, [props.signalEntries, props.tasks, props.meetings, props.knowledgeEntries]);

  const filteredFeed = useMemo(() => {
    return feed.filter(item => {
      if (activeFeedTab === 'all') return true;
      if (activeFeedTab === 'knowledge') return item.type === 'knowledge';
      if (item.type === 'signal') {
        const isPdf = item.data.text?.includes('[PDF 원본:');
        if (activeFeedTab === 'pdf') return isPdf;
        if (activeFeedTab === 'memo') return !isPdf;
      }
      return false;
    });
  }, [feed, activeFeedTab]);

  const activeItem = useMemo(() => {
    if (!selectedItemId) return null;
    return filteredFeed.find(i => 
      (i.type === 'signal' && i.data.id === selectedItemId) ||
      (i.type === 'task' && i.data.id === selectedItemId) ||
      (i.type === 'meeting' && i.data.id === selectedItemId) ||
      (i.type === 'knowledge' && i.data.id === selectedItemId)
    ) || null;
  }, [filteredFeed, selectedItemId]);

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
      
      localStorage.setItem(`HCHPS-Wiki-${nodeId}`, JSON.stringify(blocks));
      const { replaceAll } = await import('@/lib/sheets-api');
      await replaceAll(`WIKI_DOC_${nodeId}`, [{ id: 'singleton', blocks }]);

      alert('✨ 지정된 RAW 데이터가 위키 문서로 정제되어 연동 전송되었습니다!');
      
      // Auto open wiki if selected
      setEditingWikiNode({ id: nodeId, title: itemType, initialBlocks: blocks });
      setSelectedItemId(nodeId);
      
    } catch (err) {
      console.error(err);
      alert('위키 변환 중 오류가 발생했습니다.');
    } finally {
      setExtractingId(null);
    }
  };

  const renderLeftFeedItem = (item: FeedItem) => {
    const isSelected = selectedItemId === (item.data as any).id;
    let titleStr = '';
    let previewStr = '';
    let categoryBadge = null;
    let timeStr = formatRelativeTime(item.data.createdAt);
    const itemId = (item.data as any).id;

    if (item.type === 'signal') {
      const sig = item.data as SignalEntry;
      const isPdf = sig.text?.includes('[PDF 원본:');
      titleStr = isPdf ? 'PDF 원본 데이터' : '빠른 메모';
      previewStr = sig.text;
      categoryBadge = (
        <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${isPdf ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {isPdf ? <FileText size={10} /> : <Zap size={10} />} {titleStr}
        </span>
      );
      titleStr = previewStr.substring(0, 30) + '...'; // Override title with content snippet for signals
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
      categoryBadge = <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700"><Archive size={10} /> 지식</span>;
    }

    return (
      <div 
        key={`feed-${item.type}-${itemId}`}
        onClick={() => { setSelectedItemId(itemId); setEditingWikiNode(null); setIsEditing(false); }}
        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/30 shadow-sm' : 'border-[var(--color-border)] bg-white hover:border-[var(--color-primary-light)]'}`}
      >
        <div className="flex justify-between items-start mb-1.5 gap-2">
          {categoryBadge}
          <span className="text-[10px] text-[var(--color-text-tertiary)] flex-shrink-0">{timeStr}</span>
        </div>
        <h3 className={`text-[13px] font-bold line-clamp-1 mb-1 ${isSelected ? 'text-[var(--color-primary)]' : 'text-gray-800'}`}>{titleStr}</h3>
        {previewStr && previewStr !== titleStr && (
          <p className="text-[12px] text-gray-500 line-clamp-2 leading-relaxed">{previewStr}</p>
        )}
      </div>
    );
  };

  const renderRightDetailPane = () => {
    // 1. If wiki editing mode is active
    if (editingWikiNode && editingWikiNode.id === selectedItemId) {
      return (
        <div className="flex flex-col h-full bg-white relative">
          <div className="flex justify-between items-center p-3 sm:p-5 border-b border-gray-100 bg-blue-50/20 shrink-0">
            <h2 className="text-[15px] font-bold text-blue-900 flex items-center gap-2">
              <BrainCircuit size={18} className="text-blue-500" />
              위키 문서 수정 
              <span className="bg-white border border-blue-200 text-blue-600 px-2 py-0.5 rounded-full text-[10px] font-black">AI 정제본</span>
            </h2>
            <button 
              onClick={() => setEditingWikiNode(null)}
              className="px-3.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-[12px] font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              단순 조회 모드로 닫기
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-2 sm:px-6 custom-scrollbar relative">
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
      );
    }

    // 2. If nothing is selected
    if (!selectedItemId || !activeItem) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-12 bg-gray-50/50 h-[300px] lg:h-full">
          <BookOpen size={56} className="mb-4 opacity-20 text-gray-500" />
          <h3 className="text-[15px] font-bold text-gray-500 mb-1">메모장 항목을 선택하세요</h3>
          <p className="text-[12px] font-medium text-gray-400">좌측 리스트에서 조회할 데이터를 클릭하면 상세 내용과 위키 정제 기능을 사용할 수 있습니다.</p>
        </div>
      );
    }

    // 3. Detail View Render
    let titleStr = '';
    let categoryObj: { text: string; icon: any; color: string } | null = null;
    let contentStr = '';
    let extraMeta: React.ReactNode = null;
    
    const itemId = (activeItem.data as any).id;
    const hasWiki = localStorage.getItem(`HCHPS-Wiki-${itemId}`);

    if (activeItem.type === 'signal') {
      const sig = activeItem.data as SignalEntry;
      const isPdf = sig.text?.includes('[PDF 원본:');
      titleStr = isPdf ? 'PDF 원본 데이터 전문' : '빠른 메모 전문';
      contentStr = sig.text;
      categoryObj = isPdf 
        ? { text: 'PDF 문서', icon: FileText, color: 'text-amber-700 bg-amber-100' }
        : { text: '빠른 메모', icon: Zap, color: 'text-emerald-700 bg-emerald-100' };
    } else if (activeItem.type === 'task') {
      const t = activeItem.data as Task;
      titleStr = t.title;
      contentStr = t.description || '내용 없음';
      categoryObj = { text: '업무', icon: ListTodo, color: 'text-blue-700 bg-blue-100' };
      extraMeta = (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${t.status === 'done' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-blue-700 border-blue-200 bg-blue-50'}`}>
            {t.status === 'done' ? '완료됨' : '진행중'}
          </span>
          {t.dueDate && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-gray-200 bg-white">마감일: {t.dueDate}</span>}
          {t.tags.map(tag => <span key={tag} className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50">#{tag}</span>)}
        </div>
      );
    } else if (activeItem.type === 'meeting') {
      const m = activeItem.data as Meeting;
      titleStr = m.title;
      contentStr = `[일시]\n${new Date(m.datetime).toLocaleString('ko-KR')}\n\n[장소]\n${m.location || '미정'}\n\n[참석자]\n${m.attendees?.join(', ') || '없음'}\n\n[아젠다/내용]\n${m.notes || m.agenda || '내용 없음'}`;
      categoryObj = { text: '미팅/일정', icon: CalendarDays, color: 'text-purple-700 bg-purple-100' };
    } else if (activeItem.type === 'knowledge') {
      const k = activeItem.data as KnowledgeEntry;
      titleStr = k.title;
      contentStr = k.content;
      categoryObj = { text: '지식', icon: Archive, color: 'text-amber-700 bg-amber-100' };
      extraMeta = k.tags && k.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {k.tags.map(tag => <span key={tag} className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50">#{tag}</span>)}
        </div>
      );
    }

    const Icon = categoryObj?.icon || Tag;

    if (isEditing) {
      return (
        <div className="flex flex-col h-full bg-white relative">
          <div className="p-5 sm:p-7 border-b border-gray-100 shadow-[0_4px_10px_-10px_rgba(0,0,0,0.1)] relative z-10 shrink-0">
            <div className="flex justify-between items-start mb-3">
               <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-bold ${categoryObj?.color}`}>
                 <Icon size={12} /> {categoryObj?.text} 수정 편집 중...
               </div>
            </div>
            {activeItem.type === 'knowledge' && (
              <input 
                type="text" 
                value={editTitle} 
                onChange={e => setEditTitle(e.target.value)} 
                className="w-full text-[20px] font-black text-gray-900 bg-gray-50 border border-gray-200 rounded px-3 py-2 outline-none focus:border-blue-500" 
                placeholder="제목을 입력하세요"
              />
            )}
            {activeItem.type !== 'knowledge' && (
              <h1 className="text-[20px] font-black text-gray-900 leading-snug mb-3">{titleStr}</h1>
            )}
          </div>
          <div className="p-5 sm:p-7 flex-1 flex flex-col bg-gray-50/20">
            <textarea 
              value={editContent} 
              onChange={e => setEditContent(e.target.value)} 
              className="flex-1 w-full min-h-[300px] text-[14px] text-gray-700 leading-[1.8] bg-white border border-gray-200 rounded-lg p-4 outline-none focus:border-blue-500 resize-none shadow-inner"
              placeholder="내용을 입력하세요"
            />
            <div className="flex justify-end gap-2 mt-4 shrink-0">
              <button 
                onClick={() => setIsEditing(false)} 
                className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
              >
                취소
              </button>
              <button 
                onClick={() => {
                  if (activeItem.type === 'knowledge') {
                    props.updateKnowledge(itemId, { title: editTitle, content: editContent });
                  } else if (activeItem.type === 'signal') {
                    props.updateSignal?.(itemId, editContent);
                  }
                  setIsEditing(false);
                }}
                className="px-5 py-2.5 text-sm font-bold text-white bg-[var(--color-primary)] hoverOpacity-90 rounded-lg transition-opacity cursor-pointer shadow-sm"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full bg-white relative">
        <div className="p-5 sm:p-7 border-b border-gray-100 shadow-[0_4px_10px_-10px_rgba(0,0,0,0.1)] relative z-10 shrink-0">
          <div className="flex justify-between items-start mb-3">
             <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-bold ${categoryObj?.color}`}>
               <Icon size={12} /> {categoryObj?.text}
             </div>
             
             {/* Action Buttons */}
             <div className="flex items-center gap-1.5">
               {hasWiki ? (
                 <>
                   <button 
                     onClick={() => setEditingWikiNode({ id: itemId, title: categoryObj?.text || '위키 문서', initialBlocks: JSON.parse(hasWiki) })}
                     className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[11px] font-bold transition-colors cursor-pointer border border-blue-200"
                   >
                     ✅ 위키 열람/수정
                   </button>
                   <button 
                     onClick={(e) => {
                       if (window.confirm('기존 위키 내용이 초기화되고 AI가 전체 원문으로 다시 정제합니다. 진행하시겠습니까?')) {
                         handleExtractWiki(e, itemId, categoryObj?.text || '문서', titleStr, contentStr);
                       }
                     }}
                     className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-lg text-[11px] font-bold transition-colors cursor-pointer border border-gray-200"
                   >
                     🔄 AI 갱신
                   </button>
                 </>
               ) : (
                 <button 
                   onClick={(e) => handleExtractWiki(e, itemId, categoryObj?.text || '문서', titleStr, contentStr)}
                   className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white hover:bg-primary/90 rounded-lg text-[12px] font-bold transition-colors shadow-sm cursor-pointer"
                 >
                   {extractingId === itemId ? '⏳ LLM 분석중...' : '✨ 위키 정제(LLM)'}
                 </button>
               )}
               
               <div className="w-px h-4 bg-gray-200 mx-1"></div>
               
               {(activeItem.type === 'knowledge' || activeItem.type === 'signal') && (
                 <button 
                   onClick={() => {
                     setEditTitle(titleStr);
                     setEditContent(contentStr);
                     setIsEditing(true);
                   }} 
                   className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                   title="수정하기"
                 >
                   <Edit2 size={16} />
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
                 className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                 title="목록에서 삭제"
               >
                 <Trash2 size={16} />
               </button>
             </div>
          </div>
          
          <h1 className="text-[20px] font-black text-gray-900 leading-snug mb-3">{titleStr}</h1>
          {extraMeta}
          <div className="text-[11px] font-medium text-gray-400">최초 등록: {new Date(activeItem.data.createdAt).toLocaleString('ko-KR')}</div>
        </div>
        
        <div className="p-5 sm:p-7 flex-1 overflow-y-auto custom-scrollbar bg-gray-50/20">
          <div className="text-[14px] text-gray-700 leading-[1.8] whitespace-pre-wrap font-medium">
             {contentStr}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 h-full relative">
      {/* Top Header Row for Adding */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-[var(--color-border)] shadow-sm shrink-0">
        <div className="flex flex-row flex-nowrap whitespace-nowrap bg-gray-100 p-1 rounded-xl w-full sm:w-fit overflow-x-auto custom-scrollbar">
          {(['all', 'knowledge', 'memo', 'pdf'] as const).map(tabKey => (
            <button
              key={tabKey}
              onClick={() => { setActiveFeedTab(tabKey); setSelectedItemId(null); }}
              className={`px-6 py-2 text-[13px] font-bold rounded-lg transition-all flex-shrink-0 cursor-pointer ${activeFeedTab === tabKey ? 'bg-white text-[var(--color-primary)] shadow-sm shadow-gray-200/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
            >
              {tabKey === 'all' ? '모든 항목 보기' : tabKey === 'knowledge' ? '등록된 지식 (LLM)' : tabKey === 'memo' ? '빠른 텍스트 메모' : 'PDF 스캔 분석본'}
            </button>
          ))}
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => { setAddModalMode('pdf'); setShowAddModal(true); }}
            className="flex-1 sm:flex-none px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg shadow-sm text-[13px] font-bold hover:bg-amber-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileText size={15} className="text-amber-500" />PDF 분석
          </button>
          <button 
            onClick={() => { setAddModalMode('memo'); setShowAddModal(true); }}
            className="flex-1 sm:flex-none px-4 py-2 bg-gray-900 text-white rounded-lg shadow-sm text-[13px] font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Zap size={15} className="text-emerald-400" />새 메모
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 overflow-hidden">
        
        {/* Left Master List */}
        <div className="w-full lg:w-[360px] xl:w-[400px] flex flex-col gap-2.5 overflow-y-auto pr-1 flex-shrink-0 custom-scrollbar pb-6">
          {filteredFeed.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-xl border border-[var(--color-border-light)] border-dashed">
              <FileText size={48} className="mx-auto text-gray-200 mb-4" />
              <p className="text-[13px] font-bold text-[var(--color-text-secondary)]">항목이 없습니다.</p>
              <button 
                onClick={() => { setAddModalMode(activeFeedTab === 'pdf' ? 'pdf' : 'memo'); setShowAddModal(true); }}
                className="mt-4 px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                + 새 레코드 추가
              </button>
            </div>
          ) : (
            filteredFeed.map(item => renderLeftFeedItem(item))
          )}
        </div>

        {/* Right Detail Pane */}
        <div className="flex-1 bg-white rounded-xl border border-[var(--color-border)] shadow-sm flex flex-col overflow-hidden min-h-[500px] lg:min-h-0">
          {renderRightDetailPane()}
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
    </div>
  );
}
