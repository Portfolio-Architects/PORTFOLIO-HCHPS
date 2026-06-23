const fs = require('fs');
const data = JSON.parse(fs.readFileSync('d:\\Desktop\\PORTFOLIO\\PORTFOLIO - VITAL\\data\\BUDGET_CATEGORIES.json', 'utf8'));
const cat = data.find(c => c.id === 'mnrcir0v5zjn4qxyg');
console.log("Category Name:", cat.name);
console.log("totalBudget:", cat.totalBudget);
cat.subItems.forEach(sub => {
  console.log(`SubItem [${sub.name}]: amount=${sub.amount}, virtualAdjustment=${sub.virtualAdjustment}, type=${typeof sub.virtualAdjustment}`);
  if (sub.calculations) {
    sub.calculations.forEach(calc => {
      console.log(`  Calc [${calc.name || calc.calculation}]: amount=${calc.amount}, virtualAdjustment=${calc.virtualAdjustment}, type=${typeof calc.virtualAdjustment}`);
    });
  }
});
