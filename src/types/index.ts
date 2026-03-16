// ============ Task Module ============
export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: string;
  dueDate?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

// ============ Budget Module ============
export interface BudgetCategory {
  id: string;
  name: string;
  totalBudget: number;
  color: string;
  description?: string;
}

export interface BudgetEntry {
  id: string;
  categoryId: string;
  amount: number;
  date: string;
  purpose: string;
  memo?: string;
  isPlanned: boolean; // true = 계획 지출, false = 실제 지출
  inventoryItemId?: string;
}

// ============ Inventory Module ============
export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  unit: string;
  budgetEntryIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StockChange {
  id: string;
  itemId: string;
  change: number; // 양수=입고, 음수=출고
  reason: string;
  date: string;
}

// ============ Meeting Module ============
export interface Meeting {
  id: string;
  title: string;
  datetime: string;
  endTime?: string;
  location?: string;
  attendees: string[];
  agenda?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============ Project Module ============
export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  color: string;
  checklistItems: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

// ============ Navigation ============
export type ModuleType = 'dashboard' | 'workspace' | 'mindmap';

// ============ Utility ============
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
