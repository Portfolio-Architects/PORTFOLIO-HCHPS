'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ModuleType } from '@/types';
import { useTasks } from '@/hooks/useTasks';
import { useBudget } from '@/hooks/useBudget';
import { useInventory } from '@/hooks/useInventory';
import { useMeetings } from '@/hooks/useMeetings';
import { useProjects } from '@/hooks/useProjects';
import { useSignal, extractKeywords } from '@/hooks/useSignal';
import { useKnowledge } from '@/hooks/useKnowledge';
import { Sidebar } from '@/components/Sidebar';
import { QuickInput } from '@/components/QuickInput';
import { WorkspaceView } from '@/components/WorkspaceView';
import { MindMap3D } from '@/components/MindMap3D';
import { TaskKnowledgeView } from '@/components/TaskKnowledgeView';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// Error Boundary for MindMap3D — prevents signal map crash from breaking entire app
class MindMapErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertTriangle size={48} className="text-amber-400" />
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">시그널 로드 실패</h2>
          <p className="text-sm text-[var(--color-text-tertiary)] max-w-md text-center">
            {this.state.errorMsg || '컴포넌트 렌더링 중 오류가 발생했습니다.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, errorMsg: '' })}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors cursor-pointer"
          >
            <RefreshCw size={14} /> 다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Home() {
  const [activeModule, setActiveModule] = useState<ModuleType>('workspace');
  const [mounted, setMounted] = useState(false);

  // Hooks
  const { tasks, addTask, updateTask, deleteTask, moveTask, stats: taskStats } = useTasks();
  const { categories: budgetCategories, entries: budgetEntries, addCategory, updateCategory, deleteCategory, addEntry, updateEntry, deleteEntry, getCategoryStats, overallStats } = useBudget();
  const { items: inventoryItems, addItem, updateItem, deleteItem, adjustStock, getItemHistory } = useInventory();
  const { meetings, addMeeting, updateMeeting, deleteMeeting, getUpcomingMeetings, getTodayMeetings } = useMeetings();
  const { projects, addProject, updateProject, deleteProject, addChecklistItem, toggleChecklistItem, deleteChecklistItem, getProjectProgress } = useProjects();
  const { entries: signalEntries, addSignal, deleteSignal, updateSignalKeywords, keywordMap } = useSignal();
  const { entries: knowledgeEntries, addKnowledge, updateKnowledge, deleteKnowledge, filterKnowledge, metadata: knowledgeMetadata } = useKnowledge();

  // Prevent hydration mismatch — hooks read localStorage data on client
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('hchps_active_module');
    if (saved === 'workspace' || saved === 'knowledge' || saved === 'mindmap') {
      setActiveModule(saved);
    }
  }, []);

  // Swipe gesture state
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const handleModuleChange = (module: ModuleType) => {
    setActiveModule(module);
    localStorage.setItem('hchps_active_module', module);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    
    // Disable swipe navigation on mindmap since panning the graph is a core interaction
    if (activeModule === 'mindmap') {
      touchStartX.current = null;
      touchEndX.current = null;
      return;
    }
    
    const distance = touchStartX.current - touchEndX.current;
    
    // Minimum horizontal swipe distance
    if (Math.abs(distance) > 60) {
      const order: ModuleType[] = ['workspace', 'knowledge', 'mindmap'];
      const currentIndex = order.indexOf(activeModule);
      
      if (distance > 0 && currentIndex < order.length - 1) {
        // Swiped left => next tab
        handleModuleChange(order[currentIndex + 1]);
      } else if (distance < 0 && currentIndex > 0) {
        // Swiped right => previous tab
        handleModuleChange(order[currentIndex - 1]);
      }
    }
    
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleRenameCategory = (oldName: string, newName: string) => {
    const rawOld = oldName.startsWith('#') ? oldName.slice(1) : oldName;
    const rawNew = newName.startsWith('#') ? newName.slice(1) : newName;
    
    // update Tasks
    tasks.forEach(t => {
      if (t.tags.includes(rawOld)) {
        updateTask(t.id, { tags: t.tags.map(tag => tag === rawOld ? rawNew : tag) });
      }
    });
    // update Knowledge
    knowledgeEntries?.forEach(k => {
      if (k.tags.includes(rawOld)) {
        updateKnowledge(k.id, { tags: k.tags.map(tag => tag === rawOld ? rawNew : tag) });
      }
    });
  };

  const handleDeleteCategory = (name: string) => {
    const rawName = name.startsWith('#') ? name.slice(1) : name;
    tasks.forEach(t => {
      if (t.tags.includes(rawName)) {
        updateTask(t.id, { tags: t.tags.filter(tag => tag !== rawName) });
      }
    });
    knowledgeEntries?.forEach(k => {
      if (k.tags.includes(rawName)) {
        updateKnowledge(k.id, { tags: k.tags.filter(tag => tag !== rawName) });
      }
    });
  };

  // ── Merge keywords from ALL Modules into Signal Map (Brain Dump) ──
  const mergedKeywordMap = useMemo(() => {
    const map: Record<string, number> = { ...keywordMap };
    
    const extractAndAdd = (text: string, tags: string[] = []) => {
      const words = extractKeywords(text);
      tags.forEach(t => { if (t.length >= 2) words.push(t); });
      words.forEach(kw => { map[kw] = (map[kw] || 0) + 1; });
    };

    // 1. 업무 (Tasks)
    for (const t of tasks) extractAndAdd(t.title + ' ' + (t.description || ''), t.tags);
    // 2. 지식 (Knowledge)
    for (const e of (knowledgeEntries || [])) extractAndAdd(e.title + ' ' + e.content, e.tags);
    // 3. 프로젝트 (Projects)
    for (const p of projects) extractAndAdd(p.name + ' ' + (p.description || '') + ' ' + p.checklistItems.map(c => c.text).join(' '));
    // 4. 회의록 (Meetings)
    for (const m of meetings) extractAndAdd(m.title + ' ' + (m.agenda || '') + ' ' + (m.notes || ''), m.attendees);
    // 5. 예산/지출 (Budget)
    for (const b of budgetEntries) extractAndAdd(b.purpose + ' ' + (b.memo || ''));
    // 6. 재고/비품 (Inventory)
    for (const i of inventoryItems) extractAndAdd(i.name + ' ' + i.category);

    return map;
  }, [keywordMap, tasks, knowledgeEntries, projects, meetings, budgetEntries, inventoryItems]);

  const mergedEntries = useMemo(() => {
    const buildEntry = (idPrefix: string, id: string, text: string, keywordsSource: string, tags: string[], createdAt: string, category: string) => ({
      id: `${idPrefix}-${id}`,
      text,
      keywords: [...extractKeywords(keywordsSource), ...tags.filter(tag => tag.length >= 2)],
      createdAt,
      category,
      tags: tags.filter(tag => tag.length >= 2),
    });

    const taskMap = tasks.map(t => buildEntry('task', t.id, `[업무] ${t.title}`, t.title + ' ' + (t.description || ''), t.tags, t.createdAt, '업무'));
    const knowMap = (knowledgeEntries || []).map(e => buildEntry('know', e.id, `[지식] ${e.title}`, e.title + ' ' + e.content, e.tags, e.createdAt, '지식창고'));
    const projectMap = projects.map(p => buildEntry('proj', p.id, `[프로젝트] ${p.name}`, p.name + ' ' + (p.description || ''), ['프로젝트'], p.createdAt, '프로젝트'));
    const meetingMap = meetings.map(m => buildEntry('meet', m.id, `[회의] ${m.title}`, m.title + ' ' + (m.agenda || '') + ' ' + (m.notes || ''), ['회의록', ...m.attendees], m.createdAt, '회의록'));
    const budgetMap = budgetEntries.map(b => buildEntry('budg', b.id, `[지출] ${b.purpose}`, b.purpose + ' ' + (b.memo || ''), ['예산'], b.date, '지출예산'));
    const inventoryMap = inventoryItems.map(i => buildEntry('inv', i.id, `[비품] ${i.name}`, i.name + ' ' + i.category, ['재고'], i.createdAt, '재고관리'));

    const sigMap = signalEntries.map(s => ({ ...s, category: '내 생각', tags: [] }));

    // Sort by createdAt descending
    const all = [...sigMap, ...taskMap, ...knowMap, ...projectMap, ...meetingMap, ...budgetMap, ...inventoryMap];
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [signalEntries, tasks, knowledgeEntries, projects, meetings, budgetEntries, inventoryItems]);

  const renderContent = () => {
    switch (activeModule) {
      case 'workspace':
        return (
          <WorkspaceView
            budgetCategories={budgetCategories}
            budgetEntries={budgetEntries}
            addCategory={addCategory}
            updateCategory={updateCategory}
            deleteCategory={deleteCategory}
            addEntry={addEntry}
            deleteEntry={deleteEntry}
            getCategoryStats={getCategoryStats}
            overallStats={overallStats}
            inventoryItems={inventoryItems}
            addItem={addItem}
            updateItem={updateItem}
            deleteItem={deleteItem}
            adjustStock={adjustStock}
            getItemHistory={getItemHistory}
          />
        );

      case 'knowledge':
        return (
          <TaskKnowledgeView
            tasks={tasks}
            addTask={addTask}
            updateTask={updateTask}
            deleteTask={deleteTask}
            moveTask={moveTask}
            meetings={meetings}
            addMeeting={addMeeting}
            updateMeeting={updateMeeting}
            deleteMeeting={deleteMeeting}
            projects={projects}
            addProject={addProject}
            deleteProject={deleteProject}
            knowledgeEntries={knowledgeEntries}
            addKnowledge={addKnowledge}
            updateKnowledge={updateKnowledge}
            deleteKnowledge={deleteKnowledge}
            filterKnowledge={filterKnowledge}
            knowledgeMetadata={knowledgeMetadata}
            signalEntries={signalEntries}
            deleteSignal={deleteSignal}
          />
        );

      case 'mindmap':
        return (
          <MindMapErrorBoundary>
            <MindMap3D 
              signalKeywords={mergedKeywordMap} 
              signalEntries={mergedEntries} 
              onAddSignal={addSignal} 
              onDeleteSignal={deleteSignal} 
              onUpdateKeywords={updateSignalKeywords}
              onRenameCategory={handleRenameCategory}
              onDeleteCategory={handleDeleteCategory}
            />
          </MindMapErrorBoundary>
        );

      default:
        return null;
    }
  };



  // SSR/static export: show loading skeleton until client mounts
  if (!mounted) {
    return (
      <div className="flex flex-col min-h-screen overflow-x-hidden">
        <header className="sticky top-0 z-50 bg-[var(--color-card)] border-b border-[var(--color-border-light)] shadow-[var(--shadow-sm)]">
          <div className="max-w-[1800px] mx-auto px-4 sm:px-6">
            <div className="flex items-center h-14 gap-3">
              <div className="w-24 h-8 bg-gray-100 rounded-full animate-pulse" />
              <div className="w-20 h-8 bg-gray-100 rounded-full animate-pulse" />
              <div className="w-24 h-8 bg-gray-100 rounded-full animate-pulse" />
              <div className="flex-1" />
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-[1800px] mx-auto">

            <div className="space-y-3">
              <div className="h-16 bg-gray-50 rounded-xl animate-pulse" />
              <div className="h-16 bg-gray-50 rounded-xl animate-pulse" />
              <div className="h-16 bg-gray-50 rounded-xl animate-pulse" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col min-h-screen"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Sidebar
        activeModule={activeModule}
        onModuleChange={handleModuleChange}
        taskStats={taskStats}
        quickInput={
          <QuickInput
            onCreateTask={(data) => {
              addTask({ title: data.title, status: 'todo', priority: data.priority, category: '', dueDate: data.dueDate, tags: data.tags, description: '', recurrence: data.recurrence, recurrenceEndDate: data.recurrenceEndDate });
              if (activeModule !== 'workspace') setActiveModule('workspace');
            }}
            onCreateKnowledge={(data) => {
              addKnowledge({ title: data.title, content: data.content, tags: data.tags, category: data.category });
              if (activeModule !== 'knowledge') setActiveModule('knowledge');
            }}
            onAddSignal={(text) => {
              addSignal(text);
              if (activeModule !== 'mindmap') setActiveModule('mindmap');
            }}
            onNavigate={(m) => handleModuleChange(m as ModuleType)}
          />
        }
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto custom-scrollbar sm:pb-8">
        <div className="max-w-[1800px] mx-auto">


          {renderContent()}
        </div>
      </main>
    </div>
  );
}
