# Handoff Report — Requirement R3: Expense Batch Action & Modal UX Optimization

## 1. Observation

Direct observations from examining the codebase:

1. **Expense Entry List & Checkbox State**:
   - `src/components/budget/ui/PolicyGroupCard.tsx` (lines 451–492): Entries are rendered sequentially without selection checkboxes:
     ```tsx
     <div key={entry.id} className="flex items-center text-[15px] group bg-white py-2.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors relative">
     ```
   - `src/types/index.ts` (line 96) & `src/lib/schemas.ts` (line 99): `checked?: boolean` property exists on `BudgetEntry` interface and Zod schema, but UI rendering lacks multi-select checkboxes.

2. **Batch Mutation & Modal Capability**:
   - `src/components/budget/ui/BatchEditModal.tsx` (lines 15–121): Operates solely on `BudgetCategory[]` for `budgetType` and `fundingSplits`.
   - `src/hooks/useBudget.ts` (lines 153–183): Only single-item mutations (`updateEntryMut`, `deleteEntryMut`) are exposed. `replaceEntriesMut` (lines 185–196) exists for full array replacement, but no batch entry helper (`batchUpdateEntries`, `batchDeleteEntries`) is currently exported.

3. **Ledger Modal & Expense Entry Modal Operations**:
   - `src/components/budget/ui/LedgerModal.tsx` (lines 60–210): Renders full-width (4xl) modal with T-account comparison (Left: planned/issuance vs Right: settled actuals).
   - `src/components/budget/ui/ExpenseEntryModal.tsx` (lines 232–387): Single-entry editing form with validation against budget limits and locked sub-items. Currently operates in isolation from `LedgerModal`.

4. **Category Highlight & Performance Calculations**:
   - `src/hooks/useBudget.ts` (lines 223–314): `categoryStatsMap` computes category usage, remaining balances, and daily expense stats in an $O(M)$ `useMemo` block.
   - Cache mutation in `onMutate` (lines 161–166) updates React Query cache synchronously, which automatically re-triggers `categoryStatsMap` recalculation without UI lag.

---

## 2. Logic Chain

1. **From Observation 1**: Because `BudgetEntry` already contains `checked?: boolean` in its type and Zod schema, adding a selection checkbox to entry rows in `PolicyGroupCard.tsx`, `BudgetCategoryCardItem.tsx`, and `LedgerModal.tsx` will not require schema changes. A bottom sticky toolbar in `BudgetDashboard.tsx` can manage `selectedEntryIds` state and trigger multi-item actions.
2. **From Observation 2**: Calling single-item `updateEntry` or `deleteEntry` in a loop creates multiple state dispatches and disk write race conditions. Implementing `batchUpdateEntries` and `batchDeleteEntries` using a single React Query `setQueryData` call inside `useBudget.ts` guarantees atomic state transitions and zero UI lag.
3. **From Observation 3**: To eliminate context switching between `LedgerModal` and `ExpenseEntryModal`, `LedgerModal` can feature a toggleable `split` view mode where selecting an entry on the left T-account pane opens an embedded side-by-side entry inspector/editor pane on the right.
4. **From Observation 4**: Because `categoryStatsMap` is reactively derived from `entries` in `useBudget.ts`, updating `['BUDGET_ENTRIES']` atomically in React Query cache will immediately update category stats, progress bars, and risk alerts without lag or Zod schema errors (`[HARNESS ZOD ERROR]`).

---

## 3. Caveats

- **Limit Validation in Batch Operations**: When batch updating amounts or categories, individual entry budget limit checks (`checkLimit`) should be evaluated for each entry in the batch to avoid accidentally exceeding category or sub-item caps.
- **Settlement Dependencies**: When batch deleting planned entries (`isPlanned: true`), entries with linked settled actuals (`relatedPlanId`) must be skipped or flagged with a warning to preserve relational integrity.

---

## 4. Conclusion

Requirement R3 can be effectively implemented by:
1. Adding entry checkboxes and a bottom sticky batch action toolbar to `BudgetDashboard.tsx` and `PolicyGroupCard.tsx`.
2. Exporting atomic batch helpers (`batchUpdateEntries`, `batchDeleteEntries`) in `useBudget.ts`.
3. Enhancing `BatchEditModal.tsx` / creating entry batch edit capabilities for batch approval, batch status change, and batch deletion.
4. Implementing a side-by-side split view mode in `LedgerModal.tsx` for seamless T-account cross-verification and entry editing.

---

## 5. Verification Method

To verify implementation accuracy and zero-stall compliance:

1. **TypeScript Type Checking**:
   ```bash
   npx tsc --noEmit
   ```
   Must return 0 errors.

2. **Harness & Zod Schema Verification**:
   ```bash
   node scripts/run-harness.js
   ```
   Must pass with 0 Zod errors and 0 ESLint warnings/errors.

3. **UI Verification**:
   - Select multiple expense items in `PolicyGroupCard.tsx` or `LedgerModal.tsx`.
   - Verify bottom sticky batch toolbar appears showing selected item count.
   - Execute batch approval / status edit / batch delete.
   - Confirm category stats and remaining balances update instantaneously (~0ms stall).
   - In `LedgerModal.tsx`, toggle to split view mode and verify side-by-side T-account and entry inspector panel functionality.
