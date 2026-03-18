'use client';

import React, { useState } from 'react';
import { Task, TaskStatus, BudgetCategory, BudgetEntry, InventoryItem, StockChange, Meeting, Project } from '@/types';
import { TaskListView } from '@/components/TaskList';
import { TaskModal } from '@/components/TaskModal';
import { BudgetDashboard } from '@/components/budget/BudgetDashboard';
import { InventoryList } from '@/components/inventory/InventoryList';

import { DocumentGenerator } from '@/components/document/DocumentGenerator';
import {
  ListTodo, Wallet, Package, Calendar, FileText
} from 'lucide-react';

type SubTab = 'tasks' | 'budget' | 'inventory' | 'documents';

const subTabs: { id: SubTab; label: string; icon: React.ElementType }[] = [
  { id: 'tasks', label: '업무', icon: ListTodo },
  { id: 'budget', label: '예산', icon: Wallet },
  { id: 'inventory', label: '재고', icon: Package },
  { id: 'documents', label: '문서', icon: FileText },
];

interface WorkspaceViewProps {
  // Tasks
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, status: TaskStatus) => void;
  // Budget
  budgetCategories: BudgetCategory[];
  budgetEntries: BudgetEntry[];
  addCategory: (cat: Omit<BudgetCategory, 'id'>) => void;
  updateCategory: (id: string, updates: Partial<BudgetCategory>) => void;
  deleteCategory: (id: string) => void;
  addEntry: (entry: Omit<BudgetEntry, 'id'>) => void;
  deleteEntry: (id: string) => void;
  getCategoryStats: (id: string) => { totalBudget: number; spent: number; planned: number; remaining: number; usageRate: number } | null;
  overallStats: { totalBudget: number; totalSpent: number; totalPlanned: number; remaining: number };
  // Inventory
  inventoryItems: InventoryItem[];
  addItem: (item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateItem: (id: string, updates: Partial<InventoryItem>) => void;
  deleteItem: (id: string) => void;
  adjustStock: (itemId: string, change: number, reason: string) => void;
  getItemHistory: (itemId: string) => StockChange[];
  // Meetings
  meetings: Meeting[];
  addMeeting: (meeting: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateMeeting: (id: string, updates: Partial<Meeting>) => void;
  deleteMeeting: (id: string) => void;
  // Projects
  projects: Project[];
  addProject: (p: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'checklistItems'>) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  addChecklistItem: (projectId: string, text: string) => void;
  toggleChecklistItem: (projectId: string, itemId: string) => void;
  deleteChecklistItem: (projectId: string, itemId: string) => void;
  getProjectProgress: (projectId: string) => number;
}

export function WorkspaceView(props: WorkspaceViewProps) {
  const [activeTab, setActiveTab] = useState<SubTab>('tasks');

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo');

  const openTaskModal = (task?: Task, status?: TaskStatus) => {
    setEditTask(task || null);
    setDefaultStatus(status || 'todo');
    setShowTaskModal(true);
  };

  const taskCategories = [...new Set(props.tasks.map(t => t.category).filter(Boolean))];

  const renderSubContent = () => {
    switch (activeTab) {
      case 'tasks':
        return (
          <div className="space-y-4">
            <TaskListView
              tasks={props.tasks}
              onEdit={(task) => openTaskModal(task)}
              onDelete={props.deleteTask}
              onStatusChange={(id, status) => props.moveTask(id, status)}
              onAdd={() => openTaskModal()}
              meetings={props.meetings}
              addMeeting={props.addMeeting}
              updateMeeting={props.updateMeeting}
              deleteMeeting={props.deleteMeeting}
              projects={props.projects}
              addProject={props.addProject}
              deleteProject={props.deleteProject}
            />
          </div>
        );

      case 'budget':
        return (
          <BudgetDashboard
            categories={props.budgetCategories}
            entries={props.budgetEntries}
            addCategory={props.addCategory}
            updateCategory={props.updateCategory}
            deleteCategory={props.deleteCategory}
            addEntry={props.addEntry}
            deleteEntry={props.deleteEntry}
            getCategoryStats={props.getCategoryStats}
            overallStats={props.overallStats}
          />
        );

      case 'inventory':
        return (
          <InventoryList
            items={props.inventoryItems}
            addItem={props.addItem}
            updateItem={props.updateItem}
            deleteItem={props.deleteItem}
            adjustStock={props.adjustStock}
            getItemHistory={props.getItemHistory}
          />
        );

      case 'documents':
        return (
          <DocumentGenerator />
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-1 mb-6 border-b border-[var(--color-border-light)] pb-3 overflow-x-auto no-scrollbar">
        {subTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium cursor-pointer transition-all border-b-2 -mb-[13px] ${
                isActive
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:border-gray-200'
              }`}
              title={tab.label}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {renderSubContent()}

      <TaskModal
        isOpen={showTaskModal}
        onClose={() => { setShowTaskModal(false); setEditTask(null); }}
        onSave={(task) => props.addTask({ ...task, status: defaultStatus })}
        editTask={editTask}
        onUpdate={props.updateTask}
        categories={taskCategories}
        projects={props.projects.map(p => ({ id: p.id, name: p.name }))}
      />
    </>
  );
}
