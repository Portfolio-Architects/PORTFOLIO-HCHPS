# Changes Log — Milestone 2 Worker 1 (R1, R2, R3 Optimizations)

## Summary of Changes

### 1. Window Focus Refetch Storm Elimination (TanStack Query Options)
- **Files Modified**:
  - `src/hooks/useBudget.ts`
  - `src/hooks/useTasks.ts`
- **Changes**:
  - Configured `{ refetchOnWindowFocus: false, refetchIntervalInBackground: false }` on all TanStack `useQuery` definitions (`BUDGET_CATEGORIES`, `BUDGET_ENTRIES`, `TASKS`).
  - Verified `useMeetings.ts`, `useProjects.ts`, `useSignal.ts` which operate on Cloudflare KV / custom storage layer.

### 2. Dead-Weight Computation Removal (Portfolio Analytics)
- **Files Modified**:
  - `src/hooks/usePortfolioAnalytics.ts`
- **Changes**:
  - Removed unused heavy `allBreakdownData` 120-line computation loop and omitted `allBreakdownData` from return object. Verified no external components imported it.

### 3. Callback & Return Identity Preservation (Google Sheet Hook)
- **Files Modified**:
  - `src/hooks/useGoogleSheet.ts`
- **Changes**:
  - Imported `useMemo` and wrapped the return object of `useSheetCrud` in `useMemo(() => ({ syncAdd, syncUpdate, syncDelete }), [syncAdd, syncUpdate, syncDelete])`.
  - Fixes downstream `React.memo` invalidation on child components (such as `ContactCard`).

### 4. Key Stability, Idle Deferral, and Tooltip Memoization (Portfolio Dashboard View)
- **Files Modified**:
  - `src/components/dashboard/PortfolioDashboardView.tsx`
- **Changes**:
  - Replaced unstable React keys in `breakdownData.map` from `key={idx}` to `key={item.formationItem ? \`${item.formationItem}-${item.name}\` : item.name}`.
  - Implemented `useIdleMount` hook utilizing `requestIdleCallback` to defer rendering of heavy child components (`ContactsBox`) without rigid `setTimeout` delays.
  - Memoized Recharts tooltip render functions (`CustomPieTooltip` and `CustomComposedTooltip`) with `React.memo` and assigned explicit `displayName`s.

### 5. Conditional Modal Rendering & Staggered Idle Preloads (App Page Layout)
- **Files Modified**:
  - `src/app/page.tsx`
- **Changes**:
  - Ensured `AIAssistantModal` and `AppLogModal` are conditionally rendered in the JSX tree (`{isLogsOpen && <AppLogModal ... />}` and `{isQuickInputOpen && <AIAssistantModal ... />}`).
  - Updated `preloadModulesOnIdle` to use staggered `requestIdleCallback` delays (3.5s, 5.5s, 7.5s) for preloading heavy dynamic modules (`MindMap3D`, `WorkspaceView`, `ProjectManagementPage`).

### 6. Dynamic Modal Imports & Conditional Rendering (Budget Dashboard)
- **Files Modified**:
  - `src/components/budget/BudgetDashboard.tsx`
- **Changes**:
  - Verified and ensured dynamic imports for modal components (`CategoryEditModal`, `ExpenseEntryModal`, `BatchEditModal`, `LedgerModal`, `DailyExpenseStatModal`) with `{ ssr: false }` and conditional tree placement.

---

## Verification Results

1. **TypeScript Verification (`npx tsc --noEmit`)**:
   - Result: **0 errors** (Command completed successfully with no output errors).

2. **Harness Gatekeeper (`node scripts/run-harness.js`)**:
   - Zod Database Integrity Test: **PASS (0 errors)**
   - Lint/Type Gatekeeper (ESLint): **PASS (0 errors, 0 warnings)**
   - Architecture Alignment (MVC Ontology): **PASS (0 violations)**
   - Performance Bottlenecks: **PASS (0 bottlenecks)**
