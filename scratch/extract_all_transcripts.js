const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\user\\.gemini\\antigravity\\brain';

function isActualDataArray(arr) {
  if (!Array.isArray(arr)) return false;
  if (arr.length === 0) return false;
  const first = arr[0];
  if (!first || typeof first !== 'object') return false;
  
  // Check if it looks like BudgetCategory data
  const hasSubItems = arr.some(item => item.subItems && Array.isArray(item.subItems) && item.subItems.length > 0);
  const hasNames = arr.some(item => item.name && typeof item.name === 'string');
  const hasDetailedProject = arr.some(item => item.detailedProject && typeof item.detailedProject === 'string');
  
  return hasSubItems && hasNames && hasDetailedProject;
}

function recursiveSearch(val, filename, stepIndex) {
  if (!val) return;
  if (isActualDataArray(val)) {
    console.log(`🎉 FOUND DATA ARRAY in file ${filename} step ${stepIndex}!`);
    console.log(JSON.stringify(val.slice(0, 2), null, 2));
    const outPath = path.join('scratch', `recovered_data_array_${path.basename(path.dirname(path.dirname(path.dirname(filename))))}_step${stepIndex}.json`);
    fs.writeFileSync(outPath, JSON.stringify(val, null, 2), 'utf8');
    return;
  }
  
  if (Array.isArray(val)) {
    for (const item of val) {
      recursiveSearch(item, filename, stepIndex);
    }
  } else if (typeof val === 'object') {
    for (const [key, value] of Object.entries(val)) {
      // Sometimes it is stringified inside a string
      if (typeof value === 'string' && (value.trim().startsWith('[') || value.trim().startsWith('{'))) {
        try {
          const parsed = JSON.parse(value);
          recursiveSearch(parsed, filename, stepIndex);
        } catch (e) {}
      } else {
        recursiveSearch(value, filename, stepIndex);
      }
    }
  }
}

function scan() {
  try {
    const dirs = fs.readdirSync(brainDir);
    console.log(`Scanning ${dirs.length} conversation folders for actual budget categories data...`);
    
    for (const dir of dirs) {
      const logPath = path.join(brainDir, dir, '.system_generated', 'logs', 'transcript.jsonl');
      if (!fs.existsSync(logPath)) continue;
      
      const fileContent = fs.readFileSync(logPath, 'utf8');
      const lines = fileContent.split('\n');
      
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const step = JSON.parse(line);
          recursiveSearch(step, logPath, step.step_index);
        } catch (e) {}
      }
    }
    console.log('Scan complete.');
  } catch (err) {
    console.error('Scan failed:', err);
  }
}

scan();
