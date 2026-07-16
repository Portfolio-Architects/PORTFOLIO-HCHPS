const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Invoking Self-Evolution Optimizer...');

const diagnoseReportPath = path.join(process.cwd(), 'data', 'diagnose_report.json');
const statePath = path.join(process.cwd(), 'data', 'self_evolution_state.json');
const reportDir = path.join(process.cwd(), 'data');

// Ensure data directory exists
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

// Robust file writer with retries for Windows file lock (EBUSY) issues
function writeFileSyncWithRetry(filePath, content, encoding = 'utf8', retries = 5, delay = 200) {
  for (let i = 0; i < retries; i++) {
    try {
      fs.writeFileSync(filePath, content, encoding);
      return;
    } catch (err) {
      if (err.code === 'EBUSY' && i < retries - 1) {
        console.warn(`⚠️  File ${filePath} is busy/locked. Retrying in ${delay}ms... (${i + 1}/${retries})`);
        const start = Date.now();
        while (Date.now() - start < delay) {}
      } else {
        throw err;
      }
    }
  }
}

// 1. Run codebase diagnostics to update data/diagnose_report.json
try {
  console.log('  ↳ Running diagnose-targets.js to update report...');
  execSync('node scripts/diagnose-targets.js', { stdio: 'inherit' });
} catch (e) {
  console.warn('  ⚠️ Diagnostics failed to run, utilizing existing report if available:', e.message);
}

if (!fs.existsSync(diagnoseReportPath)) {
  console.error('❌ Error: diagnose_report.json does not exist. Cannot proceed.');
  process.exit(1);
}

let report;
try {
  report = JSON.parse(fs.readFileSync(diagnoseReportPath, 'utf8'));
} catch (err) {
  console.error('❌ Failed to parse diagnose_report.json:', err.message);
  process.exit(1);
}

const bottlenecks = report.performanceBottlenecks || [];
if (bottlenecks.length === 0) {
  console.log('🎉 No performance bottlenecks detected. System is fully optimized!');
  process.exit(0);
}

// Load persistent state to track consecutive failures
let state = { consecutiveFailures: {} };
if (fs.existsSync(statePath)) {
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (e) {
    console.warn('  ⚠️ Failed to parse state file, resetting state:', e.message);
  }
}

// Group bottlenecks by file
const bottlenecksByFile = {};
bottlenecks.forEach(b => {
  if (!b.file) return;
  if (!bottlenecksByFile[b.file]) {
    bottlenecksByFile[b.file] = [];
  }
  bottlenecksByFile[b.file].push(b);
});

// Helper: Ensure useMemo is imported from 'react'
function ensureUseMemoImport(content) {
  if (content.includes('useMemo')) return content;
  
  const bracesImport = /import\s+React\s*,\s*\{\s*([^}]+)\s*\}\s*from\s+['"]react['"]/g;
  if (bracesImport.test(content)) {
    return content.replace(bracesImport, (match, p1) => {
      if (p1.includes('useMemo')) return match;
      return `import React, { ${p1.trim()}, useMemo } from 'react'`;
    });
  }
  
  const simpleImport = /import\s+React\s+from\s+['"]react['"]/g;
  if (simpleImport.test(content)) {
    return content.replace(simpleImport, `import React, { useMemo } from 'react'`);
  }
  
  const onlyBraces = /import\s*\{\s*([^}]+)\s*\}\s*from\s+['"]react['"]/g;
  if (onlyBraces.test(content)) {
    return content.replace(onlyBraces, (match, p1) => {
      if (p1.includes('useMemo')) return match;
      return `import { ${p1.trim()}, useMemo } from 'react'`;
    });
  }
  
  return `import React, { useMemo } from 'react';\n` + content;
}

// Helper: Comment out console.warn or console.error
function suppressConsoleSpams(content) {
  let pos = 0;
  while (true) {
    const warnIndex = content.indexOf('console.warn', pos);
    const errorIndex = content.indexOf('console.error', pos);
    let index = -1;
    if (warnIndex !== -1 && errorIndex !== -1) {
      index = Math.min(warnIndex, errorIndex);
    } else if (warnIndex !== -1) {
      index = warnIndex;
    } else if (errorIndex !== -1) {
      index = errorIndex;
    }
    
    if (index === -1) break;
    
    const lineStart = content.lastIndexOf('\n', index) + 1;
    const lineEnd = content.indexOf('\n', index);
    const line = content.substring(lineStart, lineEnd !== -1 ? lineEnd : content.length);
    
    // Check if already commented
    if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().includes('/* console.')) {
      pos = index + 12;
      continue;
    }
    
    // Scan matching parentheses
    let parenCount = 0;
    let endCall = -1;
    for (let i = index; i < content.length; i++) {
      if (content[i] === '(') {
        parenCount++;
      } else if (content[i] === ')') {
        parenCount--;
        if (parenCount === 0) {
          let nextIdx = i + 1;
          while (nextIdx < content.length && /\s/.test(content[nextIdx])) {
            nextIdx++;
          }
          if (content[nextIdx] === ';') {
            endCall = nextIdx + 1;
          } else {
            endCall = i + 1;
          }
          break;
        }
      }
    }
    
    if (endCall !== -1) {
      const originalCall = content.substring(index, endCall);
      const commentedCall = `/* ${originalCall} */`;
      content = content.substring(0, index) + commentedCall + content.substring(endCall);
      pos = index + commentedCall.length;
    } else {
      pos = index + 12;
    }
  }
  return content;
}

// Helper: Convert static imports of heavy components to Next.js dynamic imports
function convertToDynamicImports(content) {
  const heavyComponents = ['MindMap3D', 'WeeklyScheduler', 'InventoryList', 'BlockNote'];
  let modified = false;
  
  heavyComponents.forEach(comp => {
    // Regex matching static imports and matching optional semicolon
    const staticImportRegex = new RegExp(`import\\s+(\\{?\\s*${comp}\\s*\\}?)\\s+from\\s+['"]([^'"]+)['"];?`, 'g');
    
    if (staticImportRegex.test(content)) {
      content = content.replace(staticImportRegex, (match, g1, g3) => {
        modified = true;
        const isNamed = g1.includes('{');
        if (isNamed) {
          return `const ${comp} = dynamic(() => import('${g3}').then(mod => mod.${comp}), { ssr: false });`;
        } else {
          return `const ${comp} = dynamic(() => import('${g3}'), { ssr: false });`;
        }
      });
    }
  });
  
  if (modified && !content.includes('import dynamic from')) {
    content = `import dynamic from 'next/dynamic';\n` + content;
  }
  
  return content;
}

// Check for test rollback command argument
const isRollbackTest = process.argv.includes('--test-rollback');

let refactoredO2 = false;
let refactoredConsole = false;
let refactoredDynamic = false;

const filesToProcess = Object.keys(bottlenecksByFile);
const backups = {};
let mutationsApplied = false;

filesToProcess.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) return;
  
  // Backup file
  const backupPath = fullPath + '.bak';
  fs.copyFileSync(fullPath, backupPath);
  backups[file] = backupPath;
  
  const fileBottlenecks = bottlenecksByFile[file];
  const failCount = state.consecutiveFailures[file] || 0;
  
  // If consecutive failures >= 3, apply FALLBACK mode
  const useFallback = failCount >= 3;
  if (useFallback) {
    console.log(`⚠️  [FALLBACK mode] File ${file} has failed validation ${failCount} times. Wrapping region in try-catch fallback.`);
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let originalContent = content;
  
  // 1. Refactor O(N^2) complexity mapping loops
  const hasO2 = fileBottlenecks.some(b => (b.pattern && b.pattern.includes('.map( ... .filter/find/some )')) || (b.message && b.message.includes('O(N^2)')));
  if (hasO2) {
    const findRegex = /const\s+(\w+)\s*=\s*(\w+)\.find\(\s*(\w+)\s*=>\s*(?:\3\.(\w+)\s*===?\s*(\w+)\.(\w+)|(\w+)\.(\w+)\s*===?\s*\3\.(\w+))\)/g;
    let match;
    content = ensureUseMemoImport(content);
    
    while ((match = findRegex.exec(content)) !== null) {
      const originalFind = match[0];
      const item = match[1];
      const list = match[2];
      const element = match[3];
      
      let key, outerElement, outerKey;
      if (match[4]) {
        key = match[4];
        outerElement = match[5];
        outerKey = match[6];
      } else {
        outerElement = match[7];
        outerKey = match[8];
        key = match[9];
      }
      
      const mapName = `${list}Map`;
      const memoStatement = `  const ${mapName} = useMemo(() => new Map(${list}.map(${element} => [${element}.${key}, ${element}])), [${list}]);`;
      
      // Insert useMemo statement before return statement
      const returnIndex = content.indexOf('return (');
      if (returnIndex !== -1) {
        const beforeReturn = content.substring(0, returnIndex);
        const lastLineBreak = beforeReturn.lastIndexOf('\n');
        content = content.substring(0, lastLineBreak + 1) + memoStatement + '\n' + content.substring(lastLineBreak + 1);
      }
      
      let replacement;
      if (useFallback) {
        replacement = `let ${item};\n  try {\n    ${item} = ${mapName}.get(${outerElement}.${outerKey});\n  } catch (err) {\n    /* FALLBACK mode fallback to O(N^2) */\n    console.error('[FALLBACK mode] ${mapName}.get failed:', err);\n    ${originalFind};\n  }`;
      } else {
        replacement = `const ${item} = ${mapName}.get(${outerElement}.${outerKey});`;
      }
      
      content = content.replace(originalFind, replacement);
      refactoredO2 = true;
    }
  }
  
  // 2. Refactor console warnings and errors
  const hasConsole = fileBottlenecks.some(b => b.pattern === 'console.warn/error' || (b.message && b.message.includes('console logging')));
  if (hasConsole && file.startsWith('src/components/')) {
    content = suppressConsoleSpams(content);
    refactoredConsole = true;
  }
  
  // 3. Refactor dynamic imports
  const hasDynamic = fileBottlenecks.some(b => b.pattern && b.pattern.includes('import') && (b.pattern.includes('MindMap3D') || b.pattern.includes('WeeklyScheduler') || b.pattern.includes('InventoryList') || b.pattern.includes('BlockNote')));
  if (hasDynamic) {
    content = convertToDynamicImports(content);
    refactoredDynamic = true;
  }
  
  // Intentionally inject a syntax error if rollback test is enabled
  if (isRollbackTest && file.includes('DummyPerfTest')) {
    content += '\n\n// Intentionally injected rollback test syntax error\nconst invalidSyntaxError = ;';
    console.log('🔧 [TEST] Injecting syntax error into DummyPerfTest to test Rollback Guard...');
  }
  
  if (content !== originalContent) {
    writeFileSyncWithRetry(fullPath, content, 'utf8');
    mutationsApplied = true;
    console.log(`🔧 Refactored ${file} successfully.`);
  }
});

if (!mutationsApplied) {
  console.log('No mutations were needed or applied.');
  // Clean up backups
  Object.keys(backups).forEach(file => {
    if (fs.existsSync(backups[file])) fs.unlinkSync(backups[file]);
  });
  process.exit(0);
}

// 2. Run harness verification
let validationPassed = false;
try {
  console.log('🔍 Executing run-harness.js for validation...');
  execSync('node scripts/run-harness.js', { stdio: 'inherit' });
  validationPassed = true;
} catch (err) {
  console.error('❌ Validation harness failed:', err.message);
  validationPassed = false;
}

// Helper: Record milestone details
function recordMilestoneInFile(filePath, milestoneText) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  const marker = '## 8. 최근 엔지니어링 마일스톤 (요약)';
  const index = content.indexOf(marker);
  if (index !== -1) {
    const insertPos = index + marker.length;
    let nextNewline = content.indexOf('\n', insertPos);
    if (nextNewline === -1) nextNewline = insertPos;
    
    const isCrLf = content.includes('\r\n');
    const newlineChar = isCrLf ? '\r\n' : '\n';
    
    let cursor = nextNewline;
    while (cursor < content.length && (content[cursor] === '\n' || content[cursor] === '\r' || content[cursor] === ' ')) {
      cursor++;
    }
    content = content.substring(0, cursor) + milestoneText + newlineChar + newlineChar + content.substring(cursor);
    writeFileSyncWithRetry(filePath, content, 'utf8');
    console.log(`  ↳ Recorded milestone in ${filePath}`);
  }
}

// 3. Rollback Guard
if (validationPassed) {
  console.log('✅ Validation succeeded! Committing improvements.');
  
  // Clean up backups and reset failure counts
  filesToProcess.forEach(file => {
    state.consecutiveFailures[file] = 0;
    if (fs.existsSync(backups[file])) {
      fs.unlinkSync(backups[file]);
    }
  });
  
  // Save updated state
  writeFileSyncWithRetry(statePath, JSON.stringify(state, null, 2), 'utf8');
  
  // Record milestone
  const today = new Date().toISOString().split('T')[0];
  let milestoneText = `### [자율 개선] 성능 최적화 및 console spams 제거 패치 (${today})\n`;
  if (refactoredO2) {
    milestoneText += `* **O(N^2) Complexity Reduction**: Convert rendering/map nested loops to O(1) Map lookups using useMemo.\n`;
  }
  if (refactoredConsole) {
    milestoneText += `* **Console Spam Suppression**: Comment out console.warn/error spams in components.\n`;
  }
  if (refactoredDynamic) {
    milestoneText += `* **Dynamic Import Migration**: Rewrite static imports of heavy components to Next.js dynamic imports.`;
  }
  
  recordMilestoneInFile(path.join(process.cwd(), 'PORTFOLIO VITAL - Engineering Report.md'), milestoneText);
  recordMilestoneInFile(path.join(process.cwd(), 'PORTFOLIO VITAL - Engineering Milestones.md'), milestoneText);
  
  // Run sync-rules
  try {
    console.log('  ↳ Running sync-rules.js...');
    execSync('node scripts/sync-rules.js', { stdio: 'inherit' });
  } catch (syncErr) {
    console.error('  ⚠️ sync-rules.js failed:', syncErr.message);
  }
  
  // Git commit and push
  try {
    console.log('  ↳ Committing to git...');
    execSync('git add .', { stdio: 'inherit' });
    
    let details = '';
    if (refactoredO2) details += 'O(N^2) complexity ';
    if (refactoredConsole) details += 'console spams ';
    if (refactoredDynamic) details += 'dynamic imports ';
    details = details.trim().replace(/ /g, ', ');
    
    const commitMsg = `[auto] self-improvement: optimize ${details}`;
    execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });
    
    try {
      execSync('git push', { stdio: 'inherit' });
    } catch (pushErr) {
      console.warn('  ⚠️ git push failed, skipping push:', pushErr.message);
    }
  } catch (gitErr) {
    console.warn('  ⚠️ Git commit failed:', gitErr.message);
  }
  
  process.exit(0);
} else {
  console.error('🚨 Validation failed! Reverting mutations.');
  
  // Revert changes from backups
  filesToProcess.forEach(file => {
    if (fs.existsSync(backups[file])) {
      fs.copyFileSync(backups[file], path.join(process.cwd(), file));
      fs.unlinkSync(backups[file]);
      console.log(`  ↳ Reverted ${file} successfully.`);
    }
    state.consecutiveFailures[file] = (state.consecutiveFailures[file] || 0) + 1;
  });
  
  // Save updated state
  writeFileSyncWithRetry(statePath, JSON.stringify(state, null, 2), 'utf8');
  console.log('Updated state failures:', state.consecutiveFailures);
  
  process.exit(1);
}
