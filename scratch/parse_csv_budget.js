const fs = require('fs');

const file = fs.readFileSync('scratch/tmp_budget_utf8.csv', 'utf8');
const lines = file.split('\n');

console.log(`Total CSV lines: ${lines.length}`);

for (const line of lines) {
  if (line.includes('건강증진지원실') || line.includes('체력인증센터') || line.includes('건강생활실천')) {
    // Print first 150 chars of matching line
    console.log(line.slice(0, 200));
  }
}
