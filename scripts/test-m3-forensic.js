const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🔬 FORENSIC AUDIT: Milestone 3 Verification Suite');
console.log('====================================================');

let passes = 0;
let violations = 0;

function auditPass(checkName, details) {
  console.log(`  ↳ ✅ [CLEAN] ${checkName}: ${details}`);
  passes++;
}

function auditViolation(checkName, details) {
  console.error(`  ↳ 🚨 [VIOLATION] ${checkName}: ${details}`);
  violations++;
}

const rootDir = path.resolve(__dirname, '..');
const useAuthPath = path.join(rootDir, 'src/hooks/useAuth.ts');
const loginPagePath = path.join(rootDir, 'src/app/login/page.tsx');
const protectedAppPath = path.join(rootDir, 'src/components/ProtectedApp.tsx');
const runHarnessPath = path.join(rootDir, 'scripts/run-harness.js');
const diagnoseTargetsPath = path.join(rootDir, 'scripts/diagnose-targets.js');

// ----------------------------------------------------
// 1. Forensic Inspection: src/hooks/useAuth.ts
// ----------------------------------------------------
console.log('\n🔍 [CHECK 1] Forensic Analysis of src/hooks/useAuth.ts...');

if (!fs.existsSync(useAuthPath)) {
  auditViolation('useAuth.ts Existence', 'File does not exist');
} else {
  const authCode = fs.readFileSync(useAuthPath, 'utf8');

  // Check 1.1: Client directive
  if (authCode.includes("'use client'") || authCode.includes('"use client"')) {
    auditPass('useAuth Directive', 'Correct "use client" directive present');
  } else {
    auditViolation('useAuth Directive', 'Missing "use client" directive');
  }

  // Check 1.2: Facade & Hardcoded output detection
  const hardcodedCredentials = ['ocs5298', '34237116!a', 'admin', 'password123'];
  let hasHardcodedCreds = false;
  hardcodedCredentials.forEach(cred => {
    if (authCode.includes(`'${cred}'`) || authCode.includes(`"${cred}"`)) {
      hasHardcodedCreds = true;
    }
  });

  if (!hasHardcodedCreds) {
    auditPass('No Hardcoded Credentials', 'useAuth does not hardcode credentials');
  } else {
    auditViolation('Hardcoded Credentials', 'useAuth hardcodes user credentials');
  }

  // Check 1.3: Real Network I/O vs Facade
  if (authCode.includes("fetch('/api/auth'") || authCode.includes('fetch("/api/auth"')) {
    auditPass('Real Network I/O', 'Delegates authentication to POST /api/auth via fetch API');
  } else {
    auditViolation('Real Network I/O', 'Missing authentic fetch calls to /api/auth');
  }

  // Check 1.4: Dummy return check (e.g. return true always)
  if (authCode.match(/return\s+true\s*;/g)?.length === 1 && authCode.includes('if (res.ok)')) {
    auditPass('Conditional Authenticity', 'Returns true conditionally based on res.ok');
  } else {
    auditViolation('Conditional Authenticity', 'Potential dummy return or unconditional success detected');
  }

  // Check 1.5: Error state management
  if (authCode.includes('setError(') && authCode.includes('resetError') && authCode.includes('isLoading')) {
    auditPass('State Management', 'Implements isLoading, error, setError, and resetError');
  } else {
    auditViolation('State Management', 'Incomplete state management interface');
  }

  // Check 1.6: Logout implementation
  if (authCode.includes("method: 'DELETE'") || authCode.includes('method: "DELETE"')) {
    auditPass('Logout Endpoint', 'Authentically issues DELETE /api/auth to clear session cookie');
  } else {
    auditViolation('Logout Endpoint', 'Missing DELETE method in logout implementation');
  }
}

// ----------------------------------------------------
// 2. Forensic Inspection: src/app/login/page.tsx
// ----------------------------------------------------
console.log('\n🔍 [CHECK 2] Forensic Analysis of src/app/login/page.tsx...');

if (!fs.existsSync(loginPagePath)) {
  auditViolation('login/page.tsx Existence', 'File does not exist');
} else {
  const loginCode = fs.readFileSync(loginPagePath, 'utf8');

  // Check 2.1: MVC Purity - Zero direct fetch
  const directFetchInView = /(?<!import.*)\bfetch\s*\(/g.test(loginCode);
  if (!directFetchInView) {
    auditPass('MVC View Purity', 'Zero direct fetch() calls inside UI component');
  } else {
    auditViolation('MVC View Purity', 'Direct fetch() call detected in login/page.tsx');
  }

  // Check 2.2: Hook Consumption
  if (loginCode.includes("import { useAuth } from '@/hooks/useAuth'") || loginCode.includes('import { useAuth } from "@/hooks/useAuth"')) {
    auditPass('Hook Integration', 'Properly imports and integrates useAuth hook');
  } else {
    auditViolation('Hook Integration', 'useAuth hook import missing');
  }

  // Check 2.3: Form handling
  if (loginCode.includes('login(username, password)')) {
    auditPass('Form Submission Delegation', 'Delegates credentials verification to useAuth.login()');
  } else {
    auditViolation('Form Submission Delegation', 'Missing login delegation call');
  }

  // Check 2.4: UI state bindings
  if (loginCode.includes('disabled={isLoading}') && loginCode.includes('{error &&')) {
    auditPass('UI State Bindings', 'Properly binds isLoading (button disabled/text) and error display');
  } else {
    auditViolation('UI State Bindings', 'Missing UI bindings for loading and error states');
  }
}

// ----------------------------------------------------
// 3. Gatekeeper Script Integrity & Anti-Weakening Check
// ----------------------------------------------------
console.log('\n🔍 [CHECK 3] Verifying Gatekeeper Scripts Integrity...');

const harnessCode = fs.readFileSync(runHarnessPath, 'utf8');
const diagCode = fs.readFileSync(diagnoseTargetsPath, 'utf8');

// Check 3.1: Harness checks all sheets
const requiredSheets = ['TASKS', 'BUDGET_CATEGORIES', 'BUDGET_ENTRIES', 'PROJECTS'];
const sheetsPresent = requiredSheets.every(s => harnessCode.includes(`'${s}'`));
if (sheetsPresent) {
  auditPass('Harness Schema Scope', 'All core database sheets are validated');
} else {
  auditViolation('Harness Schema Scope', 'Missing sheet validation in run-harness.js');
}

// Check 3.2: Harness fails on validation errors
if (harnessCode.includes('process.exit(1)') && harnessCode.includes('failedCount')) {
  auditPass('Harness Exit Strictness', 'Harness terminates with non-zero exit code on failures');
} else {
  auditViolation('Harness Exit Strictness', 'Harness exit code bypass detected');
}

// Check 3.3: Diagnostics MVC check
if (diagCode.includes('Direct API fetch detected inside UI component')) {
  auditPass('Diagnostics MVC Gatekeeper', 'Architectural MVC ontology check is active and unweakened');
} else {
  auditViolation('Diagnostics MVC Gatekeeper', 'MVC architecture rule removed from diagnose-targets.js');
}

// ----------------------------------------------------
// Summary
// ----------------------------------------------------
console.log('\n====================================================');
console.log(`📊 AUDIT SUMMARY: ${passes} Clean Checks, ${violations} Violations`);
console.log(`⚖️  FINAL VERDICT: ${violations === 0 ? 'CLEAN' : 'INTEGRITY VIOLATION'}`);
console.log('====================================================');

process.exit(violations === 0 ? 0 : 1);
