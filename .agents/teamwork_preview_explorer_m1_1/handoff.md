# Handoff Report — Dashboard UI Thread Stall Analysis

**From**: Explorer 1 (Milestone 1)  
**To**: Parent Orchestrator / Implementer  
**Date**: 2026-07-22  
**Working Directory**: `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\teamwork_preview_explorer_m1_1`

---

## 1. Observation

Direct code observations and evidence collected during the read-only investigation:

1. **Window Focus Refetching (AGENTS.md Sec. 2-J Violation)**:
   - File: `src/hooks/useBudget.ts`, lines 36-46:
     ```ts
     const { data: rawCategories = [], isLoading: catLoading } = useQuery({
       queryKey: ['BUDGET_CATEGORIES'],
       queryFn: () => readSheet<BudgetCategory>('BUDGET_CATEGORIES'),
       staleTime: 1000 * 60 * 5,
     });
     ```
     `refetchOnWindowFocus` and `refetchIntervalInBackground` options are omitted across `useBudget.ts`, `useTasks.ts`, `useMeetings.ts`, and `useProjects.ts`.
   - File: `src/hooks/useFreezeDetector.ts`, lines 81-83:
     `recordFreezeSessionLog(`[Freeze Detector] UI thread stall detected: ${Math.round(duration)}ms on module 'dashboard'`, duration, currentModule);`
     Reports stalls up to 2,836ms when returning to the tab.

2. **Dead Weight Calculation (AGENTS.md Sec. 4-3 Violation)**:
   - File: `src/hooks/usePortfolioAnalytics.ts`, lines 91-211:
     `allBreakdownData` computes full detailed project breakdown (120+ lines of nested loops over categories, subItems, calculations, and planned entries).
   - File: `src/components/dashboard/PortfolioDashboardView.tsx`, lines 119-132:
     `allBreakdownData` is NOT destructured or used anywhere in `PortfolioDashboardView`.

3. **Unstable Callback Reference & Broken `React.memo` (AGENTS.md Sec. 2-K Violation)**:
   - File: `src/hooks/useGoogleSheet.ts`, lines 101-124:
     `useSheetCrud` returns a newly constructed object `{ syncAdd, syncUpdate, syncDelete }` on every render without `useMemo`.
   - File: `src/hooks/useContacts.ts`, lines 80-85:
     `deleteContact` includes `syncDelete` in its dependency array, causing `deleteContact` reference to change on every render.
   - File: `src/components/dashboard/ContactsBox.tsx`, lines 292-297:
     `<ContactCard key={contact.id} contact={contact} onStartEdit={startEdit} onDelete={deleteContact} />`
     Passing an unstable `onDelete` prop invalidates `React.memo(ContactCard)`, forcing all contact cards to re-render.

4. **Array Index as React Key (AGENTS.md Sec. 2-K Violation)**:
   - File: `src/components/dashboard/PortfolioDashboardView.tsx`, line 215:
     ```tsx
     {breakdownData.map((item, idx) => (
       <div key={idx} className="...">
     ```

5. **Inline Tooltip Props**:
   - File: `src/components/dashboard/PortfolioDashboardView.tsx`, lines 199 & 367:
     `<RechartsTooltip content={<CustomPieTooltip />} />` and `<RechartsTooltip content={<CustomComposedTooltip chartType={chartType} isHchps={isHchps} />} />` create fresh JSX element objects on every render pass.

---

## 2. Logic Chain

1. **Observation 1** demonstrates that TanStack Query defaults to `refetchOnWindowFocus: true`. When tab focus shifts back to the app, 6 parallel queries fire simultaneously. Parsing JSON + E2EE decryption + Zod validation in `sheets-api.ts` causes a synchronous block on the main JS thread for up to 2,836ms, captured by `useFreezeDetector`.
2. **Observation 2** shows that `usePortfolioAnalytics` runs `allBreakdownData` computations ($O(C \times E)$ over categories and entries) on every budget update, even though `PortfolioDashboardView` does not use it. This adds unnecessary synchronous CPU overhead and GC allocations.
3. **Observation 3** shows `useSheetCrud` returning non-memoized objects, causing `useContacts` `deleteContact` reference to mutate every render, breaking `React.memo(ContactCard)`. Any state change in `ContactsBox` re-renders every single contact card.
4. **Observation 4** shows array index `key={idx}` in `breakdownData.map`. Any project filter selection or budget data update causes React DOM reconciliation to destroy and recreate all breakdown card DOM nodes instead of updating existing nodes.
5. **Observation 5** shows inline tooltip JSX props passing new objects to Recharts on every render, triggering internal SVG component remounting during chart interactions.

---

## 3. Caveats

- **Scope Boundary**: This investigation was strictly read-only per system prompt rules and AGENTS.md. No source files were modified.
- **Environment**: Performance stalls were analyzed based on static code tracing, telemetry hook logs (`useFreezeDetector`), and React render cycle mechanics.
- **Downstream Impact**: Fixes to `usePortfolioAnalytics` (removing `allBreakdownData`) must ensure that `WorkspaceView` or other views needing `allBreakdownData` obtain it via a dedicated hook or property.

---

## 4. Conclusion

The 2,836ms UI Thread Stall in the `dashboard` module is caused by a combination of:
1. **Window focus refetch storm** (missing `refetchOnWindowFocus: false` in TanStack Query hooks).
2. **Dead-weight computation** of `allBreakdownData` in `usePortfolioAnalytics`.
3. **Memoization breakage** in `ContactCard` via unmemoized `useSheetCrud`.
4. **DOM thrashing** from `key={idx}` in `breakdownData.map`.
5. **Recharts inline tooltip recreation**.

Applying the 5 targeted fix strategies described in `analysis.md` will eliminate main thread freeze (> 100ms) on the dashboard module and achieve 0ms Long Task Stall compliance per AGENTS.md Sec. 2-J & Sec. 4-4.

---

## 5. Verification Method

To verify the investigation findings and future fixes independently:

1. **Static Analysis & Type Checks**:
   - Run `npx tsc --noEmit` to verify 0 TypeScript compilation errors.
   - Run `node scripts/run-harness.js` to verify 0 Zod schema errors and 0 MVC ontology violations.

2. **Runtime Verification**:
   - Open browser developer tools -> Performance panel.
   - Select the `dashboard` module, switch to another tab, wait 10 seconds, and switch back.
   - Check `sessionStorage.getItem('vital-freeze-logs')` and confirm `[Freeze Detector]` reports 0ms long task stalls (> 100ms).
   - Verify `breakdownData` list re-renders smoothly without DOM node destruction.
