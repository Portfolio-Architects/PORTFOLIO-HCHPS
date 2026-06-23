const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\33e0dc24-690c-4c37-9e57-57d9fe073ee4\\.system_generated\\logs\\transcript.jsonl';

if (!fs.existsSync(logPath)) {
  console.error("Log file not found at: " + logPath);
  process.exit(1);
}

const fileContent = fs.readFileSync(logPath, 'utf8');
const lines = fileContent.split('\n');

console.log(`Total log steps: ${lines.length}`);

lines.forEach((line, idx) => {
  if (!line.trim()) return;
  try {
    const step = JSON.parse(line);
    // replace_file_content or write_to_file or multi_replace_file_content where target is PortfolioDashboardView.tsx
    if (step.tool_calls) {
      step.tool_calls.forEach(tc => {
        if (tc.name && tc.name.includes('replace') && tc.args && tc.args.TargetFile && tc.args.TargetFile.includes('PortfolioDashboardView.tsx')) {
          console.log(`[Step ${step.step_index}] Tool: ${tc.name}`);
          console.log(`  Instruction: ${tc.args.Instruction}`);
          console.log(`  StartLine: ${tc.args.StartLine}, EndLine: ${tc.args.EndLine}`);
          console.log(`  TargetContent (first 100 chars): ${tc.args.TargetContent ? tc.args.TargetContent.substring(0, 100).replace(/\r?\n/g, '\\n') : 'none'}`);
        }
      });
    }
    // Also log system generated file mutations
    if (step.type === 'CODE_ACTION' && step.content && step.content.includes('PortfolioDashboardView.tsx')) {
      console.log(`[Step ${step.step_index}] CODE_ACTION for PortfolioDashboardView.tsx`);
      console.log(`  Content snippet: ${step.content.substring(0, 300).replace(/\r?\n/g, '\\n')}`);
    }
  } catch (e) {
    // Ignore invalid JSON lines
  }
});
