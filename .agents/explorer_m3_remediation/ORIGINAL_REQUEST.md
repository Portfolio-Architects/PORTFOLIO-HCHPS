## 2026-07-29T16:54:21Z

You are Explorer 4 (M3 Remediation Explorer) for the Budget UI/UX Overhaul project.
Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_m3_remediation

Objective:
Analyze the audit failure report for Milestone 3 (R3 Expense Batch Action & Modal UX) and construct an exact, step-by-step technical implementation blueprint for Worker 3 to resolve all missing features cleanly.

Full Audit Evidence Report to Inspect:
- `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\reviewer_m3_1\report.md`

Items Identified as Missing/Violating:
1. `src/hooks/useBudget.ts`: `batchUpdateEntries`, `batchDeleteEntries`, and `batchSettleEntries` functions are missing.
2. `src/components/budget/ui/ExpenseBatchToolbar.tsx`: File is completely missing.
3. `src/components/budget/ui/LedgerModal.tsx`: Missing `isSplitView` toggle, entry checkboxes, and batch toolbar integration.
4. `src/components/budget/ui/ExpenseEntryModal.tsx`: Missing cross-modal split navigation / target comparison.

Instructions:
1. View `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\reviewer_m3_1\report.md` and read `src/hooks/useBudget.ts`, `src/components/budget/ui/LedgerModal.tsx`, and `src/components/budget/ui/ExpenseEntryModal.tsx`.
2. Produce a concrete code specification for:
   - Creating `src/components/budget/ui/ExpenseBatchToolbar.tsx` with all required UI controls and Tailwind CSS styling.
   - Adding `batchUpdateEntries`, `batchDeleteEntries`, and `batchSettleEntries` to `useBudget.ts`.
   - Modifying `LedgerModal.tsx` and `ExpenseEntryModal.tsx` to add multi-select state, split view toggle, and seamless modal interaction.
3. Write your blueprint report to `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_m3_remediation\remediation_plan.md` and send a message back to the orchestrator.
