## 2026-07-29T07:00:07Z
<USER_REQUEST>
You are Worker 1 for Milestone 1 (Requirement R1: Table Inline-Editing & Keyboard Navigation System) in `src/components/budget/`.
Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_budget_r1

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

CRITICAL RULES:
- DO NOT edit `/api/data/route.ts`, `useTasks.ts`, `useInventory.ts`, or `useContacts.ts`.
- DO NOT break contracts in `src/hooks/useBudget.ts`.
- Focus strictly on `src/components/budget/ui/PolicyGroupCard.tsx` and `src/components/budget/ui/BudgetCategoryCardItem.tsx` (and option to create `src/components/budget/ui/InlineEditCell.tsx`).

Implementation Blueprint:
1. Create reusable `InlineEditCell.tsx` component in `src/components/budget/ui/InlineEditCell.tsx`:
   - Props: `value: string | number`, `onSave: (newValue: string) => void`, `onCancel?: () => void`, `onNavigate?: (direction: 'next' | 'prev') => void`, `type?: 'text' | 'number' | 'date'`, `className?: string`, `placeholder?: string`.
   - Internal state `tempValue` initialized from `value`.
   - Keydown listener:
     - `Enter` or `Ctrl+Enter`: commit `tempValue` via `onSave(tempValue)` and blur/exit editing.
     - `Escape`: call `onCancel()` or reset `tempValue = value` and exit editing.
     - `Tab` (without Shift): commit `tempValue`, `e.preventDefault()`, and invoke `onNavigate?.('next')`.
     - `Shift+Tab`: commit `tempValue`, `e.preventDefault()`, and invoke `onNavigate?.('prev')`.
   - Auto-focus input element on mount (`ref.current?.focus()`).
2. Integrate `InlineEditCell` into `PolicyGroupCard.tsx`:
   - Replace static text for `date`, `docRegNum`, `purpose`, `amount` in expense entry rows with click-to-edit cells.
   - For number fields (`amount`), parse cleanly: `Number(val.replace(/,/g, ''))` before calling `updateEntry({ ...entry, amount })`.
   - Track active cell index/field to support Tab navigation across cells.
3. Integrate `InlineEditCell` into `BudgetCategoryCardItem.tsx`:
   - Replace static text for sub-items and category header fields with `InlineEditCell`.
4. Verification & Testing:
   - Run `npx tsc --noEmit` and ensure 0 errors.
   - Run `node scripts/run-harness.js` and ensure 100% Zod schema compliance & 0 lint errors.

Output Requirements:
Save actual changes to `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_budget_r1\changes.md` and handoff report to `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_budget_r1\handoff.md`.
Send completion message back to parent orchestrator.
</USER_REQUEST>
