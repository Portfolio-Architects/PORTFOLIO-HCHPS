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
export type BudgetActionType = 'general' | 'issuance' | 'daily_expense'; // 일반품의, 일상경비교부, 일상경비지출

export interface BudgetCategory {
  id: string;
  name: string;
  totalBudget: number;
  color: string;
  description?: string;
  policyProject?: string; // 정책사업명
  unitProject?: string;   // 단위사업명
  detailedProject?: string; // 세부사업명
  formationItem?: string; // 편성목 (ex: 201 일반운영비)
  statItem?: string;      // 통계목 (ex: 01 사무관리비)
  budgetType?: '본예산' | '간주예산' | '추경'; // 예산 구분
  fundingSource?: string; // 재원 구분 (구비, 국비, 시비 등)
  sortOrder?: number; // 편성목 표시 순서 (낮을수록 위)
}

export interface BudgetEntry {
  id: string;
  categoryId: string;
  amount: number;
  date: string;
  purpose: string;
  memo?: string;
  
  // Commitment Accounting (원인행위 & 정산)
  isPlanned?: boolean;    // true = 지출품의(예상), false = 실제 지출
  isSettled?: boolean;    // true = 이 품의에 대한 실제 지출(정산) 완료됨
  relatedPlanId?: string; // 실제 지출(isPlanned:false)일 경우 연관된 품의서(isPlanned:true)의 ID
  
  entryType?: 'approval'; // Deprecated
  actionType?: BudgetActionType; // 일반품의, 일상경비 교부, 일상경비 지출
  inventoryItemId?: string;
  docRegNum?: string; // 시행 문서 번호 (보건행정과-00000)
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
export type ModuleType = 'workspace' | 'knowledge' | 'mindmap' | 'project-planning';

// ============ Utility ============
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
