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
  recurrence?: string; // 반복 패턴: '매주 목요일', '매월 15일', '매일' 등
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  recurrenceCount?: number; // 총 반복 횟수
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

// ============ Budget Module ============
export type BudgetEntryType = 'approval' | 'resolution'; // 지출 품의 / 지출 결의

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
  entryType: BudgetEntryType; // 'approval' = 지출 품의, 'resolution' = 지출 결의
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

// ============ Document Generator Module ============
export interface DocumentEntry {
  id: string;
  title: string;           // 건명
  expenseType: string;     // 경비구분 (일상경비, 여비 등)
  amount: number;          // 금액
  vendorName: string;      // 업체명
  vendorRegNo: string;     // 사업자등록번호
  relatedDoc: string;      // 관련문서 번호
  recipient: string;       // 수신 (내부결재 등)
  budgetAccount: string;   // 예산과목
  paymentMethod: string;   // 지급방법
  status: 'draft' | 'ready' | 'done'; // 상태
}

// ============ Knowledge Base Module ============
export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ============ Navigation ============
export type ModuleType = 'workspace' | 'knowledge' | 'mindmap' | 'crm';

// ============ Utility ============
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
