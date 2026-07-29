## 2026-07-29T07:51:54Z
You are Worker 2 (M3 Implementation Worker) for the Budget UI/UX Overhaul project.
Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_m3

Objective:
Implement Milestone 3 (R3: Expense Batch Actions & Modal Comparison UX Optimization).

Detailed Specification & Requirements:
1. `src/hooks/useBudget.ts`:
   Add helper mutation methods to batch process expense entries while preserving all existing custom hook contracts and API compatibility (`/api/data/route.ts`):
   - `batchUpdateEntries(ids: string[], updates: Partial<ExpenseEntry>)`
   - `batchDeleteEntries(ids: string[])`
   - `batchSettleEntries(ids: string[], status: 'SETTLED' | 'PENDING' | 'REJECTED')`
   Ensure optimistic updates and invalidation of budget/expense queries so category balances update reactively and immediately.

2. `src/components/budget/ui/ExpenseBatchToolbar.tsx`:
   - Create a sticky floating action bar component rendered when `selectedEntryIds.length > 0`.
   - Displays selected item count (e.g., "N개 항목 선택됨").
   - Action buttons:
     - Batch Settle / Approve ("일괄 승인")
     - Batch Status Change ("상태 변경")
     - Batch Delete ("선택 삭제")
     - Clear Selection ("선택 해제")
   - High-contrast dark theme TailwindCSS styling matching the existing dashboard aesthetic.

3. Multi-Select & Modal Comparison UX:
   - In `src/components/budget/ui/LedgerModal.tsx` and expense entry lists:
     - Add multi-select checkbox controls per entry row and a "select all" header checkbox.
     - Manage `selectedEntryIds` state and render `ExpenseBatchToolbar` floating overlay.
     - Implement a Dual-Panel Split View toggle inside `LedgerModal.tsx` allowing side-by-side comparison of ledger entries and budget category targets/details.
     - Support smooth cross-modal navigation between `LedgerModal` and `ExpenseEntryModal` without losing selection or modal context.
     - Ensure immediate reactive updating of category balance highlights and summary numbers after batch operations.

4. Verification Requirements:
   - Run `npx tsc --noEmit` and `node scripts/run-harness.js` from `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL`.
   - Verify 0 TypeScript errors and 0 harness errors.

Handoff Requirements:
Write your handoff report to `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_m3\handoff.md` and send a message back to the orchestrator with full details of created/modified components and execution results of `npx tsc --noEmit` and `node scripts/run-harness.js`.
