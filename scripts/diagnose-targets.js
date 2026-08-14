const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const isForce = args.includes('--force');
const skipEslint = args.includes('--skip-eslint');
const isCompact = args.includes('--compact');

console.log('🔍 Starting Codebase Diagnostics (diagnose-targets.js)...');

const reportPath = path.join(process.cwd(), 'data', 'diagnose_report.json');
const cachePath = path.join(process.cwd(), 'data', '.diagnose_cache.json');
const LOCK_GUARD_MS = 180 * 1000;

// Helper to get latest mtime under src/
function getLatestSrcMtime(dir) {
  let maxMtime = 0;
  if (!fs.existsSync(dir)) return maxMtime;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        maxMtime = Math.max(maxMtime, getLatestSrcMtime(full));
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.json')) {
      maxMtime = Math.max(maxMtime, stat.mtimeMs);
    }
  }
  return maxMtime;
}

// 180s Lock Guard & Cache Check
if (!isForce && fs.existsSync(cachePath) && fs.existsSync(reportPath)) {
  try {
    const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const now = Date.now();
    const elapsed = now - (cacheData.timestampMs || 0);
    const srcDir = path.join(process.cwd(), 'src');
    const latestSrcMtime = getLatestSrcMtime(srcDir);
    const sourceUnchanged = latestSrcMtime <= (cacheData.timestampMs || 0);

    if (elapsed < LOCK_GUARD_MS && sourceUnchanged) {
      const remainingSec = Math.round((LOCK_GUARD_MS - elapsed) / 1000);
      console.log(`  ↳ ⏱️  [LOCK GUARD] Cache valid (${remainingSec}s remaining, 0 source modifications). Bypassing scan.`);
      process.exit(0);
    }
  } catch (cacheErr) {
    // Ignore cache parse error, proceed to full scan
  }
}

const report = {
  timestamp: new Date().toISOString(),
  lintWarnings: [],
  architecturalViolations: [],
  performanceBottlenecks: [],
  summary: {
    totalWarnings: 0,
    totalViolations: 0,
    totalBottlenecks: 0
  }
};

// 1. Run ESLint to gather formatting/style/type issues
if (!skipEslint) {
  try {
    console.log('  ↳ Running ESLint syntax check...');
    // eslint --format json outputs valid json. It will return non-zero exit code if there are errors, so we catch in try/catch.
    let eslintOutput = '';
    try {
      eslintOutput = execSync('npx eslint --format json src', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    } catch (err) {
      // If lint issues exist, it throws an error but outputs json to stdout
      eslintOutput = err.stdout || '';
    }

    if (eslintOutput.trim()) {
      const results = JSON.parse(eslintOutput);
      results.forEach(fileResult => {
        const messages = fileResult.messages || [];
        const relevantMessages = messages.filter(m => m.severity >= 1); // 1 = warning, 2 = error
        
        if (relevantMessages.length > 0) {
          const relativeFilePath = path.relative(process.cwd(), fileResult.filePath);
          relevantMessages.forEach(msg => {
            report.lintWarnings.push({
              file: relativeFilePath.replace(/\\/g, '/'),
              line: msg.line,
              column: msg.column,
              ruleId: msg.ruleId,
              message: msg.message,
              severity: msg.severity === 2 ? 'error' : 'warning'
            });
          });
        }
      });
    }
  } catch (eslintFatal) {
    console.warn('  ⚠️ ESLint diagnostic failed or yielded invalid JSON:', eslintFatal.message);
  }
} else {
  console.log('  ↳ ℹ️  [SKIP] ESLint subprocess skipped via --skip-eslint flag.');
}

// Helper to recursively list files
function getFilesRecursively(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        getFilesRecursively(filePath, fileList);
      }
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        fileList.push(filePath);
      }
    }
  });
  return fileList;
}

// 2. Structural & Architectural Check (MVC ontology alignment)
// Rule: Direct fetch/axios/crypto calls inside UI components (src/components) is prohibited. UI must use custom hooks (src/hooks).
console.log('  ↳ Checking architectural alignments (MVC ontology)...');
try {
  const componentFiles = getFilesRecursively(path.join(process.cwd(), 'src', 'components'));
  
  componentFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(process.cwd(), file).replace(/\\/g, '/');
    
    // Check for direct fetch or window.fetch calls (excluding imports and hooks)
    const directFetchRegex = /(?<!\/\/\s*|import\s+.*from\s+['"])(\bfetch\s*\(|axios\.(get|post|put|delete)\(|fetchPayload\s*\()/g;
    let match;
    while ((match = directFetchRegex.exec(content)) !== null) {
      // Find line number
      const lineNo = content.substring(0, match.index).split('\n').length;
      report.architecturalViolations.push({
        file: relativePath,
        line: lineNo,
        pattern: match[0].trim(),
        message: 'Direct API fetch detected inside UI component. Use custom hooks from src/hooks/ (React Query/useTasks/useBudget) instead.'
      });
    }

    // Check if E2EE encryption bypass is attempted (deactivating E2EE)
    if (content.includes('encryptPayload') && (content.includes('bypass') || content.includes('//') && content.includes('E2EE'))) {
      const lineNo = content.indexOf('encryptPayload') !== -1 ? content.substring(0, content.indexOf('encryptPayload')).split('\n').length : 1;
      report.architecturalViolations.push({
        file: relativePath,
        line: lineNo,
        pattern: 'Potential E2EE bypass',
        message: 'Suspicious comment or logic referencing E2EE encryption bypass. End-to-end encryption must remain strictly active.'
      });
    }
  });
} catch (archErr) {
  console.warn('  ⚠️ Architectural validation failed:', archErr.message);
}

// 3. Performance checks (Bottlenecks in rendering and states)
console.log('  ↳ Identifying rendering performance bottlenecks...');
try {
  const allSourceFiles = getFilesRecursively(path.join(process.cwd(), 'src'));
  
  allSourceFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(process.cwd(), file).replace(/\\/g, '/');
    
    // 3-1. Check for empty dependency arrays in useEffect that might cause infinite rendering if states are mutated within them
    if (content.includes('useEffect') && content.includes('set')) {
      const useEffectMatches = content.match(/useEffect\s*\(\s*\(\s*\)\s*=>\s*\{((?:(?!useEffect|useCallback)[\s\S])*?)\}\s*,\s*\[\s*\]\s*\)/g);
      if (useEffectMatches) {
        useEffectMatches.forEach(effectMatch => {
          if (effectMatch.includes('setTasks') || effectMatch.includes('setBudget') || effectMatch.includes('set') && effectMatch.length > 500) {
            report.performanceBottlenecks.push({
              file: relativePath,
              message: 'State mutations inside useEffect with empty dependency array can trigger unnecessary/double renders. Consider useMemo or wrapping state update in local action handlers.'
            });
          }
        });
      }
    }

    // 3-2. Check for nested filtering loops inside rendering loops (O(N^2) complexity threat)
    const loopKeywords = ['.map', '.forEach', '.filter', '.reduce'];
    loopKeywords.forEach(kw => {
      if (content.includes(kw) && (content.includes('.filter(') || content.includes('.find(') || content.includes('.some('))) {
        let pos = 0;
        while ((pos = content.indexOf(kw, pos)) !== -1) {
          const windowText = content.substring(pos, pos + 800);
          const mapMatch = windowText.match(/(?:\.map|\.forEach|\.filter|\.reduce)\s*\(\s*(?:\([^)]*\)|\w+)\s*=>\s*\{?([\s\S]*?)(?:\}\s*\)|,\s*|\)\s*;?)/);
          if (mapMatch) {
            const mapBody = mapMatch[1];
            // Ensure we don't flag if it's already using pre-grouped entries map lookup O(1)
            if ((mapBody.includes('.filter(') || mapBody.includes('.find(') || mapBody.includes('.some(')) && 
                !mapBody.includes('entriesByCatId') && !mapBody.includes('liveNodesMap') && !mapBody.includes('executedNoIssuanceByCatId') && !mapBody.includes('entriesByCatMap')) {
              const lineNo = content.substring(0, pos).split('\n').length;
              report.performanceBottlenecks.push({
                file: relativePath,
                line: lineNo,
                pattern: `${kw}( ... .filter/find/some )`,
                message: `Detected nested filter/find/some lookup inside component ${kw}() loop. This leads to O(N^2) complexity. Extract mapping calculations using useMemo or pre-group data into O(1) maps.`
              });
            }
          }
          pos += kw.length;
        }
      }
    });

    // 3-3. Check for raw console spams inside components
    if (relativePath.startsWith('src/components/') && (content.includes('console.warn') || content.includes('console.error'))) {
      const lineNo = content.indexOf('console.warn') !== -1 ? content.substring(0, content.indexOf('console.warn')).split('\n').length : content.substring(0, content.indexOf('console.error')).split('\n').length;
      // Exclude system logs or dev server warnings
      if (!content.includes('// console.warn') && !content.includes('// console.error')) {
        report.performanceBottlenecks.push({
          file: relativePath,
          line: lineNo,
          pattern: 'console.warn/error',
          message: 'Direct console logging inside component. This can spam the console and freeze the browser thread during high frequency renders.'
        });
      }
    }

    // 3-4. Check for large modules rendered directly without React.lazy/dynamic imports
    if (relativePath.includes('page.tsx') || relativePath.includes('dashboard')) {
      const importRegex = /import\s+\{?\s*\w+\s*\}?\s+from\s+['"].*(MindMap3D|WeeklyScheduler|InventoryList|BlockNote).*['"]/g;
      const matches = content.match(importRegex);
      if (matches) {
        matches.forEach(m => {
          report.performanceBottlenecks.push({
            file: relativePath,
            pattern: m,
            message: 'Direct import of heavy visualization/editor module. Consider utilizing Next.js next/dynamic import to minimize bundle size and eliminate dashboard lag.'
          });
        });
      }
    }
  });
} catch (perfErr) {
  console.warn('  ⚠️ Performance bottleneck detection failed:', perfErr.message);
}

// Compile stats
report.summary.totalWarnings = report.lintWarnings.length;
report.summary.totalViolations = report.architecturalViolations.length;
report.summary.totalBottlenecks = report.performanceBottlenecks.length;

const isClean = report.summary.totalWarnings === 0 && 
                report.summary.totalViolations === 0 && 
                report.summary.totalBottlenecks === 0;

let outputContent;
if (isClean || isCompact) {
  outputContent = JSON.stringify({
    ts: report.timestamp,
    clean: isClean,
    summary: {
      w: report.summary.totalWarnings,
      v: report.summary.totalViolations,
      b: report.summary.totalBottlenecks
    },
    ...(isClean ? {} : {
      warn: report.lintWarnings.map(w => ({ f: w.file, l: w.line, r: w.ruleId })),
      viol: report.architecturalViolations.map(v => ({ f: v.file, l: v.line, m: v.message })),
      bot: report.performanceBottlenecks.map(b => ({ f: b.file, l: b.line, m: b.message }))
    })
  });
} else {
  outputContent = JSON.stringify(report, null, 2);
}

// Write report and cache to file
try {
  fs.writeFileSync(reportPath, outputContent, 'utf-8');
  fs.writeFileSync(cachePath, JSON.stringify({ timestampMs: Date.now() }), 'utf-8');
  console.log(`🎉 Diagnostic report successfully compiled to data/diagnose_report.json!`);
  console.log(`   - Lint Warnings: ${report.summary.totalWarnings}`);
  console.log(`   - Arch Violations: ${report.summary.totalViolations}`);
  console.log(`   - Perf Bottlenecks: ${report.summary.totalBottlenecks}`);
} catch (writeErr) {
  console.error('❌ Failed to write diagnostic report:', writeErr.message);
}
