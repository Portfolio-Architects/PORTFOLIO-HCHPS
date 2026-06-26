const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Starting Codebase Diagnostics (diagnose-targets.js)...');

const reportPath = path.join(process.cwd(), 'data', 'diagnose_report.json');
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
    const directFetchRegex = /(?<!\/\/\s*|import\s+.*from\s+['"])(fetch\s*\(|axios\.(get|post|put|delete)\(|fetchPayload\s*\()/g;
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
    
    // Check for empty dependency arrays in useEffect that might cause infinite rendering if states are mutated within them
    if (content.includes('useEffect') && content.includes('set')) {
      const useEffectMatches = content.match(/useEffect\s*\(\s*\(\s*\)\s*=>\s*\{((?:(?!useEffect|useCallback)[\s\S])*?)\}\s*,\s*\[\s*\]\s*\)/g);
      if (useEffectMatches) {
        useEffectMatches.forEach(effectMatch => {
          // If we mutate local states within an empty dependency array effect without proper gating, it could loop or miss updates
          if (effectMatch.includes('setTasks') || effectMatch.includes('setBudget') || effectMatch.includes('set') && effectMatch.length > 500) {
            report.performanceBottlenecks.push({
              file: relativePath,
              message: 'State mutations inside useEffect with empty dependency array can trigger unnecessary/double renders. Consider useMemo or wrapping state update in local action handlers.'
            });
          }
        });
      }
    }

    // Check for large modules rendered directly without React.lazy/dynamic imports
    if (relativePath.includes('page.tsx') || relativePath.includes('dashboard')) {
      const importRegex = /import\s+\w+\s+from\s+['"].*(MindMap3D|WeeklyScheduler|InventoryList|BlockNote).*['"]/g;
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

// Write report to file
try {
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`🎉 Diagnostic report successfully compiled to data/diagnose_report.json!`);
  console.log(`   - Lint Warnings: ${report.summary.totalWarnings}`);
  console.log(`   - Arch Violations: ${report.summary.totalViolations}`);
  console.log(`   - Perf Bottlenecks: ${report.summary.totalBottlenecks}`);
} catch (writeErr) {
  console.error('❌ Failed to write diagnostic report:', writeErr.message);
}
