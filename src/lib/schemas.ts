import { z } from 'zod';

// ============ Task Module ============
export const TaskStatusSchema = z.enum(['todo', 'in-progress', 'done']);
export const TaskPrioritySchema = z.enum(['low', 'medium', 'high']);

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  category: z.string(),
  dueDate: z.string().optional(),
  projectId: z.string().optional(),
  recurrence: z.string().optional(),
  recurrenceStartDate: z.string().optional(),
  recurrenceEndDate: z.string().optional(),
  recurrenceCount: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tags: z.array(z.string()).default([]),
});

export type TaskDto = z.infer<typeof TaskSchema>;

// ============ Budget Module ============
export const BudgetActionTypeSchema = z.enum(['general', 'issuance', 'daily_expense']);

export const BudgetCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  totalBudget: z.number(),
  color: z.string(),
  description: z.string().optional(),
  policyProject: z.string().optional(),
  unitProject: z.string().optional(),
  detailedProject: z.string().optional(),
  statItem: z.string().optional(),
});

export type BudgetCategoryDto = z.infer<typeof BudgetCategorySchema>;

export const BudgetEntrySchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  amount: z.number(),
  date: z.string(),
  purpose: z.string(),
  memo: z.string().optional(),
  isPlanned: z.boolean().optional(),
  entryType: z.literal('approval').optional(),
  actionType: BudgetActionTypeSchema.optional(),
  inventoryItemId: z.string().optional(),
  docRegNum: z.string().optional(),
});

export type BudgetEntryDto = z.infer<typeof BudgetEntrySchema>;

// ============ Project Module ============
export const ChecklistItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean(),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  color: z.string(),
  checklistItems: z.array(ChecklistItemSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ============ Knowledge Base Module ============
export const KnowledgeEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  category: z.string(),
  tags: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
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
