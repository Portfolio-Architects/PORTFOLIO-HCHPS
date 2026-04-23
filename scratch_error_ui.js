const fs = require('fs');
let txt = fs.readFileSync('src/components/budget/BudgetDashboard.tsx', 'utf8');

txt = txt.replace(/alert\(\`Error: (.*?)\`\);/g, 'setEntryError(`$1`.trim());');
txt = txt.replace(/alert\('Error: ' \+ validation.message\);/g, 'setEntryError(validation.message || "요청을 처리할 수 없습니다.");');

// Clear entry errors when modal closes
txt = txt.replace(
  'const closeEntryModal = () => {',
  'const closeEntryModal = () => {\n    setEntryError(null);'
);

// Clear error on new submission
txt = txt.replace(
  'const handleAddEntry = (e: React.FormEvent) => {\n    e.preventDefault();',
  'const handleAddEntry = (e: React.FormEvent) => {\n    e.preventDefault();\n    setEntryError(null);'
);

// Add the UI
txt = txt.replace(
  '{/* Action Selection */}',
  '{entryError && (\n              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-bold shadow-sm flex items-center justify-between mb-4">\n                <div>{entryError.split(\'\\n\').map((line, i) => <span key={i}>{line}<br/></span>)}</div>\n              </div>\n            )}\n            {/* Action Selection */}'
);

fs.writeFileSync('src/components/budget/BudgetDashboard.tsx', txt, 'utf8');
console.log('Replaced alerts with entryError!');
