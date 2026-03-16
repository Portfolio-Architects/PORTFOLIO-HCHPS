'use client';

import React, { useState } from 'react';
import { ModuleType } from '@/types';
import { useTasks } from '@/hooks/useTasks';
import { useBudget } from '@/hooks/useBudget';
import { useInventory } from '@/hooks/useInventory';
import { useMeetings } from '@/hooks/useMeetings';
import { useProjects } from '@/hooks/useProjects';
import { Sidebar } from '@/components/Sidebar';
import { QuickInput } from '@/components/QuickInput';
import { DashboardView } from '@/components/DashboardView';
import { WorkspaceView } from '@/components/WorkspaceView';
import { MindMap3D } from '@/components/MindMap3D';

export default function Home() {
  const [activeModule, setActiveModule] = useState<ModuleType>('dashboard');

  // Hooks
  const { tasks, addTask, updateTask, deleteTask, moveTask, stats: taskStats } = useTasks();
  const { categories: budgetCategories, entries: budgetEntries, addCategory, updateCategory, deleteCategory, addEntry, updateEntry, deleteEntry, getCategoryStats, overallStats } = useBudget();
  const { items: inventoryItems, addItem, updateItem, deleteItem, adjustStock, getItemHistory } = useInventory();
  const { meetings, addMeeting, updateMeeting, deleteMeeting, getUpcomingMeetings, getTodayMeetings } = useMeetings();
  const { projects, addProject, updateProject, deleteProject, addChecklistItem, toggleChecklistItem, deleteChecklistItem, getProjectProgress } = useProjects();

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
            getProjectProgress={getProjectProgress}
            getUpcomingMeetings={getUpcomingMeetings}
            onNavigate={m => setActiveModule(m as ModuleType)}
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
          />
        );

      case 'mindmap':
        return (
          <MindMap3D
            tasks={tasks}
            meetings={meetings}
            budgetEntries={budgetEntries}
            projects={projects}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Sidebar
        activeModule={activeModule}
        onModuleChange={setActiveModule}
        taskStats={taskStats}
      />

      {/* Quick Input Bar */}
      <div className="bg-[var(--color-bg)] py-3 border-b border-[var(--color-border-light)]">
        <QuickInput
          onCreateTask={(data) => {
            addTask({ title: data.title, status: 'todo', priority: data.priority, category: data.category, dueDate: data.dueDate, tags: data.tags, description: '' });
            setActiveModule('workspace');
          }}
          onNavigate={(m) => setActiveModule(m as ModuleType)}
        />
      </div>

      <main className="flex-1 p-6 lg:p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1400px] mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
