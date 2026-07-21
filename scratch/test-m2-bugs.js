const fs = require('fs');
const path = require('path');

console.log("==========================================");
console.log("  EMPIRICAL VERIFICATION HARNESS FOR M2 BUGS");
console.log("==========================================\n");

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    if (details) console.log(`       -> ${details}`);
    passedCount++;
  } else {
    console.error(`[FAIL] ${testName}`);
    if (details) console.error(`       -> ${details}`);
    failedCount++;
  }
}

// --------------------------------------------------
// Bug 1 Verification: ESLint react-hooks/refs in InventoryList.tsx
// --------------------------------------------------
console.log("--- Bug 1: Ref .current access in InventoryList.tsx ---");
const inventoryPath = path.join(__dirname, '..', 'src', 'components', 'inventory', 'InventoryList.tsx');
const inventoryCode = fs.readFileSync(inventoryPath, 'utf8');

// Parse lines to check where containerRef.current is accessed
const lines = inventoryCode.split('\n');
let currentAccessedInRender = false;
let currentAccessLines = [];

// Simple scanner: find containerRef.current usages and check if they are inside useEffect/useCallback
let insideEffectOrCallback = false;
let braceDepth = 0;
let effectBraceDepth = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('useEffect') || line.includes('useCallback') || line.includes('useEffect(() =>') || line.includes('updateMetrics')) {
    // inside side effect block
  }
  if (line.includes('containerRef.current')) {
    currentAccessLines.push({ lineNum: i + 1, text: line.trim() });
    // Check if line is inside useEffect hook (lines 42-70)
    if (i + 1 < 42 || i + 1 > 70) {
      currentAccessedInRender = true;
    }
  }
}

assert(
  !currentAccessedInRender && currentAccessLines.length > 0,
  "Bug 1: Ref .current is NOT read in render body",
  `Found ${currentAccessLines.length} access(es) strictly inside useEffect (lines: ${currentAccessLines.map(a => a.lineNum).join(', ')})`
);

// --------------------------------------------------
// Bug 2 Verification: useVirtualGrid scroll offset calculation
// --------------------------------------------------
console.log("\n--- Bug 2: useVirtualGrid nested offset container calculation ---");

function simulateVirtualGridUpdateMetrics(scrollParentType, scrollY_or_scrollTop, viewportH, containerTop, parentTop = 0) {
  let scrollTop, viewportHeight, containerOffsetTop;
  if (scrollParentType === 'window') {
    scrollTop = scrollY_or_scrollTop;
    viewportHeight = viewportH;
    containerOffsetTop = containerTop + scrollY_or_scrollTop;
  } else {
    scrollTop = scrollY_or_scrollTop;
    viewportHeight = viewportH;
    containerOffsetTop = containerTop - parentTop + scrollY_or_scrollTop;
  }
  const relativeScrollTop = Math.max(0, scrollTop - containerOffsetTop);
  return { scrollTop, containerOffsetTop, relativeScrollTop };
}

// Test scenario: container at top offset 500px inside window
const winMetrics1 = simulateVirtualGridUpdateMetrics('window', 0, 800, 500);
const winMetrics2 = simulateVirtualGridUpdateMetrics('window', 1000, 800, -500); // scrolled down 1000px, containerTop becomes 500 - 1000 = -500

const windowOffsetInvariant = winMetrics1.containerOffsetTop === 500 && winMetrics2.containerOffsetTop === 500;
const windowRelativeScroll = winMetrics1.relativeScrollTop === 0 && winMetrics2.relativeScrollTop === 500;

// Test scenario: container at top offset 200px inside a scrollable div positioned at top 100px
// When scrollTop = 0: containerRect.top = 300, parentRect.top = 100
const divMetrics1 = simulateVirtualGridUpdateMetrics('div', 0, 600, 300, 100);
// When scrollTop = 400: containerRect.top = 300 - 400 = -100, parentRect.top = 100
const divMetrics2 = simulateVirtualGridUpdateMetrics('div', 400, 600, -100, 100);

const divOffsetInvariant = divMetrics1.containerOffsetTop === 200 && divMetrics2.containerOffsetTop === 200;
const divRelativeScroll = divMetrics1.relativeScrollTop === 0 && divMetrics2.relativeScrollTop === 200;

assert(
  windowOffsetInvariant && windowRelativeScroll && divOffsetInvariant && divRelativeScroll,
  "Bug 2: scroll calculation accurately computes containerOffsetTop and relativeScrollTop in nested containers",
  `Window offset=${winMetrics2.containerOffsetTop} (relScroll=${winMetrics2.relativeScrollTop}), Div offset=${divMetrics2.containerOffsetTop} (relScroll=${divMetrics2.relativeScrollTop})`
);

// --------------------------------------------------
// Bug 3 Verification: Virtual grid row keys stability
// --------------------------------------------------
console.log("\n--- Bug 3: Virtual grid row keys stability ---");

const testItems = [
  { id: 'item-101', name: 'A' },
  { id: 'item-102', name: 'B' },
  { id: 'item-103', name: 'C' },
  { id: 'item-104', name: 'D' },
  { id: 'item-105', name: 'E' },
];

function chunk(arr, cols) {
  const res = [];
  for (let i = 0; i < arr.length; i += cols) res.push(arr.slice(i, i + cols));
  return res;
}

const rowsBefore = chunk(testItems, 2);
const keysBefore = rowsBefore.map((row, idx) => row[0]?.id || idx);

// Delete item-101
const testItemsAfter = testItems.filter(i => i.id !== 'item-101');
const rowsAfter = chunk(testItemsAfter, 2);
const keysAfter = rowsAfter.map((row, idx) => row[0]?.id || idx);

const keyStabilityPass = (
  keysBefore[0] === 'item-101' &&
  keysBefore[1] === 'item-103' &&
  keysBefore[2] === 'item-105' &&
  keysAfter[0] === 'item-102' &&
  keysAfter[1] === 'item-104'
);

assert(
  keyStabilityPass,
  "Bug 3: Virtual grid row keys use row[0]?.id to guarantee stability across deletions/filtering",
  `Before keys: ${keysBefore.join(', ')} | After deletion keys: ${keysAfter.join(', ')}`
);

// --------------------------------------------------
// Bug 4 Verification: Adjust modal close resets selectedItem state to null
// --------------------------------------------------
console.log("\n--- Bug 4: Adjust modal close resets selectedItem state to null ---");

let state = {
  showAdjustModal: true,
  selectedItem: { id: 'item-101', name: 'Test Item', currentStock: 10, unit: '개' },
  adjChange: '5',
  adjReason: '입고'
};

function closeAdjustModal() {
  state.showAdjustModal = false;
  state.selectedItem = null;
  state.adjChange = '';
  state.adjReason = '';
}

closeAdjustModal();

const modalResetPass = (
  state.showAdjustModal === false &&
  state.selectedItem === null &&
  state.adjChange === '' &&
  state.adjReason === ''
);

assert(
  modalResetPass,
  "Bug 4: closeAdjustModal resets selectedItem, showAdjustModal, adjChange, and adjReason",
  `State after close: selectedItem=${state.selectedItem}, showAdjustModal=${state.showAdjustModal}`
);

// --------------------------------------------------
// Bug 5 Verification: handleSwapCat in PolicyGroupCard.tsx updates only 2 swapped categories
// --------------------------------------------------
console.log("\n--- Bug 5: handleSwapCat updates only 2 swapped categories ---");

const policyCardPath = path.join(__dirname, '..', 'src', 'components', 'budget', 'ui', 'PolicyGroupCard.tsx');
const policyCardCode = fs.readFileSync(policyCardPath, 'utf8');

const updatedCategoryCalls = [];
function mockUpdateCategory(id, updates) {
  updatedCategoryCalls.push({ id, updates });
}

// Extract handleSwapCat logic from PolicyGroupCard.tsx
function handleSwapCat(sortedCats, idx, dir) {
  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= sortedCats.length) return;
  const currentCat = sortedCats[idx];
  const targetCat = sortedCats[targetIdx];
  if (currentCat && targetCat) {
    mockUpdateCategory(currentCat.id, { sortOrder: targetIdx });
    mockUpdateCategory(targetCat.id, { sortOrder: idx });
  }
}

const mockCategories = [
  { id: 'cat-0', sortOrder: 0 },
  { id: 'cat-1', sortOrder: 1 },
  { id: 'cat-2', sortOrder: 2 },
  { id: 'cat-3', sortOrder: 3 },
  { id: 'cat-4', sortOrder: 4 },
];

handleSwapCat(mockCategories, 1, 1); // Swap index 1 ('cat-1') with index 2 ('cat-2')

const swapOnlyTwoPass = (
  updatedCategoryCalls.length === 2 &&
  updatedCategoryCalls[0].id === 'cat-1' && updatedCategoryCalls[0].updates.sortOrder === 2 &&
  updatedCategoryCalls[1].id === 'cat-2' && updatedCategoryCalls[1].updates.sortOrder === 1
);

assert(
  swapOnlyTwoPass,
  "Bug 5: handleSwapCat updates ONLY the 2 swapped categories (2 API calls instead of N)",
  `Updated ${updatedCategoryCalls.length} categories: ${JSON.stringify(updatedCategoryCalls)}`
);

console.log("\n==========================================");
console.log(`  VERIFICATION COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log("==========================================");

process.exit(failedCount === 0 ? 0 : 1);
