import { z } from 'zod';

// ============ Task Module ============
export const TaskStatusSchema = z.enum(['todo', 'in-progress', 'done']);
export const TaskPrioritySchema = z.enum(['low', 'medium', 'high']);

export const TaskSchema = z.object({
  id: z.string().catch('unknown-id'),
  title: z.string().catch('제목 없음'),
  description: z.string().optional().catch(''),
  status: TaskStatusSchema.catch('todo'),
  priority: TaskPrioritySchema.catch('medium'),
  category: z.string().catch('미분류'),
  dueDate: z.string().optional().catch(undefined),
  projectId: z.string().optional().catch(undefined),
  recurrence: z.string().optional().catch(undefined),
  recurrenceStartDate: z.string().optional().catch(undefined),
  recurrenceEndDate: z.string().optional().catch(undefined),
  recurrenceCount: z.number().optional().catch(undefined),
  createdAt: z.string().catch(new Date().toISOString()),
  updatedAt: z.string().catch(new Date().toISOString()),
  tags: z.array(z.string()).default([]).catch([]),
});

export type TaskDto = z.infer<typeof TaskSchema>;

// ============ Budget Module ============
export const BudgetActionTypeSchema = z.enum(['general', 'issuance', 'daily_expense']);

export const BudgetCategorySchema = z.object({
  id: z.string().catch('unknown-cat'),
  name: z.string().catch('알 수 없는 카테고리'),
  totalBudget: z.number().catch(0),
  color: z.string().optional().default('#3b82f6').catch('#3b82f6'),
  description: z.string().optional().catch(''),
  policyProject: z.string().optional().catch('기타'),
  unitProject: z.string().optional().catch('전반'),
  detailedProject: z.string().optional().catch('기본운영'),
  managementProject: z.string().optional().catch(undefined),
  statItem: z.string().optional().catch('일반'),
  formationItem: z.string().optional().catch(undefined),
  budgetType: z.enum(['본예산', '간주예산', '추경']).optional().catch(undefined),
  fundingSource: z.string().optional().catch(undefined),
  fundingSplits: z.array(z.object({
    source: z.string(),
    amount: z.number()
  })).optional().catch(undefined),
  subItems: z.array(z.object({
    prefix: z.string().optional(),
    name: z.string(),
    calculation: z.string().optional(),
    amount: z.number(),
    isCustomFunding: z.boolean().optional(),
    fundingSplits: z.array(z.object({
      source: z.string(),
      amount: z.number()
    })).optional(),
    calculations: z.array(z.object({
      name: z.string().optional(),
      calculation: z.string(),
      amount: z.number(),
      isCustomFunding: z.boolean().optional(),
      fundingSplits: z.array(z.object({
        source: z.string(),
        amount: z.number()
      })).optional()
    })).optional()
  })).optional().catch(undefined),
  sortOrder: z.number().optional().catch(undefined),
});

export type BudgetCategoryDto = z.infer<typeof BudgetCategorySchema>;

export const BudgetEntrySchema = z.object({
  id: z.string().catch('unknown-entry'),
  categoryId: z.string().catch('unknown-cat'),
  amount: z.number().catch(0),
  date: z.string().catch(new Date().toISOString()),
  purpose: z.string().catch('내역 없음'),
  memo: z.string().optional().catch(''),
  isPlanned: z.boolean().optional().catch(false),
  entryType: z.literal('approval').optional().catch(undefined),
  actionType: BudgetActionTypeSchema.optional().catch(undefined),
  inventoryItemId: z.string().optional().catch(undefined),
  docRegNum: z.string().optional().catch(''),
});

export type BudgetEntryDto = z.infer<typeof BudgetEntrySchema>;

// ============ Project Module ============
export const ChecklistItemSchema = z.object({
  id: z.string().catch('unknown-item'),
  text: z.string().catch('할일'),
  completed: z.boolean().catch(false),
});

export const ProjectSchema = z.object({
  id: z.string().catch('unknown-project'),
  name: z.string().catch('알 수 없는 프로젝트'),
  description: z.string().optional().catch(''),
  color: z.string().catch('#94a3b8'),
  checklistItems: z.array(ChecklistItemSchema).default([]).catch([]),
  createdAt: z.string().catch(new Date().toISOString()),
  updatedAt: z.string().catch(new Date().toISOString()),
});

// ============ Knowledge Base Module ============
export const KnowledgeEntrySchema = z.object({
  id: z.string().catch('unknown-knowledge'),
  title: z.string().catch('제목 없음'),
  content: z.string().catch('내용 없음'),
  category: z.string().catch('일반'),
  tags: z.array(z.string()).default([]).catch([]),
  createdAt: z.string().catch(new Date().toISOString()),
  updatedAt: z.string().catch(new Date().toISOString()),
});

export const getDomainSchema = (sheetName: string) => {
  switch (sheetName.toUpperCase()) {
    case 'TASKS': return TaskSchema;
    case 'BUDGET_CATEGORIES': return BudgetCategorySchema;
    case 'BUDGET_ENTRIES': return BudgetEntrySchema;
    case 'PROJECTS': return ProjectSchema;
    case 'KNOWLEDGE': return KnowledgeEntrySchema;
    default: return z.any(); // Fallback for unstructured arrays
  }
};
