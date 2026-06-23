const fs = require('fs');
const path = require('path');
const data = JSON.parse(fs.readFileSync('d:\\Desktop\\PORTFOLIO\\PORTFOLIO - VITAL\\data\\BUDGET_CATEGORIES.json', 'utf8'));

const filtered = data.filter(c => c.statItem && c.statItem.includes('201-01 사무관리비'));
console.log(`Found ${filtered.length} categories matching '201-01 사무관리비'`);

filtered.forEach(cat => {
  console.log("-----------------------------------------");
  console.log("Category ID:", cat.id);
  console.log("Category Name:", cat.name);
  console.log("totalBudget:", cat.totalBudget);
  if (cat.subItems) {
    cat.subItems.forEach(sub => {
      console.log(`  SubItem [${sub.name}]: amount=${sub.amount}, virtualAdjustment=${sub.virtualAdjustment}, note=${sub.note}`);
      if (sub.calculations) {
        sub.calculations.forEach(calc => {
          console.log(`    Calc [${calc.name}]: amount=${calc.amount}, virtualAdjustment=${calc.virtualAdjustment}, note=${calc.note}`);
        });
      }
    });
  }
});
