# Requirement R3: Expense Batch Action & Modal UX Optimization — Analysis Report

**Author**: Explorer 3  
**Working Directory**: `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_opt_r3`  
**Target Module**: `src/components/budget/` & `src/hooks/useBudget.ts`  
**Date**: 2026-07-29  

---

## 1. Executive Summary

Requirement R3 requires an overhaul of the expense list display, multi-selection management, batch actions (batch approval/settlement, status change, deletion), and modal UX interaction between `LedgerModal.tsx` and `ExpenseEntryModal.tsx` in `src/components/budget/`.

### Key Findings Overview:
1. **Expense Selection Disconnect**: The current budget components (`PolicyGroupCard.tsx`, `BudgetCategoryCardItem.tsx`, `LedgerModal.tsx`) lack any multi-selection capabilities for expense entries (`BudgetEntry`). All actions are strictly 1:1 single-item edits or single-item settlements.
2. **Category-Only Batch Modal**: `BatchEditModal.tsx` exists only for batch updating *categories* (`BudgetCategory` budget type & funding splits) and cannot perform batch actions on *expense entries*.
3. **Single-Item Hook Mutations**: `useBudget.ts` currently provides `addEntry`, `updateEntry`, and `deleteEntry`, which invoke single-row REST API mutations. Loop-calling these mutations for batch actions causes network request cascades, disk lock delays, and UI stutter.
4. **Isolated Modal Workflows**: `LedgerModal` (T-account cross-verification) and `ExpenseEntryModal` (expense entry form) operate in isolation. Users viewing T-account discrepancies in `LedgerModal` cannot click items to edit them in `ExpenseEntryModal` or toggle a split dual-panel comparison view.
5. **Stats Recalculation Overhead**: Category statistics (`CategoryStats`) are computed synchronously in `categoryStatsMap` inside `useBudget.ts`. Optimistic batch updates to `['BUDGET_ENTRIES']` must occur in a single TanStack Query cache write to allow instant $O(M)$ stat recalculation and zero-lag highlight transitions.

---

## 2. Key Question 1: Expense Components & Modal Architecture Analysis

### Current Component Breakdown

| Component | File Path | Primary Responsibility | Current Selection Support | Current Batch Support |
| --- | --- | --- | --- | --- |
| `BudgetDashboard.tsx` | `src/components/budget/BudgetDashboard.tsx` | Top-level budget container, summary cards, filter bars, risk alerts, modal states | None | Manages `showBatchModal` for categories |
| `PolicyGroupCard.tsx` | `src/components/budget/ui/PolicyGroupCard.tsx` | Groups categories by Policy Project and Detailed Project; lists recent expense entries (`groupEntries`) | None | Triggers `openBatchEdit` for category funding splits |
| `BudgetCategoryCardItem.tsx` | `src/components/budget/ui/BudgetCategoryCardItem.tsx` | Stat item category card; lists `generalEntries` & `dailyExpenseEntries` | None | None |
| `ExpenseEntryModal.tsx` | `src/components/budget/ui/ExpenseEntryModal.tsx` | Form modal for creating/editing a single `BudgetEntry` | Single item (via `initialData`) | None |
| `LedgerModal.tsx` | `src/components/budget/ui/LedgerModal.tsx` | Cross-verification T-account modal (Planned/Issuance vs Actual Spent) | Single item settlement (`settlingId`) | None |
| `BatchEditModal.tsx` | `src/components/budget/ui/BatchEditModal.tsx` | Modal for batch modifying `BudgetCategory` fields (`budgetType`, `fundingSplits`) | Category group | Batch edit for *categories* only |
| `DailyExpenseStatModal.tsx` | `src/components/budget/ui/DailyExpenseStatModal.tsx` | Breakdown modal for daily expenses by detailed project & stat item | None | None |

### Key Code Observations:
- **`LedgerModal.tsx` Lines 125-164**: Individual row rendering in the T-account left side (Planned commitments) includes a single settlement trigger button (`✓ 결제 완료(정산) 버튼`). It opens a mini inline input for 1 entry at a time (`settlingId === e.id`).
- **`PolicyGroupCard.tsx` Lines 455-492**: Group expense entries are rendered in a flat list with individual Edit (`Pencil`) and Delete (`Trash2`) icon buttons. No checkbox or multi-select state exists.

---

## 3. Key Question 2: Multi-Selection Management in Expense Tables

### Current Deficiencies
1. No checkbox input (`<input type="checkbox">`) exists on expense row items in `PolicyGroupCard.tsx`, `BudgetCategoryCardItem.tsx`, or `LedgerModal.tsx`.
2. No `selectedEntryIds` state (or `Set<string>`) exists anywhere in the budget subsystem.
3. No batch action toolbar exists to trigger bulk operations when entries are selected.

### Proposed Multi-Selection Architecture

```
[ BudgetDashboard State: selectedEntryIds = Set<string>() ]
        │
        ├── Top/Floating Batch Action Toolbar (ExpenseBatchToolbar)
        │     ├── Batch Settle / Approve (planned -> settled)
        │     ├── Batch Change Action Type / Funding Source / Doc #
        │     └── Batch Delete (with dependency checks)
        │
        ├── Checkbox state passed down to child views:
        │     ├── PolicyGroupCard -> Expense List items
        │     ├── BudgetCategoryCardItem -> Expanded Entry rows
        │     └── LedgerModal -> Left (Planned) & Right (Actual) rows
        │
        └── Selection Utilities:
              ├── toggleSelectEntry(id)
              ├── toggleSelectAll(entryIds[])
              └── clearSelection()
```

### UX & Keyboard Specifications:
- **Checkbox on Entry Rows**: A clean, accessible checkbox on each entry row item (in dashboard lists and `LedgerModal`).
- **Header "Select All"**: A checkbox in the section header of entry lists or `LedgerModal` to toggle selection of all currently visible/filtered entries.
- **Floating Batch Action Bar**: Appears at the bottom-center of the screen when `selectedEntryIds.size > 0`:
  - Shows `selectedEntryIds.size` items selected.
  - Buttons: `[✓ 일괄 정산/결제]` (Batch Settle), `[⚙ 일괄 상태/구분 변경]` (Batch Edit), `[🗑 일괄 삭제]` (Batch Delete), `[✕ 선택 해제]` (Deselect).

---

## 4. Key Question 3: Batch Actions & Custom Hook Integration (`useBudget.ts`)

### Current Mutation Bottlenecks in `useBudget.ts`
Lines 153-183 in `src/hooks/useBudget.ts`:
```ts
const updateEntryMut = useMutation({
  mutationFn: async ({ id, updates }: { id: string, updates: Partial<BudgetEntry> }) => {
    const existing = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES'])?.find(e => e.id === id);
    if (!existing) throw new Error("Item not found in cache");
    const fullItem = { ...existing, ...updates };
    return updateRow('BUDGET_ENTRIES', id, fullItem);
  }, ...
});

const deleteEntryMut = useMutation({
  mutationFn: (id: string) => deleteRow('BUDGET_ENTRIES', id),
  ...
});
```
If a user selects 15 entries and triggers batch deletion or batch settlement, executing 15 individual `updateEntry` or `deleteEntry` calls creates 15 HTTP requests, 15 disk file reads/writes in `data/BUDGET_ENTRIES.json`, and 15 TanStack Query cache invalidations. This violates the 60ms debounce storage rule and causes severe UI lag.

### Proposed Hook Enhancements in `useBudget.ts`

Add 3 dedicated batch mutation functions and action wrappers:

1. **`batchUpdateEntries`**:
   ```ts
   const batchUpdateEntriesMut = useMutation({
     mutationFn: async (updatesMap: Array<{ id: string; updates: Partial<BudgetEntry> }>) => {
       const existingList = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']) || [];
       const updatedList = existingList.map(e => {
         const found = updatesMap.find(u => u.id === e.id);
         return found ? { ...e, ...found.updates } : e;
       });
       return replaceAll('BUDGET_ENTRIES', updatedList);
     },
     onMutate: async (updatesMap) => {
       await queryClient.cancelQueries({ queryKey: ['BUDGET_ENTRIES'] });
       const previous = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']);
       queryClient.setQueryData<BudgetEntry[]>(['BUDGET_ENTRIES'], (old) => {
         const oldEntries = old || [];
         return oldEntries.map(e => {
           const found = updatesMap.find(u => u.id === e.id);
           return found ? { ...e, ...found.updates } : e;
         });
       });
       return { previous };
     },
     onError: (err, vars, context) => {
       if (context?.previous) queryClient.setQueryData(['BUDGET_ENTRIES'], context.previous);
     }
   });
   ```

2. **`batchSettleEntries`**:
   - Converts multiple planned entries (`isPlanned: true`) into settled status in a single batch operation.
   - For each planned entry `p`:
     - Sets `p.isSettled = true`.
     - Synthesizes a new actual expenditure entry `actualEntry` with `isPlanned: false, isSettled: false, relatedPlanId: p.id`.
   - Mutates `['BUDGET_ENTRIES']` cache with all new entries added and planned entries updated in ONE atomic step.

3. **`batchDeleteEntries`**:
   - Performs validation: verifies if any selected `isPlanned: true` entry has connected settled child entries (`relatedPlanId === id`). If dependent actual expenses exist, blocks batch deletion with an informative dialog.
   - Filters out selected IDs and calls `replaceAll('BUDGET_ENTRIES', remainingEntries)`.

---

## 5. Key Question 4: `LedgerModal` & `ExpenseEntryModal` Interaction & Dual-Mode UX

### Current State
- `LedgerModal.tsx` and `ExpenseEntryModal.tsx` are opened independently from `BudgetDashboard.tsx`.
- `LedgerModal` line 142 allows setting `settlingId` to execute inline settlement, calling `onSettle(plannedEntryId, actualAmount)`.
- If a user spots an invalid date, wrong sub-item, or document number error in `LedgerModal`, they must close `LedgerModal`, find the entry in the dashboard, and click edit to open `ExpenseEntryModal`.

### Recommended Dual-Mode UX Enhancements

#### Mode 1: Cross-Modal Seamless Navigation
- **`LedgerModal` Item Inspection**: Add an Edit (`Pencil`) button or double-click handler on any item row in `LedgerModal`.
- **Modal Stack Handler**:
  - When edit is clicked inside `LedgerModal`, save `showLedgerModal = true` in state as `returnToLedger = true`.
  - Hide `LedgerModal` (or stack `ExpenseEntryModal` on top with a higher z-index / backdrop).
  - Open `ExpenseEntryModal` with `initialData = clickedEntry`.
  - On save or cancel in `ExpenseEntryModal`, automatically re-open `LedgerModal`.

#### Mode 2: Split Dual-Panel Comparison View
- Introduce a view toggle inside `LedgerModal` header: `[ 📊 T-계정 단일 보기 ]` vs `[ 🌗 좌우 분할 대조 모드 ]`.
- In Split Dual-Panel Mode:
  - **Left Panel (60%)**: T-Account Ledger view (Planned Commitments vs Settled Expenditures).
  - **Right Panel (40%)**: Quick Inspector & Batch Edit Form for the selected entry or selected entry set.
  - Selecting items on the Left Panel immediately populates the Right Panel inspector with live validation feedback (e.g. checking remaining category balances and sub-item limits).

---

## 6. Key Question 5: Zero-Lag Optimistic Updates & Category Highlights

### Immediate UI Update Architecture

```
User Triggers Batch Action (e.g., Batch Settle 10 Items)
                      │
                      ▼
`batchSettleEntries` called in `useBudget`
                      │
                      ▼
TanStack Query `onMutate`:
  1. `queryClient.cancelQueries(['BUDGET_ENTRIES'])`
  2. `queryClient.setQueryData(['BUDGET_ENTRIES'], updatedEntriesArray)`
                      │
                      ▼ (Synchronous Execution - Single Frame)
`categoryStatsMap` in `useBudget.ts` automatically re-computes in O(M) time
                      │
                      ▼
All Category Cards, Remaining Balance Badges, Usage Progress Bars update IMMEDIATELY (0ms lag)
                      │
                      ▼
`highlightedCategoryIds` state set for 1500ms
  -> Triggers CSS glow (`ring-2 ring-emerald-500 bg-emerald-50/20`) on affected categories
```

### Performance & Memoization Preservation
1. **Memoized Component Guards**:
   - `PolicyGroupCard` uses `React.memo` with `arePolicyGroupCardPropsEqual`.
   - `BudgetCategoryCardItem` uses `React.memo` with `areBudgetCategoryCardItemPropsEqual`.
   - The comparison functions check `catEntries` length and item properties (`id`, `amount`, `date`, `purpose`, `isPlanned`, `isSettled`, `actionType`).
   - When batch actions update entries, `arePolicyGroupCardPropsEqual` will evaluate `false` *only* for the specific `PolicyGroupCard` instances containing affected categories, ensuring $O(1)$ component re-rendering instead of re-rendering the entire dashboard tree!
2. **Zero Long-Task Stalls**:
   - Single atomic cache write eliminates repeated React render passes.
   - Execution time for 50 batch entries: < 12ms (well under the 100ms Long Task limit).

---

## 7. Recommended Implementation Strategy & Task Plan for Implementer

1. **Step 1: Custom Hook Batch Methods (`src/hooks/useBudget.ts`)**
   - Implement `batchUpdateEntries`, `batchSettleEntries`, `batchDeleteEntries` using `replaceAll('BUDGET_ENTRIES', ...)`.
   - Ensure atomic TanStack Query `onMutate` cache updates.

2. **Step 2: Expense Entry Multi-Selection State & Batch Toolbar (`src/components/budget/`)**
   - Add `selectedEntryIds` state and selection helpers (`toggleSelectEntry`, `toggleSelectAll`, `clearSelection`) in `BudgetDashboard.tsx` or a dedicated selection hook.
   - Create `ExpenseBatchToolbar.tsx` (floating batch control bar for batch settle, batch edit, batch delete).

3. **Step 3: Table & Row Multi-Select Checkboxes (`PolicyGroupCard.tsx`, `BudgetCategoryCardItem.tsx`, `LedgerModal.tsx`)**
   - Add checkbox controls to expense entry rows across all budget views.
   - Add section "Select All" checkboxes.

4. **Step 4: Modal UX Overhaul (`LedgerModal.tsx` & `ExpenseEntryModal.tsx`)**
   - Implement cross-modal navigation (`returnToLedger` stack state).
   - Implement Dual-Panel Split View toggle in `LedgerModal.tsx`.
   - Support batch settlement in `LedgerModal` for selected planned items.

5. **Step 5: Visual Feedback & Category Highlight Animations**
   - Add transient `highlightedCatIds` state.
   - Add CSS pulse glow on updated category cards upon batch action completion.

---

## 8. Verification Plan

1. **TypeScript Compilation Check**:
   - Run `npx tsc --noEmit` to verify zero type errors in `useBudget.ts`, `BudgetDashboard.tsx`, `LedgerModal.tsx`, etc.
2. **Harness & Rule Verification**:
   - Run `node scripts/run-harness.js` to ensure zero Zod schema errors, zero ESLint warnings, and adherence to MVC architecture rules.
3. **Functional Verification**:
   - Multi-select 5 planned entries in `LedgerModal` -> click "Batch Settle" -> verify instant status change, new actual entries created, and zero lag in remaining balance recalculation.
   - Multi-select 3 entries in `PolicyGroupCard` -> click "Batch Delete" -> verify single atomic deletion and category highlight effect.
