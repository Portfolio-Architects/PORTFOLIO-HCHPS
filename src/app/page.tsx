'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ModuleType } from '@/types';
import { useTasks } from '@/hooks/useTasks';
import { useBudget } from '@/hooks/useBudget';
import { useInventory } from '@/hooks/useInventory';
import { useMeetings } from '@/hooks/useMeetings';
import { useProjects } from '@/hooks/useProjects';
import { useSignal } from '@/hooks/useSignal';
import { Sidebar } from '@/components/Sidebar';
import { QuickInput } from '@/components/QuickInput';
import { DashboardView } from '@/components/DashboardView';
import { WorkspaceView } from '@/components/WorkspaceView';
import { MindMap3D } from '@/components/MindMap3D';
import { Lock, Eye, EyeOff } from 'lucide-react';

// Passcode gate for mindmap
function PasscodeGate({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // SHA-256 hash comparison (CWE-798 fix)
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(code));
    const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    // Pre-computed SHA-256 of the passcode
    if (hashHex === '4c0ff09e3e908c3ebc17c4d37e0e67a8a87be9f5db27a85e1ea7e08ffb552f72') {
      onUnlock();
    } else {
      setError(true);
      setCode('');
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="flex items-center justify-center py-32">
      <form onSubmit={handleSubmit} className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-gray-100 rounded-2xl flex items-center justify-center">
          <Lock size={28} className="text-[var(--color-text-tertiary)]" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">접근 코드 입력</h3>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">이 영역은 코드가 필요합니다</p>
        </div>
        <div className="relative">
          <input
            type={showCode ? 'text' : 'password'}
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="코드를 입력하세요"
            autoFocus
            className={`w-60 px-4 py-3 text-sm text-center border rounded-xl outline-none transition-colors ${
              error
                ? 'border-red-400 bg-red-50 animate-[shake_0.3s_ease-in-out]'
                : 'border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowCode(!showCode)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] cursor-pointer"
          >
            {showCode ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-500 font-medium">코드가 일치하지 않습니다</p>
        )}
        <button
          type="submit"
          className="px-6 py-2.5 text-sm font-medium rounded-xl bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity cursor-pointer"
        >
          확인
        </button>
      </form>
    </div>
  );
}

export default function Home() {
  const [activeModule, setActiveModule] = useState<ModuleType>('dashboard');
  const [mindmapUnlocked, setMindmapUnlocked] = useState(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5분

  // Hooks
  const { tasks, addTask, updateTask, deleteTask, moveTask, stats: taskStats } = useTasks();
  const { categories: budgetCategories, entries: budgetEntries, addCategory, updateCategory, deleteCategory, addEntry, updateEntry, deleteEntry, getCategoryStats, overallStats } = useBudget();
  const { items: inventoryItems, addItem, updateItem, deleteItem, adjustStock, getItemHistory } = useInventory();
  const { meetings, addMeeting, updateMeeting, deleteMeeting, getUpcomingMeetings, getTodayMeetings } = useMeetings();
  const { projects, addProject, updateProject, deleteProject, addChecklistItem, toggleChecklistItem, deleteChecklistItem, getProjectProgress } = useProjects();
  const { entries: signalEntries, addSignal, keywordMap } = useSignal();

  // Auto-lock mindmap after inactivity
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      setMindmapUnlocked(false);
    }, LOCK_TIMEOUT_MS);
  }, [LOCK_TIMEOUT_MS]);

  useEffect(() => {
    if (activeModule !== 'mindmap' || !mindmapUnlocked) {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      return;
    }

    // Start timer when mindmap is unlocked
    resetInactivityTimer();

    // Reset on user activity
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;
    const handler = () => resetInactivityTimer();
    events.forEach(evt => window.addEventListener(evt, handler, { passive: true }));

    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      events.forEach(evt => window.removeEventListener(evt, handler));
    };
  }, [activeModule, mindmapUnlocked, resetInactivityTimer]);

  // Reset mindmap lock when navigating away
  const handleModuleChange = (mod: ModuleType) => {
    if (activeModule === 'mindmap' && mod !== 'mindmap') {
      setMindmapUnlocked(false);
    }
    setActiveModule(mod);
  };

  const renderContent = () => {
    switch (activeModule) {
      case 'dashboard':
        return (
          <DashboardView
            tasks={tasks}
            taskStats={taskStats}
            budgetStats={overallStats}
            meetings={meetings}
            projects={projects}
            getUpcomingMeetings={getUpcomingMeetings}
            onNavigate={m => handleModuleChange(m as ModuleType)}
          />
        );

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
            quickInput={
              <QuickInput
                onCreateTask={(data) => {
                  addTask({ title: data.title, status: 'todo', priority: data.priority, category: data.category, dueDate: data.dueDate, tags: data.tags, description: '', recurrence: data.recurrence });
                }}
                onNavigate={(m) => handleModuleChange(m as ModuleType)}
              />
            }
          />
        );

      case 'mindmap':
        if (!mindmapUnlocked) {
          return <PasscodeGate onUnlock={() => setMindmapUnlocked(true)} />;
        }
        return <MindMap3D signalKeywords={keywordMap} signalEntries={signalEntries} onAddSignal={addSignal} />;

      default:
        return null;
    }
  };

  const pageTitles: Record<ModuleType, { icon: string; title: string; sub: string }> = {
    dashboard: {
      icon: '📋',
      title: '대시보드',
      sub: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }),
    },
    workspace: {
      icon: '📋',
      title: '업무관리',
      sub: 'HCHPS Work Manager',
    },
    mindmap: {
      icon: '📡',
      title: '시그널 맵',
      sub: '시그널 네트워크 시각화',
    },
  };

  const page = pageTitles[activeModule];

  return (
    <div className="flex flex-col min-h-screen">
      <Sidebar
        activeModule={activeModule}
        onModuleChange={handleModuleChange}
        taskStats={taskStats}
      />

      {/* Quick Input Bar — only show standalone when NOT on workspace */}
      {activeModule !== 'workspace' && (
        <div className="bg-[var(--color-bg)] py-3 border-b border-[var(--color-border-light)]">
          <QuickInput
            onCreateTask={(data) => {
              addTask({ title: data.title, status: 'todo', priority: data.priority, category: data.category, dueDate: data.dueDate, tags: data.tags, description: '', recurrence: data.recurrence });
              setActiveModule('workspace');
            }}
            onNavigate={(m) => handleModuleChange(m as ModuleType)}
          />
        </div>
      )}

      <main className="flex-1 p-6 lg:p-8 overflow-y-auto custom-scrollbar">
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
