const fs = require('fs');
const content = fs.readFileSync('scratch/rolled_back_code_step253_formatted.txt', 'utf8');

const keyword = '대카테';
const index = content.indexOf(keyword);
if (index !== -1) {
  console.log("Keyword found at index", index);
  console.log("--- Surrounding Content (from index - 100 to end) ---");
  // Let's print in blocks of 500 characters to prevent any truncation
  const sub = content.substring(index - 100);
  for (let i = 0; i < sub.length; i += 500) {
    console.log(`\n--- Block ${i} ---`);
    console.log(sub.substring(i, i + 500));
  }
} else {
  console.log("Keyword not found!");
}
