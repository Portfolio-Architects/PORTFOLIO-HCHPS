import { BudgetCategorySchema } from '../src/lib/schemas';
import * as fs from 'fs';

const data = JSON.parse(fs.readFileSync('./data/BUDGET_CATEGORIES.json', 'utf-8'));
data.forEach((r: any) => {
  const res = BudgetCategorySchema.safeParse(r);
  if (!res.success) {
    console.log('ERROR ON ID', r.id);
    console.log(res.error);
  }
});
console.log('Finished parsing', data.length, 'items');
