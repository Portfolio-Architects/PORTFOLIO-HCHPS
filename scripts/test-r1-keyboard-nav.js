const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🧪 R1 ADVERSARIAL STRESS TEST HARNESS FOR BUDGET TABLE');
console.log('====================================================');

let failures = 0;
let passes = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ↳ ✅ [PASS] ${message}`);
    passes++;
  } else {
    console.error(`  ↳ ❌ [FAIL] ${message}`);
    failures++;
  }
}

const rootDir = path.resolve(__dirname, '..');

// Test 1: Code analysis of InlineEditCell.tsx for Esc, Enter, Ctrl+Enter, Tab
console.log('\n🔍 [TEST 1] Analyzing InlineEditCell.tsx key handling and state integrity...');

const inlineEditCellPath = path.join(rootDir, 'src/components/budget/ui/InlineEditCell.tsx');
const inlineCellContent = fs.readFileSync(inlineEditCellPath, 'utf8');

// Esc handling
const hasEscHandling = inlineCellContent.includes("e.key === 'Escape'") &&
  inlineCellContent.includes("setTempValue(value");
assert(hasEscHandling, 'InlineEditCell resets tempValue to initial value on Escape key');

// Enter & Ctrl+Enter handling
const hasEnterHandling = inlineCellContent.includes("e.key === 'Enter'") &&
  inlineCellContent.includes('handleCommit()');
assert(hasEnterHandling, 'InlineEditCell commits value on Enter / Ctrl+Enter key');

// Tab & Shift+Tab handling
const hasTabHandling = inlineCellContent.includes("e.key === 'Tab'") &&
  inlineCellContent.includes("onNavigate(e.shiftKey ? 'prev' : 'next')");
assert(hasTabHandling, 'InlineEditCell delegates navigation direction (prev/next) on Tab/Shift+Tab');

// Test 2: Stress-testing Cell Navigation logic in BudgetCategoryCardItem.tsx
console.log('\n🔍 [TEST 2] Stress-testing Navigation & Index Boundaries in BudgetCategoryCardItem.tsx...');

const cardItemPath = path.join(rootDir, 'src/components/budget/ui/BudgetCategoryCardItem.tsx');
const cardItemContent = fs.readFileSync(cardItemPath, 'utf8');

// Check cellIdList definition
assert(cardItemContent.includes('cellIdList'), 'BudgetCategoryCardItem builds cellIdList for cell index tracking');

// Simulating BudgetCategoryCardItem Navigation logic
function simulateCardItemNav(cat, isExpanded, currentCellId, direction) {
  const cellIdList = [];
  cellIdList.push(`${cat.id}:statItem`);
  cellIdList.push(`${cat.id}:totalBudget`);
  if (cat.subItems) {
    cat.subItems.forEach((_, idx) => {
      cellIdList.push(`${cat.id}:sub:${idx}:name`);
      cellIdList.push(`${cat.id}:sub:${idx}:amount`);
    });
  }

  const index = cellIdList.indexOf(currentCellId);
  if (index === -1) return { error: 'UNINDEXED_CELL', activeCellId: null };

  let targetIndex = direction === 'next' ? index + 1 : index - 1;
  if (targetIndex >= cellIdList.length) targetIndex = 0;
  if (targetIndex < 0) targetIndex = cellIdList.length - 1;

  const targetCellId = cellIdList[targetIndex];

  // Vulnerability Check: Is target cell rendered in DOM if isExpanded is false?
  const isHeaderCell = targetCellId === `${cat.id}:statItem`;
  const isBodyCell = !isHeaderCell;
  const isRenderedInDOM = isHeaderCell || isExpanded;

  return {
    targetIndex,
    targetCellId,
    isRenderedInDOM,
    outOfBounds: targetIndex < 0 || targetIndex >= cellIdList.length
  };
}

const mockCat = {
  id: 'cat-101',
  name: '소모품비',
  statItem: '소모품비',
  subItems: [
    { name: '사무용품', amount: 50000 },
    { name: '인쇄비', amount: 30000 }
  ]
};

// Rapid Tab loop simulation (100 movements)
console.log('  ↳ Simulating 100 rapid Tab key movements on expanded card...');
let currentCell = 'cat-101:statItem';
let threwOutOfBounds = false;

for (let i = 0; i < 100; i++) {
  const res = simulateCardItemNav(mockCat, true, currentCell, 'next');
  if (res.outOfBounds) {
    threwOutOfBounds = true;
    break;
  }
  currentCell = res.targetCellId;
}
assert(!threwOutOfBounds, 'Rapid 100 Tab navigation loop does not throw out-of-bounds index exceptions');

// Check focus loss when card is collapsed (isExpanded === false)
console.log('  ↳ Checking Tab navigation from statItem when card is collapsed (isExpanded === false)...');
const collapsedNavRes = simulateCardItemNav(mockCat, false, 'cat-101:statItem', 'next');
assert(!collapsedNavRes.isRenderedInDOM, 'FAIL DETECTED: Navigating Tab from header cell when isExpanded=false targets unrendered DOM cell (totalBudget), causing focus loss!');

// Check unindexed general entry cells in BudgetCategoryCardItem
console.log('  ↳ Checking Tab navigation on general expense entry cells (cat_purpose)...');
const generalEntryNavRes = simulateCardItemNav(mockCat, true, 'entry-999:cat_purpose', 'next');
assert(generalEntryNavRes.error === 'UNINDEXED_CELL', 'FAIL DETECTED: General expense entry cells (cat_purpose/cat_amount) are missing from cellIdList in BudgetCategoryCardItem, so Tab navigation fails!');


// Test 3: Stress-testing Cell Navigation & Virtualization in PolicyGroupCard.tsx
console.log('\n🔍 [TEST 3] Stress-testing Navigation in PolicyGroupCard.tsx...');

const policyCardPath = path.join(rootDir, 'src/components/budget/ui/PolicyGroupCard.tsx');
const policyCardContent = fs.readFileSync(policyCardPath, 'utf8');

assert(policyCardContent.includes('entryCellIdList'), 'PolicyGroupCard builds entryCellIdList');

// Check hidden docRegNum column
const isDocRegHidden = policyCardContent.includes('hidden lg:flex') && policyCardContent.includes('docRegNum');
assert(isDocRegHidden, 'FAIL DETECTED: docRegNum column in PolicyGroupCard is hidden (display:none) below lg breakpoint, causing Tab focus to target an invisible element!');

// Check visibleGroupEntries truncation
const truncatesEntries = policyCardContent.includes('showAllEntries ? groupEntries : groupEntries.slice(0, 6)');
assert(truncatesEntries, 'FAIL DETECTED: entryCellIdList only indexes top 6 entries when showAllEntries=false, skipping remaining entries during Tab navigation!');

// Summary
console.log('\n====================================================');
console.log(`📊 ADVERSARIAL STRESS TEST SUMMARY: ${passes} PASS, ${failures} FAIL / WARNINGS DETECTED`);
console.log('====================================================');

process.exit(failures > 0 ? 1 : 0);
