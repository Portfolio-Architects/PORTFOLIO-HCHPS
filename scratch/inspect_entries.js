const fs = require('fs');
const entries = JSON.parse(fs.readFileSync('d:\\Desktop\\PORTFOLIO\\PORTFOLIO - VITAL\\data\\BUDGET_ENTRIES.json', 'utf8'));
const catEntries = entries.filter(e => e.categoryId === 'mnrcir0v5zjn4qxyg');
catEntries.forEach(e => {
  console.log(`Entry: date=${e.date}, amount=${e.amount}, isPlanned=${e.isPlanned}, purpose=${e.purpose}`);
});
