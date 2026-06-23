const fs = require('fs');

const logPath = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\33e0dc24-690c-4c37-9e57-57d9fe073ee4\\.system_generated\\logs\\transcript.jsonl';

if (!fs.existsSync(logPath)) {
  console.error("Log file not found");
  process.exit(1);
}

const fileContent = fs.readFileSync(logPath, 'utf8');
const lines = fileContent.split('\n');

console.log(`Total log steps: ${lines.length}`);

// We want to find the latest VIEW_FILE of PortfolioDashboardView.tsx that has long content
let foundContent = null;
let foundStep = -1;

for (let i = lines.length - 1; i >= 0; i--) {
  const line = lines[i].trim();
  if (!line) continue;
  try {
    const step = JSON.parse(line);
    // If it's a VIEW_FILE step of PortfolioDashboardView.tsx
    if (step.type === 'VIEW_FILE' && step.content && step.content.includes('PortfolioDashboardView.tsx') && step.content.includes('allBreakdownData')) {
      // Check if it has a high line count or content length
      if (step.content.includes('Total Lines: 669') || (step.content.length > 30000)) {
        foundContent = step.content;
        foundStep = step.step_index;
        break;
      }
    }
  } catch (e) {}
}

if (foundContent) {
  console.log(`Found VIEW_FILE at step ${foundStep}! Content length: ${foundContent.length}`);
  
  // Parse clean content (remove line prefix like "123: ")
  const linesOfContent = foundContent.split('\n');
  const codeLines = [];
  let codeBlockStarted = false;
  
  linesOfContent.forEach(l => {
    // Detect code lines after header, in format "123: original_line"
    const match = l.match(/^\d+:\s?(.*)/);
    if (match) {
      codeLines.push(match[1]);
    }
  });

  const cleanCode = codeLines.join('\n');
  
  fs.writeFileSync('scratch/recovered_portfolio_view.txt', cleanCode, 'utf8');
  console.log("Saved CLEAN code to scratch/recovered_portfolio_view.txt");
  
  console.log("=== HEAD ===");
  console.log(cleanCode.substring(0, 500));
  console.log("=== TAIL ===");
  console.log(cleanCode.substring(cleanCode.length - 500));
} else {
  console.log("Could not find full VIEW_FILE logs.");
}
