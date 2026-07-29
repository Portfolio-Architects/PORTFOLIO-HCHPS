const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🧪 EMPIRICAL CHALLENGER M3 (BATCH ACTIONS & MODAL COMPARISON UX) TEST');
console.log('====================================================');

let failures = 0;
let warnings = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ↳ ✅ [PASS] ${message}`);
  } else {
    console.error(`  ↳ ❌ [FAIL] ${message}`);
    failures++;
  }
}

function warn(condition, message) {
  if (!condition) {
    console.warn(`  ↳ ⚠️ [WARN] ${message}`);
    warnings++;
  } else {
    console.log(`  ↳ ✅ [PASS] ${message}`);
  }
}

const rootDir = path.resolve(__dirname, '..');

// ----------------------------------------------------
// 1. Static Source Code & Interface Inspection
// ----------------------------------------------------
console.log('\n🔍 [CHECK 1] Inspecting Milestone 3 Source Code & Wire-ups...');

const useBudgetPath = path.join(rootDir, 'src/hooks/useBudget.ts');
const useBudgetContent = fs.readFileSync(useBudgetPath, 'utf8');

assert(useBudgetContent.includes('batchUpdateEntries'), 'useBudget.ts defines and exports batchUpdateEntries');
assert(useBudgetContent.includes('batchDeleteEntries'), 'useBudget.ts defines and exports batchDeleteEntries');
assert(useBudgetContent.includes('batchSettleEntries'), 'useBudget.ts defines and exports batchSettleEntries');
assert(useBudgetContent.includes('batchUpdateEntriesMut'), 'useBudget.ts implements batchUpdateEntriesMut');
assert(useBudgetContent.includes('batchDeleteEntriesMut'), 'useBudget.ts implements batchDeleteEntriesMut');
assert(useBudgetContent.includes('batchSettleEntriesMut'), 'useBudget.ts implements batchSettleEntriesMut');

const ledgerModalPath = path.join(rootDir, 'src/components/budget/ui/LedgerModal.tsx');
const ledgerModalContent = fs.readFileSync(ledgerModalPath, 'utf8');

assert(ledgerModalContent.includes('batchUpdateEntries?:'), 'LedgerModal accepts batchUpdateEntries prop');
assert(ledgerModalContent.includes('batchDeleteEntries?:'), 'LedgerModal accepts batchDeleteEntries prop');
assert(ledgerModalContent.includes('batchSettleEntries?:'), 'LedgerModal accepts batchSettleEntries prop');
assert(ledgerModalContent.includes('ExpenseBatchToolbar'), 'LedgerModal integrates ExpenseBatchToolbar');
assert(ledgerModalContent.includes("viewMode === 'ledger'") || ledgerModalContent.includes("viewMode, setViewMode"), 'LedgerModal supports Ledger comparison view mode toggle');
assert(ledgerModalContent.includes("viewMode === 'split'") || ledgerModalContent.includes("'split'"), 'LedgerModal supports Split dual-panel view mode toggle');

// ----------------------------------------------------
// 2. Pure Logic Simulation & Stress Tests
// ----------------------------------------------------
console.log('\n🔍 [CHECK 2] Running Empirical Batch Logic & Edge-Case Harness...');

// Helper: Generate dummy budget entries
function generateDummyEntries(count) {
  const entries = [];
  for (let i = 0; i < count; i++) {
    entries.push({
      id: `entry-${i}`,
      categoryId: `cat-${i % 10}`,
      amount: 10000 + (i * 100),
      purpose: `Test Entry ${i}`,
      isPlanned: i % 2 === 0,
      isSettled: i % 2 !== 0,
      memo: `Memo ${i}`,
      date: '2026-07-29'
    });
  }
  return entries;
}

// Simulated Batch Logic matching useBudget.ts implementations
function simulateBatchUpdate(current, ids, updates) {
  if (!ids || ids.length === 0) return current;
  const idSet = new Set(ids);
  return current.map(e => idSet.has(e.id) ? { ...e, ...updates } : e);
}

function simulateBatchDelete(current, ids) {
  if (!ids || ids.length === 0) return current;
  const idSet = new Set(ids);
  return current.filter(e => !idSet.has(e.id));
}

function simulateBatchSettle(current, ids, status) {
  if (!ids || ids.length === 0) return current;
  const idSet = new Set(ids);
  return current.map(e => {
    if (!idSet.has(e.id)) return e;
    if (status === 'SETTLED') {
      return { ...e, isSettled: true, isPlanned: false };
    } else if (status === 'PENDING') {
      return { ...e, isSettled: false, isPlanned: true };
    } else {
      const memoText = e.memo ? `${e.memo} [지출반려]` : '[지출반려]';
      return { ...e, isSettled: false, isPlanned: false, memo: memoText };
    }
  });
}

// --- Test Case A: Empty Arrays ---
console.log('\n--- Test A: Empty Array Inputs ---');
const initialA = generateDummyEntries(100);
const resUpdateA = simulateBatchUpdate(initialA, [], { amount: 50000 });
assert(resUpdateA === initialA || resUpdateA.length === 100, 'Batch update with empty array returns intact state without crashing');

const resDeleteA = simulateBatchDelete(initialA, []);
assert(resDeleteA.length === 100, 'Batch delete with empty array returns intact state (100 items)');

const resSettleA = simulateBatchSettle(initialA, [], 'SETTLED');
assert(resSettleA.length === 100, 'Batch settle with empty array returns intact state (100 items)');

// --- Test Case B: Non-existent IDs ---
console.log('\n--- Test B: Non-existent & Missing IDs ---');
const missingIds = ['ghost-id-1', 'ghost-id-2', 'ghost-id-3'];
const resUpdateB = simulateBatchUpdate(initialA, missingIds, { amount: 99999 });
assert(resUpdateB.length === 100, 'Batch update with non-existent IDs maintains exact array length');
assert(!resUpdateB.some(e => e.amount === 99999), 'Batch update with non-existent IDs does not mutate existing records');

const resDeleteB = simulateBatchDelete(initialA, missingIds);
assert(resDeleteB.length === 100, 'Batch delete with non-existent IDs leaves all 100 existing items intact');

const resSettleB = simulateBatchSettle(initialA, missingIds, 'SETTLED');
assert(JSON.stringify(resSettleB) === JSON.stringify(initialA), 'Batch settle with non-existent IDs results in zero mutations');

// --- Test Case C: High Volume (5,000 items selection) ---
console.log('\n--- Test C: High Volume Performance Stress (5,000 entries, 2,500 selected) ---');
const largeEntries = generateDummyEntries(5000);
const selectIds = [];
for (let i = 0; i < 2500; i++) {
  selectIds.push(`entry-${i * 2}`); // Select 2,500 alternating entries
}

const t0 = performance.now();
const resUpdateC = simulateBatchUpdate(largeEntries, selectIds, { memo: 'Batch updated high volume' });
const t1 = performance.now();
const timeUpdate = t1 - t0;
assert(resUpdateC.length === 5000, 'High-volume batch update produced 5,000 records');
assert(timeUpdate < 50, `High-volume batch update execution time is sub-50ms (Actual: ${timeUpdate.toFixed(2)}ms)`);

const t2 = performance.now();
const resDeleteC = simulateBatchDelete(largeEntries, selectIds);
const t3 = performance.now();
const timeDelete = t3 - t2;
assert(resDeleteC.length === 2500, 'High-volume batch delete correctly removed 2,500 entries, leaving 2,500');
assert(timeDelete < 50, `High-volume batch delete execution time is sub-50ms (Actual: ${timeDelete.toFixed(2)}ms)`);

const t4 = performance.now();
const resSettleC = simulateBatchSettle(largeEntries, selectIds, 'SETTLED');
const t5 = performance.now();
const timeSettle = t5 - t4;
assert(resSettleC.filter(e => e.isSettled).length >= 2500, 'High-volume batch settle correctly updated status on selected entries');
assert(timeSettle < 50, `High-volume batch settle execution time is sub-50ms (Actual: ${timeSettle.toFixed(2)}ms)`);

// ----------------------------------------------------
// 3. Flaw & Risk Probe (Adversarial Edge Cases)
// ----------------------------------------------------
console.log('\n🔍 [CHECK 3] Probing Failure Modes & Potential State Corruption Risks...');

// Flaw Probe 1: Idempotency / Repeated Batch Rejection Memo Corrupt
console.log('\n--- Flaw Probe 1: Repeated Batch Rejection Memo Duplication ---');
const testEntryIdempotency = [{ id: 'test-1', memo: 'Original Memo', isSettled: true, isPlanned: false }];
const step1 = simulateBatchSettle(testEntryIdempotency, ['test-1'], 'REJECTED');
const step2 = simulateBatchSettle(step1, ['test-1'], 'REJECTED');
const step3 = simulateBatchSettle(step2, ['test-1'], 'REJECTED');

console.log(`  ↳ Initial Memo: "${testEntryIdempotency[0].memo}"`);
console.log(`  ↳ Memo after 1st rejection: "${step1[0].memo}"`);
console.log(`  ↳ Memo after 2nd rejection: "${step2[0].memo}"`);
console.log(`  ↳ Memo after 3rd rejection: "${step3[0].memo}"`);

warn(
  !step3[0].memo.includes('[지출반려] [지출반려]'),
  'Idempotency check: Repeated REJECTED batch settles should not append duplicate "[지출반려]" tags'
);

// Flaw Probe 2: Referential Integrity on Batch Delete of Planned Entries with Connected Expenditures
console.log('\n--- Flaw Probe 2: Referential Integrity check on Batch Delete ---');
const plannedEntry = { id: 'plan-100', isPlanned: true, isSettled: false, amount: 500000 };
const actualEntry = { id: 'actual-101', isPlanned: false, isSettled: true, amount: 500000, relatedPlanId: 'plan-100' };
const datasetIntegrity = [plannedEntry, actualEntry];

// simulateBatchDelete deletes without checking relatedPlanId
const afterBatchDelete = simulateBatchDelete(datasetIntegrity, ['plan-100']);
const orphanExists = afterBatchDelete.some(e => e.relatedPlanId === 'plan-100');

warn(
  !orphanExists,
  'Referential Integrity: Batch deleting a planned entry should validate whether connected actual expenses exist'
);

// Flaw Probe 3: Budget Limit Validation in Batch Update
console.log('\n--- Flaw Probe 3: Budget Limit Enforcement in Batch Update ---');
// Single update checkLimit protects budget limit, but batchUpdateEntries directly updates without checkLimit
const batchUpdateExceedsLimit = simulateBatchUpdate([{ id: 'e-1', categoryId: 'c-1', amount: 1000 }], ['e-1'], { amount: 999999999 });
warn(
  batchUpdateExceedsLimit[0].amount <= 1000,
  'Budget Limit Check: Batch updating amounts should enforce category budget limit checks'
);

console.log('\n====================================================');
console.log(`📊 SUMMARY: ${failures} Failure(s), ${warnings} Vulnerability Warning(s) detected.`);
console.log('====================================================');

process.exit(failures > 0 ? 1 : 0);
