const fs = require('fs');
const path = require('path');
const { z } = require('zod');

// Recreate the schemas here to test validation easily
const TaskStatusSchema = z.enum(['todo', 'in-progress', 'done']);
const TaskPrioritySchema = z.enum(['low', 'medium', 'high']);
const TaskSchema = z.object({
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

const BudgetActionTypeSchema = z.enum(['general', 'issuance', 'daily_expense']);

const BudgetCategorySchema = z.object({
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
    id: z.string().optional(),
    prefix: z.string().optional(),
    name: z.string(),
    calculation: z.string().optional(),
    amount: z.number(),
    isCustomFunding: z.boolean().optional(),
    isLocked: z.boolean().optional(),
    fundingSplits: z.array(z.object({
      source: z.string(),
      amount: z.number()
    })).optional(),
    calculations: z.array(z.object({
      id: z.string().optional(),
      name: z.string().optional(),
      calculation: z.string(),
      amount: z.number(),
      isCustomFunding: z.boolean().optional(),
      isLocked: z.boolean().optional(),
      fundingSplits: z.array(z.object({
        source: z.string(),
        amount: z.number()
      })).optional()
    })).optional()
  })).optional().catch(undefined),
  sortOrder: z.number().optional().catch(undefined),
});

const BudgetEntrySchema = z.object({
  id: z.string().catch('unknown-entry'),
  categoryId: z.string().catch('unknown-cat'),
  amount: z.number().catch(0),
  date: z.string().catch(new Date().toISOString()),
  purpose: z.string().catch('내역 없음'),
  memo: z.string().optional().catch(''),
  isPlanned: z.boolean().optional().catch(false),
  isSettled: z.boolean().optional().catch(false),
  relatedPlanId: z.string().optional().catch(undefined),
  linkedSubItemId: z.string().optional().catch(undefined),
  entryType: z.literal('approval').optional().catch(undefined),
  actionType: BudgetActionTypeSchema.optional().catch(undefined),
  inventoryItemId: z.string().optional().catch(undefined),
  docRegNum: z.string().optional().catch(''),
});

function checkValidation() {
  const categoriesPath = path.join(__dirname, '../data/BUDGET_CATEGORIES.json');
  const entriesPath = path.join(__dirname, '../data/BUDGET_ENTRIES.json');

  const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
  const entries = JSON.parse(fs.readFileSync(entriesPath, 'utf8'));

  console.log('--- BUDGET_CATEGORIES validation ---');
  for (const cat of categories) {
    const result = BudgetCategorySchema.safeParse(cat);
    if (!result.success) {
      console.log(`FAIL category: ${cat.id} (${cat.name})`, result.error.format());
    } else {
      console.log(`OK category: ${cat.id} (${cat.name})`);
    }
  }

  console.log('\n--- BUDGET_ENTRIES validation ---');
  for (const entry of entries) {
    const result = BudgetEntrySchema.safeParse(entry);
    if (!result.success) {
      console.log(`FAIL entry: ${entry.id}`, result.error.format());
    } else {
      console.log(`OK entry: ${entry.id}`);
    }
  }
}

checkValidation();
