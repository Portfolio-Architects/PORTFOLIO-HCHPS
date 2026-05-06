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
import { useBossSchedule } from '@/hooks/useBossSchedule';
import { useScheduleAlerts } from '@/hooks/useScheduleAlerts';
import { useNotificationAlerts } from '@/hooks/useNotificationAlerts';
import { ScheduleAlertBanner } from '@/components/mindmap/ui/ScheduleAlertBanner';
import { Sidebar } from '@/components/Sidebar';
import { QuickInput } from '@/components/QuickInput';
import { WorkspaceView } from '@/components/WorkspaceView';
import { MindMap3D } from '@/components/MindMap3D';
import { PortfolioDashboardView } from '@/components/dashboard/PortfolioDashboardView';
import { TaskKnowledgeView } from '@/components/TaskKnowledgeView';
import { SearchResultModal } from '@/components/SearchResultModal';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useSecurityLock } from '@/hooks/useSecurityLock';
import { SecurityLockScreen } from '@/components/SecurityLockScreen';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { useMergedSignals } from '@/hooks/useMergedSignals';

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

function ProtectedApp() {
  const [activeModule, setActiveModule] = useState<ModuleType>('dashboard');
  const [mounted, setMounted] = useState(false);
  // Hooks
  const { tasks, addTask, updateTask, deleteTask, moveTask, stats: taskStats } = useTasks();
  const { categories: budgetCategories, entries: budgetEntries, addCategory, updateCategory, deleteCategory, addEntry, updateEntry, deleteEntry, getCategoryStats, overallStats } = useBudget();
  const { items: inventoryItems, addItem, updateItem, deleteItem, adjustStock, getItemHistory } = useInventory();
  const { meetings, addMeeting, updateMeeting, deleteMeeting, getUpcomingMeetings, getTodayMeetings } = useMeetings();
  const { projects, addProject, updateProject, deleteProject, addChecklistItem, toggleChecklistItem, deleteChecklistItem, getProjectProgress } = useProjects();
  const { entries: signalEntries, addSignal, deleteSignal, updateSignal, updateSignalKeywords, keywordMap } = useSignal();
  const { entries: knowledgeEntries, addKnowledge, updateKnowledge, deleteKnowledge, filterKnowledge, metadata: knowledgeMetadata } = useKnowledge();
  const { entries: bossEntries } = useBossSchedule();
  const scheduleAlerts = useScheduleAlerts(tasks, meetings, bossEntries);
  const { permission: notifPermission, requestPermission: requestNotifPermission, appEnabled, toggleAppEnabled } = useNotificationAlerts(scheduleAlerts);

  const { searchModalOpen, searchQuery, searchResults, handleGlobalSearch, closeSearchModal } = useGlobalSearch();
  const { mergedKeywordMap, mergedEntries } = useMergedSignals(signalEntries, keywordMap, tasks, knowledgeEntries, projects, meetings, budgetEntries, inventoryItems);

  // Prevent hydration mismatch — hooks read localStorage data on client
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    // 항상 대시보드를 첫 화면으로 띄우기 위해 로컬스토리지 복원 로직 제거
    setActiveModule('dashboard');
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
      window.location.href = '/login';
    } catch (e) {
      console.error('Logout failed', e);
    }
  };

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
      const order: ModuleType[] = ['dashboard', 'mindmap', 'workspace', 'knowledge'];
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

  useEffect(() => {
    const handleOpenWiki = (e: CustomEvent) => {
      if (activeModule !== 'mindmap') {
        setActiveModule('mindmap');
      }
    };
    window.addEventListener('wiki:openNode', handleOpenWiki as EventListener);
    return () => window.removeEventListener('wiki:openNode', handleOpenWiki as EventListener);
  }, [activeModule]);

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

  // Global Search and Merged Signals logic extracted to useGlobalSearch and useMergedSignals hooks

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
            updateEntry={updateEntry}
            deleteEntry={deleteEntry}
            getCategoryStats={getCategoryStats}
            overallStats={overallStats}
            inventoryItems={inventoryItems}
            addItem={addItem}
            updateItem={updateItem}
            deleteItem={deleteItem}
            adjustStock={adjustStock}
            getItemHistory={getItemHistory}
            addKnowledge={addKnowledge}
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
            addSignal={addSignal}
            updateSignal={updateSignal}
            deleteSignal={deleteSignal}
          />
        );

      case 'mindmap':
        return (
          <div className="flex flex-col h-full">
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
            <ScheduleAlertBanner alerts={scheduleAlerts} notificationPermission={notifPermission} onRequestPermission={requestNotifPermission} appEnabled={appEnabled} onToggleAppEnabled={toggleAppEnabled} mergedEntries={mergedEntries} />
          </div>
        );

      case 'dashboard':
        return <PortfolioDashboardView tasks={tasks} budgetCategories={budgetCategories} budgetEntries={budgetEntries} onLogout={handleLogout} />;

      default:
        return null;
    }
  };



  // Lock guard moved to the parent Home component.

  return (
    <div 
      className="flex flex-col min-h-screen bg-[#f8fafc]"
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
            onSearch={handleGlobalSearch}
            onNavigate={(m) => handleModuleChange(m as ModuleType)}
          />
        }
      />

      <main className="flex-1 pb-32 sm:pb-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8">


          {renderContent()}
        </div>
      </main>

      <SearchResultModal 
        isOpen={searchModalOpen}
        onClose={closeSearchModal}
        query={searchQuery}
        results={searchResults}
      />


    </div>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { isLocked, hasSetupPIN, failCount, verifyPIN, setupPIN } = useSecurityLock();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted || hasSetupPIN === null) {
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

  if (isLocked) {
    return (
      <SecurityLockScreen 
        hasSetupPIN={hasSetupPIN} 
        failCount={failCount} 
        onVerify={verifyPIN} 
        onSetup={setupPIN} 
      />
    );
  }

  return <ProtectedApp />;
}
