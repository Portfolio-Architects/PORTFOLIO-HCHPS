const fs = require('fs');
const path = require('path');

const scratchDir = 'scratch';
const files = fs.readdirSync(scratchDir);

console.log(`Inspecting ${files.length} files in scratch/`);

let bestFile = null;
let bestLength = 0;
let bestContent = null;

files.forEach(file => {
  if (!file.startsWith('recovered_subitems_') || !file.endsWith('.json')) return;
  const filePath = path.join(scratchDir, file);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (data.type === 'VIEW_FILE' && data.content && data.content.includes('PortfolioDashboardView.tsx')) {
      // Find the one that has the largest line count or length
      const contentLen = data.content.length;
      if (contentLen > bestLength) {
        bestLength = contentLen;
        bestFile = file;
        bestContent = data.content;
      }
    }
  } catch (e) {}
});

if (bestFile) {
  console.log(`Found best file: ${bestFile} with length: ${bestLength}`);
  // Parse lines to clean up prefix line numbers
  const linesOfContent = bestContent.split('\n');
  const codeLines = [];
  
  linesOfContent.forEach(l => {
    const match = l.match(/^\d+:\s?(.*)/);
    if (match) {
      codeLines.push(match[1]);
    }
  });

  const cleanCode = codeLines.join('\n');
  fs.writeFileSync('scratch/recovered_portfolio_view.txt', cleanCode, 'utf8');
  console.log("Saved CLEAN recovered code to scratch/recovered_portfolio_view.txt");
  
  console.log("=== HEAD ===");
  console.log(cleanCode.substring(0, 500));
} else {
  console.log("No PortfolioDashboardView.tsx VIEW_FILE records found in scratch JSON files.");
}
