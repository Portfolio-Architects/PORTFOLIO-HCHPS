## 2026-07-29T07:54:29Z
You are Worker 3 (M3 Remediation Worker) for the Budget UI/UX Overhaul project.
Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_m3_remediation

Objective:
Execute the remediation blueprint created by Explorer 4 (`d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_m3_remediation\remediation_plan.md`) to genuinely build and integrate all missing Milestone 3 (R3 Expense Batch Action & Modal UX) features.

Step-by-Step Task Instructions:

1. **`src/hooks/useBudget.ts`**:
   Add the following batch mutation functions to `useBudget` custom hook, using React Query `useMutation` and `queryClient.invalidateQueries({ queryKey: ['budget'] })`:
   - `batchUpdateEntries(updates: { id: string; [key: string]: any }[])` or `(ids: string[], updates: Partial<ExpenseEntry>)`
   - `batchDeleteEntries(ids: string[])`
   - `batchSettleEntries(ids: string[], status: 'SETTLED' | 'PENDING' | 'REJECTED')`
   Ensure they update the local dataset / API correctly and invalidate queries so category balance badges recalculate instantly.

2. **`src/components/budget/ui/ExpenseBatchToolbar.tsx`**:
   Create new component `ExpenseBatchToolbar.tsx`:
   - Floating sticky toolbar fixed at bottom center (`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 ...`).
   - Displays selected item count (e.g. `selectedCount`개 선택됨).
   - Action controls: "일괄 승인", "대기", "반려", "선택 삭제", "선택 해제".
   - Clean dark-theme Tailwind CSS styling matching the project UI rules in `AGENTS.md`.

3. **`src/components/budget/ui/LedgerModal.tsx`**:
   - Implement `selectedEntryIds` state (Set<string> or string[]).
   - Add checkbox column in table rows and a header select-all checkbox.
   - Conditionally mount `<ExpenseBatchToolbar />` when items are selected.
   - Add `isSplitView` state and a Split View toggle button ("대조 모드" / "단일 보기").
   - When `isSplitView` is active, render a dual-panel layout: Left side = Ledger Entries list, Right side = Category target budget details & comparison view.

4. **`src/components/budget/ui/ExpenseEntryModal.tsx`**:
   - Ensure seamless cross-modal opening and navigation between `LedgerModal.tsx` and `ExpenseEntryModal.tsx` without resetting selection state or filter options.

5. **Verification**:
   - Run `npx tsc --noEmit` from `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL`. Must pass with 0 errors.
   - Run `node scripts/run-harness.js` from `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL`. Must pass with 0 errors.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Handoff Requirements:
Write your handoff report to `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_m3_remediation\handoff.md` and send a message back to the orchestrator with full details of created/modified files and verification results.
