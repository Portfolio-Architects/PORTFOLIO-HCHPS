const fs = require('fs');
const rawCategories = JSON.parse(fs.readFileSync('data/BUDGET_CATEGORIES.json', 'utf8'));
const seen = new Set();
const uniqueCategories = rawCategories.filter(c => {
  const key = `${c.name}-${c.policyProject}-${c.unitProject}-${c.detailedProject}-${c.statItem}-${c.budgetType || '본예산'}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
console.log('Raw:', rawCategories.reduce((s, c) => s + c.totalBudget, 0));
console.log('Unique:', uniqueCategories.reduce((s, c) => s + c.totalBudget, 0));
