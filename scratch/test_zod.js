const { z } = require('zod');
const fs = require('fs');

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
  createdAt: z.string().catch(new Date().toISOString()),
  updatedAt: z.string().catch(new Date().toISOString()),
  tags: z.array(z.string()).default([]).catch([]),
});

const data = JSON.parse(fs.readFileSync('./data/BUDGET_CATEGORIES.json', 'utf8'));
const item = data.find(c => c.id === 'mnrcir0vpun1ops6x');

const res = BudgetCategorySchema.safeParse(item);
console.log("Success?", res.success);
if (!res.success) {
    console.log(res.error);
}
