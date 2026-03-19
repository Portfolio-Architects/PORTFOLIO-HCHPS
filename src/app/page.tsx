'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ModuleType } from '@/types';
import { useTasks } from '@/hooks/useTasks';
import { useBudget } from '@/hooks/useBudget';
import { useInventory } from '@/hooks/useInventory';
import { useMeetings } from '@/hooks/useMeetings';
import { useProjects } from '@/hooks/useProjects';
import { useSignal } from '@/hooks/useSignal';
import { useKnowledge } from '@/hooks/useKnowledge';
import { Sidebar } from '@/components/Sidebar';
import { QuickInput } from '@/components/QuickInput';
import { WorkspaceView } from '@/components/WorkspaceView';
import { MindMap3D } from '@/components/MindMap3D';
import { KnowledgeList } from '@/components/knowledge/KnowledgeList';
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
  useEffect(() => setMounted(true), []);

  const handleModuleChange = (mod: ModuleType) => {
    setActiveModule(mod);
  };

  const renderContent = () => {
    switch (activeModule) {
      case 'workspace':
        return (
          <WorkspaceView
            tasks={tasks}
            addTask={addTask}
            updateTask={updateTask}
            deleteTask={deleteTask}
            moveTask={moveTask}
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
            meetings={meetings}
            addMeeting={addMeeting}
            updateMeeting={updateMeeting}
            deleteMeeting={deleteMeeting}
            projects={projects}
            addProject={addProject}
            updateProject={updateProject}
            deleteProject={deleteProject}
            addChecklistItem={addChecklistItem}
            toggleChecklistItem={toggleChecklistItem}
            deleteChecklistItem={deleteChecklistItem}
            getProjectProgress={getProjectProgress}
            knowledgeEntries={knowledgeEntries}
          />
        );

      case 'knowledge':
        return (
          <KnowledgeList
            entries={knowledgeEntries}
            addKnowledge={addKnowledge}
            updateKnowledge={updateKnowledge}
            deleteKnowledge={deleteKnowledge}
            filterKnowledge={filterKnowledge}
            metadata={knowledgeMetadata}
          />
        );

      case 'mindmap':
        return (
          <MindMapErrorBoundary>
            <MindMap3D signalKeywords={keywordMap} signalEntries={signalEntries} onAddSignal={addSignal} onDeleteSignal={deleteSignal} onUpdateKeywords={updateSignalKeywords} />
          </MindMapErrorBoundary>
        );

      default:
        return null;
    }
  };

  const pageTitles: Record<ModuleType, { icon: string; title: string; sub: string }> = {
    workspace: {
      icon: '📋',
      title: '업무관리',
      sub: 'HCHPS Work Manager',
    },
    knowledge: {
      icon: '💡',
      title: '지식창고',
      sub: '업무 암묵지 및 어드바이스 관리',
    },
    mindmap: {
      icon: '📡',
      title: '시그널',
      sub: '시그널 네트워크 시각화',
    },
  };

  const page = pageTitles[activeModule];

  // SSR/static export: show loading skeleton until client mounts
  if (!mounted) {
    return (
      <div className="flex flex-col min-h-screen overflow-x-hidden">
        <header className="sticky top-0 z-40 bg-[var(--color-card)] border-b border-[var(--color-border-light)] shadow-[var(--shadow-sm)]">
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
            <div className="w-48 h-9 bg-gray-100 rounded-lg animate-pulse mb-6" />
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
    <div className="flex flex-col min-h-screen overflow-x-hidden">
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

      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1800px] mx-auto">
          {/* Page Title */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">
              {page.icon} {page.title}
            </h1>
            <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
              {page.sub}
            </p>
          </div>

          {renderContent()}
        </div>
      </main>
    </div>
  );
}
