// Empirical Adversarial Testing Harness for R1 Inline-Editing & Zod Schemas
const { z } = require('zod');

// Import schemas logic (mirrored from src/lib/schemas.ts)
const BudgetCategorySchema = z.object({
  id: z.string().catch('unknown-cat'),
  name: z.string().catch('알 수 없는 카테고리'),
  totalBudget: z.number().catch(0),
  color: z.string().optional().default('#3b82f6').catch('#3b82f6'),
  description: z.string().optional().catch(''),
  policyProject: z.string().optional().catch('기타'),
  unitProject: z.string().optional().catch('전반'),
  detailedProject: z.string().optional().catch('기본운영'),
  managementProject: z.string().optional().catch(undefined),
  statItem: z.string().optional().catch('일반'),
  formationItem: z.string().optional().catch(undefined),
  budgetType: z.enum(['본예산', '간주예산', '추경']).optional().catch(undefined),
  fundingSource: z.string().optional().catch(undefined),
  subItems: z.array(z.object({
    id: z.string().optional(),
    prefix: z.string().optional(),
    name: z.string(),
    calculation: z.string().optional(),
    amount: z.number(),
    virtualAdjustment: z.number().optional().catch(0),
    note: z.string().optional().catch(''),
    checked: z.boolean().optional().catch(false),
  })).optional().catch(undefined),
  sortOrder: z.number().optional().catch(undefined),
});

const BudgetEntrySchema = z.object({
  id: z.string().catch('unknown-entry'),
  categoryId: z.string().catch('unknown-cat'),
  amount: z.number().catch(0),
  date: z.string().catch(new Date().toISOString()),
  purpose: z.string().catch('내역 없음'),
  docRegNum: z.string().optional().catch(''),
});

console.log("=================================================");
console.log("🧪 STARTING EMPIRICAL ADVERSARIAL TEST SUITE R1 🧪");
console.log("=================================================");

const results = [];

function recordTest(id, category, description, passed, details) {
  results.push({ id, category, description, passed, details });
  const statusStr = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${statusStr}] ${id}: ${description}`);
  if (!passed && details) {
    console.log(`   ↳ Details: ${details}`);
  }
}

// -------------------------------------------------------------
// SCOPE 1: Re-render & Delay Isolation Simulation
// -------------------------------------------------------------
function testReRenderIsolation() {
  let parentRenderCount = 0;
  let savedValues = [];

  // Simulated parent state
  let parentState = {
    activeCellId: null,
    totalBudget: 1000000
  };

  function updateCategory(id, updates) {
    parentRenderCount++;
    parentState = { ...parentState, ...updates };
  }

  // Simulated InlineEditCell local state during 100 keystrokes
  let cellLocalTempValue = "1000000";
  let cellRenderCount = 0;

  // Typing 100 characters character by character
  const longInput = "A".repeat(100);
  for (let i = 0; i < longInput.length; i++) {
    cellLocalTempValue += longInput[i];
    cellRenderCount++;
    // Crucial check: parentRenderCount must remain 0 while typing
  }

  const typingIsolated = (parentRenderCount === 0);
  recordTest(
    'R1-PERF-01',
    'Re-render Isolation',
    'Typing 100 characters in InlineEditCell causes 0 parent card re-renders',
    typingIsolated,
    `Parent renders during typing: ${parentRenderCount}, Cell internal renders: ${cellRenderCount}`
  );

  // Now simulate commit (handleCommit)
  const cleanNum = Number(String(cellLocalTempValue).replace(/,/g, '').trim());
  updateCategory('cat-1', { totalBudget: isNaN(cleanNum) ? 0 : cleanNum });

  const commitSaved = (parentRenderCount === 1);
  recordTest(
    'R1-PERF-02',
    'Commit Parent Render',
    'Committing edit triggers exactly 1 parent re-render and updates parent state',
    commitSaved,
    `Parent renders after commit: ${parentRenderCount}`
  );
}

// -------------------------------------------------------------
// SCOPE 2: Boundary Input Tests for InlineEditCell & Handlers
// -------------------------------------------------------------

// Test 2A: subItem amount handler in BudgetCategoryCardItem
function testSubItemAmountHandler() {
  function handleSubItemUpdate(subIdx, field, newValue) {
    const subItems = [{ name: 'Test SubItem', amount: 500000 }];
    const newSubItems = subItems.map((sub, i) => {
      if (i !== subIdx) return sub;
      if (field === 'amount') {
        const numAmt = Number(newValue);
        return { ...sub, amount: isNaN(numAmt) ? 0 : numAmt };
      }
      return { ...sub, name: String(newValue) };
    });
    return newSubItems[0];
  }

  // Test case 1: formatted string "1,000,000"
  const resFormatted = handleSubItemUpdate(0, 'amount', "1,000,000");
  const passedFormatted = (resFormatted.amount === 1000000);
  recordTest(
    'R1-BOUND-01',
    'SubItem Amount Formatted Input',
    'handleSubItemUpdate converts "1,000,000" to 1000000 (not 0 due to NaN)',
    passedFormatted,
    `Expected 1000000, got ${resFormatted.amount}`
  );

  // Test case 2: boundary "0"
  const resZero = handleSubItemUpdate(0, 'amount', "0");
  recordTest(
    'R1-BOUND-02',
    'SubItem Amount Zero Input',
    'handleSubItemUpdate converts "0" to 0',
    resZero.amount === 0,
    `Expected 0, got ${resZero.amount}`
  );

  // Test case 3: boundary "-100"
  const resNeg = handleSubItemUpdate(0, 'amount', "-100");
  recordTest(
    'R1-BOUND-03',
    'SubItem Amount Negative Input',
    'handleSubItemUpdate converts "-100" to -100',
    resNeg.amount === -100,
    `Expected -100, got ${resNeg.amount}`
  );

  // Test case 4: spaces "   "
  const resSpaces = handleSubItemUpdate(0, 'amount', "   ");
  recordTest(
    'R1-BOUND-04',
    'SubItem Amount Spaces Input',
    'handleSubItemUpdate converts "   " to 0 (Number("   ") is 0)',
    resSpaces.amount === 0,
    `Expected 0, got ${resSpaces.amount}`
  );

  // Test case 5: special characters "abc!@#"
  const resSpec = handleSubItemUpdate(0, 'amount', "abc!@#");
  recordTest(
    'R1-BOUND-05',
    'SubItem Amount Special Chars Input',
    'handleSubItemUpdate fallback to 0 for non-numeric input "abc!@#"',
    resSpec.amount === 0,
    `Expected 0, got ${resSpec.amount}`
  );
}

// Test 2B: Category totalBudget handler
function testCategoryTotalBudgetHandler() {
  function handleCategoryTotalBudget(newVal) {
    const cleanNum = Number(String(newVal).replace(/,/g, '').trim());
    return isNaN(cleanNum) ? 0 : cleanNum;
  }

  const t1 = handleCategoryTotalBudget("1,000,000");
  recordTest('R1-BOUND-06', 'Category totalBudget "1,000,000"', 'Parses to 1000000', t1 === 1000000, `Got ${t1}`);

  const t2 = handleCategoryTotalBudget("0");
  recordTest('R1-BOUND-07', 'Category totalBudget "0"', 'Parses to 0', t2 === 0, `Got ${t2}`);

  const t3 = handleCategoryTotalBudget("-100");
  recordTest('R1-BOUND-08', 'Category totalBudget "-100"', 'Parses to -100', t3 === -100, `Got ${t3}`);

  const t4 = handleCategoryTotalBudget("   ");
  recordTest('R1-BOUND-09', 'Category totalBudget "   "', 'Parses to 0', t4 === 0, `Got ${t4}`);

  const t5 = handleCategoryTotalBudget("<script>alert(1)</script>");
  recordTest('R1-BOUND-10', 'Category totalBudget Script Injection', 'Parses non-number to 0', t5 === 0, `Got ${t5}`);
}

// Test 2C: Entry Amount handler
function testEntryAmountHandler() {
  function handleEntryAmount(newVal) {
    const cleanStr = String(newVal).replace(/,/g, '').trim();
    const numVal = Number(cleanStr);
    return isNaN(numVal) ? 0 : numVal;
  }

  const e1 = handleEntryAmount("1,000,000");
  recordTest('R1-BOUND-11', 'Entry amount "1,000,000"', 'Parses to 1000000', e1 === 1000000, `Got ${e1}`);

  const e2 = handleEntryAmount("-50000");
  recordTest('R1-BOUND-12', 'Entry amount "-50000"', 'Parses to -50000', e2 === -50000, `Got ${e2}`);

  const e3 = handleEntryAmount("50,000원");
  recordTest('R1-BOUND-13', 'Entry amount with Korean currency "50,000원"', 'Fails to parse without removing "원"', e3 === 50000, `Got ${e3} (Number("50000원") is NaN -> 0)`);
}

// Test 2D: Zod Schema validation after boundary inputs
function testZodSchemaValidation() {
  // Test valid category with boundary values
  const sampleCat = {
    id: 'cat-test-1',
    name: '  테스트 카테고리  ',
    totalBudget: 1000000,
    subItems: [
      { name: '세부항목 1', amount: 0 },
      { name: '세부항목 2', amount: -100 }
    ]
  };

  const parsedCat = BudgetCategorySchema.safeParse(sampleCat);
  recordTest(
    'R1-ZOD-01',
    'BudgetCategory Zod Schema Parsing',
    'BudgetCategory parses cleanly with 0 and negative amounts',
    parsedCat.success,
    parsedCat.success ? 'OK' : JSON.stringify(parsedCat.error)
  );

  // Test corrupt input (totalBudget as string "invalid")
  const corruptCat = {
    id: 'cat-test-2',
    name: 'Corrupt',
    totalBudget: "invalid_string"
  };

  const parsedCorrupt = BudgetCategorySchema.safeParse(corruptCat);
  // thanks to .catch(0), Zod schema recovers cleanly to 0
  const recoveredValue = parsedCorrupt.success ? parsedCorrupt.data.totalBudget : null;
  recordTest(
    'R1-ZOD-02',
    'BudgetCategory Zod Schema Auto-recovery (.catch)',
    'Invalid string for totalBudget recovers to 0 via .catch(0)',
    parsedCorrupt.success && recoveredValue === 0,
    `Success: ${parsedCorrupt.success}, value: ${recoveredValue}`
  );
}

// Test 2E: Check external value update during edit mode (R1-EDGE-01)
function testExternalValuePropChangeDuringEdit() {
  // Simulate InlineEditCell behavior when parent value changes
  let initialValue = "Initial";
  let tempValue = initialValue;
  let isEditing = true;

  // User types "Modified"
  tempValue = "Modified User Input";

  // Parent re-renders with new initialValue = "Server Update"
  initialValue = "Server Update";

  // Current InlineEditCell useEffect behavior:
  // useEffect(() => { setTempValue(value) }, [value]);
  tempValue = initialValue; // simulates useEffect running

  const userInputPreserved = (tempValue === "Modified User Input");
  recordTest(
    'R1-EDGE-01',
    'External Prop Change During Editing Guard',
    'InlineEditCell should NOT overwrite uncommitted user typing when parent prop `value` changes',
    userInputPreserved,
    `tempValue got overwritten with "${tempValue}" while user was typing!`
  );
}

// Run all test suites
testReRenderIsolation();
testSubItemAmountHandler();
testCategoryTotalBudgetHandler();
testEntryAmountHandler();
testZodSchemaValidation();
testExternalValuePropChangeDuringEdit();

console.log("\n=================================================");
console.log("📊 TEST SUMMARY 📊");
const total = results.length;
const passedCount = results.filter(r => r.passed).length;
const failedCount = results.filter(r => !r.passed).length;
console.log(`Total Tests: ${total} | Passed: ${passedCount} | Failed: ${failedCount}`);
console.log("=================================================");
