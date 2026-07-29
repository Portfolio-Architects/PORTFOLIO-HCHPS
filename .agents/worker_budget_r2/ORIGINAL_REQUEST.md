## 2026-07-29T16:04:57Z
You are Worker 2 for Milestone 2 (Requirement R2: Real-time Category Balance Highlighting & Filtering Optimization) in `src/components/budget/`.
Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_budget_r2

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

CRITICAL RULES:
- DO NOT edit `/api/data/route.ts` backend endpoints.
- DO NOT break contracts in `src/hooks/useBudget.ts`.
- Focus on `src/components/budget/`, `src/hooks/useBudgetFilters.ts`, `PolicyGroupCard.tsx`, `BudgetCategoryCardItem.tsx`, and `BudgetDashboard.tsx`.

Implementation Plan (R2 Blueprint from Explorer 2):
1. **Status Badges & Highlighting**:
   - Implement `getCategoryStatus` helper returning status ('OVER' | 'WARNING' | 'NORMAL').
   - Render high-contrast status badges:
     - '초과/위험' (Red badge `bg-red-500/20 text-red-400 border border-red-500/30`) for usage rate >= 95% or negative remaining balance.
     - '주의' (Amber badge `bg-amber-500/20 text-amber-400 border border-amber-500/30`) for usage rate >= 80%.
     - '정상' (Green/Emerald badge `bg-emerald-500/20 text-emerald-400 border border-emerald-500/30`) for normal usage rate.
   - Display explicit balance callouts with highlight text.
2. **Multi-Criteria Filtering & 0ms DOM Stall**:
   - Extend `useBudgetFilters.ts` (or `BudgetDashboard.tsx`) with:
     - `filterMonth`: Month selector (1월~12월, 전체).
     - `filterStatus`: Status filter ('초과', '주의', '정상', 전체).
     - `searchTerm`: Keyword search filter matching policy group name, category name, sub-item, docRegNum, or purpose.
   - Wrap search query state update in `useDeferredValue` so high-frequency keystrokes do not stall rendering (0ms DOM stall / 60 FPS).
3. **Background Tab Pause (AGENTS.md Rule 2-J Compliance)**:
   - Add `useDocumentVisibility` hook (or `document.hidden` listener).
   - Conditionally disable keyframe animation classes (`animate-shimmer`, `animate-pulse`) when `document.hidden === true` (`document.hidden ? '' : 'animate-shimmer'`).

Verification Commands to Run:
- `npx tsc --noEmit`
- `node scripts/run-harness.js`

Output Requirements:
Save actual changes report to `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_budget_r2\changes.md` and handoff report to `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_budget_r2\handoff.md`.
Send completion summary back to parent orchestrator.
