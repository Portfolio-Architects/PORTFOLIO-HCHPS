# Requirement R3: Expense Batch Action & Modal UX Optimization - Detailed Analysis Report

## Executive Summary
This report presents an in-depth investigation of `src/components/budget/` (`PolicyGroupCard.tsx`, `BatchEditModal.tsx`, `LedgerModal.tsx`, `ExpenseEntryModal.tsx`, `BudgetCategoryCardItem.tsx`, `BudgetDashboard.tsx`) and `src/hooks/useBudget.ts` for Requirement R3.

---

## 1. Current Expense Rendering & Multi-Select Checkbox State

### Observations
- **File Locations**:
  - `src/components/budget/ui/PolicyGroupCard.tsx` (lines 451–492)
  - `src/components/budget/ui/BudgetCategoryCardItem.tsx` (lines 275–341)
  - `src/components/budget/ui/LedgerModal.tsx` (lines 125–200)
- **Current Behavior**:
  - In `PolicyGroupCard.tsx`, expense items (`groupEntries`) are rendered in a flat list per policy group with single-item edit (`Pencil`) and delete (`Trash2`) buttons.
  - In `BudgetCategoryCardItem.tsx`, entries are separated into `generalEntries` and `dailyExpenseEntries` when expanding a stat-item card.
  - In `LedgerModal.tsx`, entries are split into left (planned/issuance) and right (settled actuals) T-account columns with single-item `✓ 결제 완료(정산)` buttons.
- **Checkbox Presence**:
  - `checked?: boolean` property exists on `BudgetEntry` type (`src/types/index.ts:96`) and Zod schema (`src/lib/schemas.ts:99`).
  - **However, NO multi-select checkbox UI exists** in `PolicyGroupCard.tsx`, `BudgetCategoryCardItem.tsx`, `LedgerModal.tsx`, or `BudgetDashboard.tsx`.

### Recommended Design for Multi-Select Checkbox & Batch Toolbar
1. **Multi-Select Checkboxes**:
   - Add a checkbox to each expense entry row in `PolicyGroupCard.tsx`, `BudgetCategoryCardItem.tsx`, and `LedgerModal.tsx`.
   - Add a "Select All in Group / Category" checkbox to group headers.
2. **Sticky Batch Action Floating Toolbar**:
   - When `selectedEntryIds.size > 0`, display a bottom floating toolbar in `BudgetDashboard.tsx`.
   - Action controls on toolbar:
     - **Count indicator**: `[N]개 항목 선택됨`
     - **Batch Approval / Settle (일괄 승인/정산)**
     - **Batch Action/Status Edit (일괄 상태/구분 변경)**
     - **Batch Delete (일괄 삭제)**
     - **Select All / Clear Selection (전체 선택/해제)**

---

## 2. Batch Edit Modal Usage & Integration with `useBudget` Mutations

### Observations
- **Current Usage of `BatchEditModal.tsx`**:
  - `BatchEditModal.tsx` (`src/components/budget/ui/BatchEditModal.tsx:1-121`) is currently used **exclusively for category-level batch updates** (modifying `budgetType` and proportional `fundingSplits` across categories under a `detailedProject`).
  - Triggered from `PolicyGroupCard.tsx:388-399` via the `비율 모괄 설정` button.
- **Limitation**:
  - No batch modal or batch action handler exists for expense entries (`BudgetEntry`).
  - In `useBudget.ts`, `updateEntry` and `deleteEntry` only accept a single entry ID. Loop-calling single entry mutations causes multiple React Query state updates and potential disk write race conditions.

### Proposed Integration with `useBudget` Mutations
1. **Batch Entry Mutations in `useBudget.ts`**:
   - Add `batchUpdateEntries(updatesMap: Record<string, Partial<BudgetEntry>>)` or `batchUpdateEntriesByIds(ids: string[], updates: Partial<BudgetEntry>)`.
   - Add `batchDeleteEntries(ids: string[])`.
   - Use atomic React Query cache update (`queryClient.setQueryData(['BUDGET_ENTRIES'], old => ...)` ) inside `replaceEntriesMut` or batch mutation to update all items in a single $O(1)$ batch state update.
2. **Dedicated Expense Batch Action Modal (`ExpenseBatchEditModal.tsx` or extended `BatchEditModal.tsx`)**:
   - Support batch approval (`isPlanned` -> `isSettled`), batch action type change (`general` / `issuance` / `daily_expense` / `transfer` / `correction` / `settle`), batch doc number assignment, and batch date/funding source update.

---

## 3. Ledger Modal & Expense Entry Modal Split View Architecture

### Observations
- **`LedgerModal.tsx`**:
  - 4xl modal performing T-account cross-verification (Left: planned/issuance vs Right: settled actuals).
  - Single-item settlement via `handleSettleSubmit`.
- **`ExpenseEntryModal.tsx`**:
  - Form modal for editing/creating single `BudgetEntry` with strict limit validation (category total budget limit, sub-item limit, daily expense remaining limit, locked state check).
- **Current UX Gap**:
  - Closing `LedgerModal` to open `ExpenseEntryModal` breaks cross-verification context.

### Proposed Toggle / Split View Implementation
1. **View Mode State in `LedgerModal.tsx`**:
   - `viewMode: 'full' | 'split'`.
2. **Split View Layout**:
   - **Left Pane (50%)**: T-account ledger list with clickable entry rows.
   - **Right Pane (50%)**: Live entry inspector & editor form (`ExpenseEntryForm`), pre-filled with the active selected entry from the left ledger.
3. **Instant Toggle Button**:
   - Add a `대조/수정 분할 뷰` header toggle button to switch between full ledger view and side-by-side comparison view cleanly.

---

## 4. UI Zero-Lag & Zod Schema Safety Strategy

### UI Performance & Zero-Lag
- `useBudget.ts` computes `categoryStatsMap` using `useMemo` on `[uniqueCategories, entries]`.
- Batch operations updating React Query `['BUDGET_ENTRIES']` in a single atomic cache mutation cause `categoryStatsMap`, category remaining balances, usage rate progress bars, and risk alerts to update synchronously in 1 React render frame (~0ms stall).

### Zod Schema Safety (`src/lib/schemas.ts`)
- All `BudgetEntry` objects created or updated via batch actions must satisfy `BudgetEntrySchema`:
  - Required: `id`, `categoryId`, `amount`, `date`, `purpose`.
  - Optional enums/types: `actionType` (`general` | `issuance` | `daily_expense` | `transfer` | `correction` | `settle`), `transferDirection` (`in` | `out`), `isPlanned`, `isSettled`, `checked`, `docRegNum`, `fundingSource`.
- Existing `.catch()` defaults in `src/lib/schemas.ts:84-102` prevent schema validation failures (`[HARNESS ZOD ERROR]`).

---

## Code References Table
| Component / File | Purpose | Lines of Interest |
|---|---|---|
| `src/hooks/useBudget.ts` | Budget state & mutations | 140-196 (mutations), 223-314 (categoryStatsMap) |
| `src/components/budget/BudgetDashboard.tsx` | Main budget container & modals | 156-176 (batch edit handler), 372-400 (policy groups) |
| `src/components/budget/ui/PolicyGroupCard.tsx` | Policy group & entry list | 388-399 (batch edit trigger), 451-492 (entry list) |
| `src/components/budget/ui/BatchEditModal.tsx` | Category batch edit modal | 15-121 (form & ratio calculation) |
| `src/components/budget/ui/LedgerModal.tsx` | T-account cross verification | 68-206 (left/right T-account lists) |
| `src/components/budget/ui/ExpenseEntryModal.tsx` | Expense entry form & validation | 81-229 (validation & save) |
| `src/lib/schemas.ts` | Zod schema definitions | 84-102 (BudgetEntrySchema) |
