## 2026-07-22T04:56:20Z
<USER_REQUEST>
You are a Worker subagent for PORTFOLIO - VITAL (Milestone 2 - Worker 1).
Your working directory is: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\teamwork_preview_worker_m2_1

Task Objectives:
Implement R1, R2, and R3 optimizations for Dashboard, Hooks, Page layout, and BudgetDashboard.

Target Files & Changes:
1. `src/hooks/useBudget.ts`, `src/hooks/useTasks.ts`, `src/hooks/useMeetings.ts`, `src/hooks/useProjects.ts`, `src/hooks/useSignal.ts`:
   - Set `{ refetchOnWindowFocus: false, refetchIntervalInBackground: false }` on all TanStack `useQuery` options to eliminate window focus refetch storms (AGENTS.md Sec. 2-J).
2. `src/hooks/usePortfolioAnalytics.ts`:
   - Remove unused heavy `allBreakdownData` computation loop to eliminate dead-weight calculation (AGENTS.md Sec. 4-3). Check if any other component imports `allBreakdownData` first.
3. `src/hooks/useGoogleSheet.ts`:
   - Memoize the return object of `useSheetCrud` using `useMemo` (or wrap `syncAdd`, `syncUpdate`, `syncDelete` in `useCallback`) to preserve callback identity and fix downstream `React.memo` invalidation on `ContactCard` (AGENTS.md Sec. 2-K).
4. `src/components/dashboard/PortfolioDashboardView.tsx`:
   - Fix unstable React keys: replace `key={idx}` in `breakdownData.map` with `key={item.formationItem ? `${item.formationItem}-${item.name}` : item.name}` (AGENTS.md Sec. 2-K).
   - Replace rigid `setTimeout` timers (120ms/280ms) for `WeeklyScheduler` and `ContactsBox` with a `requestIdleCallback` idle deferral hook (`useIdleMount`).
   - Memoize Recharts tooltip render functions (`CustomPieTooltip`, `CustomComposedTooltip`).
5. `src/app/page.tsx`:
   - Render `AIAssistantModal` and `AppLogModal` conditionally in JSX tree (`{isLogsOpen && <AppLogModal ... />}` and `{isQuickInputOpen && <AIAssistantModal ... />}`).
   - Ensure idle module preloading uses staggered `requestIdleCallback` delays (3.5s, 5.5s, 7.5s).
6. `src/components/budget/BudgetDashboard.tsx`:
   - Dynamically import modal components (`CategoryEditModal`, `ExpenseEntryModal`, `BatchEditModal`, `LedgerModal`, `DailyExpenseStatModal`) via `dynamic(() => import(...), { ssr: false })` and render them conditionally.

Verification:
- Run `npx tsc --noEmit` and `node scripts/run-harness.js`. Verify zero errors/warnings.
- Document all changes and verification outputs in `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\teamwork_preview_worker_m2_1\changes.md` and `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\teamwork_preview_worker_m2_1\handoff.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Send message back to parent orchestrator when complete.
</USER_REQUEST>
