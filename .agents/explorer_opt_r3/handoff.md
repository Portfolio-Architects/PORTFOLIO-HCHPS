# Handoff Report — Requirement R3 (Expense Batch Action & Modal UX Optimization)

**Agent**: Explorer 3  
**Working Directory**: `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_opt_r3`  
**Target Requirement**: R3 (Expense Batch Action & Modal UX Optimization)  
**Date**: 2026-07-29  

---

## 1. Observation

### 1.1 Existing Component Structure & Gaps
- **`src/components/budget/BudgetDashboard.tsx`**:
  - Defines modal states for category creation (`showCatModal`), expense entry (`showEntryModal`), batch category edit (`showBatchModal`), ledger T-account (`showLedgerModal`), and daily expense stats (`showDailyStatModal`).
  - Lines 113-133: `handleSettleEntry` handles settlement for a single planned entry (`plannedEntryId`), updating the planned entry and calling `addEntry` for the actual settled entry.
  - Lacks selection state management (`selectedEntryIds`) for expense entries (`BudgetEntry`).
- **`src/components/budget/ui/PolicyGroupCard.tsx`**:
  - Lines 455-492: Expense entries inside policy groups are rendered as individual rows with single-item edit (`openEditEntry(entry)`) and delete (`deleteEntry(entry.id)`) handlers. No checkboxes or batch selection handlers exist.
- **`src/components/budget/ui/BudgetCategoryCardItem.tsx`**:
  - Lines 291-304 (`generalEntries`) & lines 325-339 (`dailyExpenseEntries`): Entries are listed with click-to-edit handlers (`onEditEntry(e)`). No multi-selection exists.
- **`src/components/budget/ui/LedgerModal.tsx`**:
  - Lines 125-164: T-account left side renders planned entries with inline settlement button (`settlingId === e.id`). Settlement is limited to 1 entry at a time.
  - Lacks integration/toggle mode to jump to `ExpenseEntryModal` or view split dual-panel comparison.
- **`src/components/budget/ui/BatchEditModal.tsx`**:
  - Lines 15-44: Supports batch edit for `BudgetCategory` objects (`budgetType` and `fundingSplits`). Does NOT support batch actions for `BudgetEntry` objects.

### 1.2 `useBudget` Custom Hook Mutations (`src/hooks/useBudget.ts`)
- Lines 153-183: `updateEntryMut` and `deleteEntryMut` operate on a single entry ID at a time via `updateRow` and `deleteRow`.
- Lines 185-196: `replaceEntriesMut` provides full list replacement via `replaceAll('BUDGET_ENTRIES', newEntries)`.
- No batch helper functions (`batchUpdateEntries`, `batchSettleEntries`, `batchDeleteEntries`) currently exist in `useBudget.ts`. Calling `updateEntry` or `deleteEntry` in a loop causes $N$ sequential API requests and query refetches.

---

## 2. Logic Chain

1. **Premise 1**: Users need to perform batch actions (batch approval/settlement, status change, deletion) on multiple expense items simultaneously to streamline financial operations.
2. **Observation 1**: Currently, no selection state (`selectedEntryIds`) or row checkboxes exist in `PolicyGroupCard.tsx`, `BudgetCategoryCardItem.tsx`, or `LedgerModal.tsx`.
3. **Deduction 1**: Multi-selection state management (`selectedEntryIds: Set<string>`) and row/header checkboxes must be introduced across all expense entry views, along with a floating `ExpenseBatchToolbar` component.
4. **Observation 2**: `useBudget.ts` only exposes single-item mutations (`updateEntry`, `deleteEntry`). Sequential loops over these single-item mutations trigger $N$ REST API calls and disk writes, violating the 60ms debounce storage rule and causing UI frame drops (>100ms Long Task stall).
5. **Deduction 2**: `useBudget.ts` must be extended with `batchUpdateEntries`, `batchSettleEntries`, and `batchDeleteEntries` that use `replaceAll('BUDGET_ENTRIES', ...)` and an atomic TanStack Query `onMutate` cache write (`queryClient.setQueryData`).
6. **Observation 3**: `categoryStatsMap` in `useBudget.ts` derives directly from `entries` in an $O(M)$ `useMemo` block.
7. **Deduction 3**: By updating `['BUDGET_ENTRIES']` in a single atomic cache write, `categoryStatsMap` recalculates in a single animation frame (0ms UI lag), immediately updating category usage bars and remaining balances.
8. **Observation 4**: `LedgerModal.tsx` and `ExpenseEntryModal.tsx` operate as disconnected modals. Users cannot inspect or edit entries directly from `LedgerModal`.
9. **Deduction 4**: Implementing cross-modal navigation (`returnToLedger` state stack) and a Dual-Panel Split View toggle inside `LedgerModal` will allow seamless comparison and editing without losing modal context.

---

## 3. Caveats

1. **Commitment Accounting Constraints**:
   - When batch deleting planned entries (`isPlanned: true`), the system must verify whether any settled actual entries reference them (`relatedPlanId === entry.id`). Dependent items must be blocked from deletion with an alert dialog.
2. **Budget Limit Validation in Batch Operations**:
   - When batch updating entry amounts or action types, total usage must be checked against `checkLimit`. If a batch update causes a category to exceed its total budget or daily expense limit, the batch action must fail gracefully and report the offending entry.
3. **Filter Dependency**:
   - Multi-selection should handle filtered views appropriately (e.g. "Select All" should select only visible/filtered entries, not entries hidden by filters).

---

## 4. Conclusion

Requirement R3 can be completely fulfilled by making targeted, non-breaking enhancements across 4 primary architectural layers:

1. **`src/hooks/useBudget.ts`**: Add `batchUpdateEntries`, `batchSettleEntries`, and `batchDeleteEntries` using atomic TanStack Query cache updates.
2. **Expense Multi-Selection & Toolbar**: Implement `selectedEntryIds` state, row/header checkboxes, and a floating `ExpenseBatchToolbar` component in `BudgetDashboard.tsx` and child list components.
3. **Modal Navigation & Dual-Panel View**: Upgrade `LedgerModal.tsx` with a Dual-Panel Split View toggle and cross-modal editing link to `ExpenseEntryModal.tsx`.
4. **Optimistic Visual Feedback**: Implement transient `highlightedCategoryIds` state with CSS glow effects to visually indicate updated categories after batch operations.

---

## 5. Verification Method

To independently verify the implementation:

1. **TypeScript Static Analysis**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected Result*: 0 errors.

2. **Harness & Rule Verification**:
   ```bash
   node scripts/run-harness.js
   ```
   *Expected Result*: 0 Zod schema errors, 0 ESLint warnings, 0 MVC violations.

3. **Manual Functional Checklist**:
   - Select multiple planned entries (`isPlanned: true`) in `LedgerModal` or `PolicyGroupCard` -> Click "Batch Settle" -> Verify entries transition to settled status and category balance badges update instantly without page reload.
   - Select multiple entries -> Click "Batch Delete" -> Verify single atomic deletion.
   - Open `LedgerModal` -> Toggle Dual-Panel Split View -> Click an entry to view/edit in right inspector -> Confirm changes reflect in left T-account view.
