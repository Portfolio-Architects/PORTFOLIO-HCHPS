# Portfolio Dashboard UI Thread Stall Analysis Report

**Target Module**: `src/components/dashboard/*`, `PortfolioDashboardView.tsx`, and related hooks (`usePortfolioAnalytics`, `useContacts`, `useBudget`, `useTasks`).  
**Investigator**: Explorer 1 (Milestone 1 - Subagent)  
**Date**: 2026-07-22  
**Status**: Completed (Read-Only Analysis)

---

## 1. Executive Summary

An investigation was conducted on the `dashboard` module to identify the root causes of main UI thread stalls (reported up to 2,836ms). Analysis revealed five distinct architectural and performance bottlenecks contributing to long tasks:

1. **Window Focus Refetch Storm (AGENTS.md Sec. 2-J Violation)**: Query hooks (`useBudget`, `useTasks`, etc.) do not disable `refetchOnWindowFocus`. Returning to the tab triggers simultaneous background fetches, decryption/Zod validation, and top-level React state updates, freezing the main thread.
2. **Dead Weight Calculation in `usePortfolioAnalytics` (AGENTS.md Sec. 4-3 Violation)**: `usePortfolioAnalytics.ts` calculates a 120-line complex breakdown array (`allBreakdownData`) on every category/entry update, despite `PortfolioDashboardView` never consuming or displaying it.
3. **Broken Component Memoization in `ContactsBox` (AGENTS.md Sec. 2-K Violation)**: `useSheetCrud` in `useGoogleSheet.ts` returns unmemoized CRUD helper functions on every render, invalidating `useCallback` references in `useContacts` and breaking `React.memo(ContactCard)`.
4. **Unstable React Keys in Render Lists (AGENTS.md Sec. 2-K Violation)**: `PortfolioDashboardView.tsx` renders `breakdownData` using array index `key={idx}`, triggering complete DOM node destruction and reconstruction during updates.
5. **Recharts Tooltip & Render Overhead**: Inline JSX element creation for Recharts tooltips (`content={<CustomPieTooltip />}`) and un-throttled ResizeObserver state updates force frequent SVG layout re-computations.

---

## 2. Component Architecture & Dependency Map

```
src/app/page.tsx (ProtectedApp)
├── Query Hooks (useBudget, useTasks, useMeetings, useProjects, useSignal)
├── PortfolioDashboardView (dynamic import with ssr: false + PortfolioDashboardViewSkeleton)
│   ├── usePortfolioAnalytics(budgetCategories, budgetEntries)
│   │   ├── Computes totals, pieData, breakdownData
│   │   ├── Computes monthlyExecutionData (linear regression, target burn-down)
│   │   └── [DEAD WEIGHT] Computes allBreakdownData (unused by dashboard)
│   ├── Recharts (PieChart, ComposedChart, Tooltips)
│   └── ContactsBox (dynamic import with ssr: false + Spinner Fallback)
│       └── useContacts() -> useGoogleSheet('CONTACTS') -> ContactCard (React.memo)
```

---

## 3. Root Cause Analysis of 2,836ms UI Thread Stall

### Cause 1: Window Focus Refetch Storm (AGENTS.md Sec. 2-J)
- **Location**: `src/hooks/useBudget.ts` (lines 36-46), `src/hooks/useTasks.ts` (lines 79-83), `src/hooks/useMeetings.ts`, `src/hooks/useProjects.ts`.
- **Mechanism**: TanStack Query defaults `refetchOnWindowFocus: true`. When a user switches tabs or returns to the application window, all queries execute parallel network requests to `/api/data`.
- **Impact**: Upon response, `readSheet` in `src/lib/sheets-api.ts` parses JSON, executes E2EE decryption, runs Zod schema validation (`getDomainSchema`), and updates query state. This triggers cascading re-renders of `ProtectedApp` and all child components, causing a JS thread freeze up to 2,836ms.

### Cause 2: Dead Weight Computation in `usePortfolioAnalytics` (AGENTS.md Sec. 4-3)
- **Location**: `src/hooks/usePortfolioAnalytics.ts` (lines 91-211).
- **Mechanism**: `allBreakdownData` is computed inside a large `useMemo` block that iterates through all detailed projects, categories, sub-items, calculations, planned entries, and virtual adjustments.
- **Impact**: `PortfolioDashboardView.tsx` (lines 119-132) does NOT destructure or use `allBreakdownData`. Every time budget entries or categories update, CPU cycles and memory allocations are wasted calculating data for non-dashboard views, leading to Garbage Collection (GC) pressure and main-thread lag.

### Cause 3: Ineffective `React.memo` on `ContactCard` (AGENTS.md Sec. 2-K)
- **Location**: `src/hooks/useGoogleSheet.ts` (line 101) & `src/hooks/useContacts.ts` (lines 81-85).
- **Mechanism**: `useSheetCrud` returns an object `{ syncAdd, syncUpdate, syncDelete }` created inline during every execution. In `useContacts.ts`, `deleteContact` depends on `syncDelete`.
- **Impact**: Because `syncDelete` reference changes on every render of `ContactsBox`, `deleteContact` reference changes as well. When passed to `<ContactCard onDelete={deleteContact} />`, `React.memo` fails equality check, forcing all contact cards to re-render on every state change.

### Cause 4: Array Index Key Anti-Pattern (AGENTS.md Sec. 2-K)
- **Location**: `src/components/dashboard/PortfolioDashboardView.tsx` (line 215).
- **Code Snippet**:
  ```tsx
  {breakdownData.map((item, idx) => (
    <div key={idx} className="...">
  ```
- **Impact**: React uses `key={idx}` to track list items. When selecting a specific project from the dropdown filter or updating data, React cannot correlate items by identity, resulting in full DOM element teardown and re-creation.

### Cause 5: Inline Tooltip JSX & ResizeObserver Re-renders (AGENTS.md Sec. 2-K)
- **Location**: `src/components/dashboard/PortfolioDashboardView.tsx` (lines 199 & 367).
- **Code Snippet**:
  ```tsx
  <RechartsTooltip content={<CustomPieTooltip />} />
  <RechartsTooltip content={<CustomComposedTooltip chartType={chartType} isHchps={isHchps} />} />
  ```
- **Impact**: Passing new JSX elements (`<CustomPieTooltip />`) on every render forces Recharts internals to unmount and remount tooltip wrappers during chart interactions and mouse moves.

---

## 4. Compliance Verification Matrix (AGENTS.md Rules)

| Rule Section | Description | Status | Details |
|---|---|---|---|
| **Sec. 2-I** | SSR Hydration & Dynamic Imports | **PASS** | `PortfolioDashboardView` uses `dynamic(..., { ssr: false })` with `PortfolioDashboardViewSkeleton`. `ContactsBox` uses dynamic import. |
| **Sec. 2-J** | Zero-Stall & Tab Visibility Pause | **FAIL** | Queries in `useBudget`, `useTasks` lack `refetchOnWindowFocus: false`, triggering multi-query refetch stalls upon window focus. |
| **Sec. 2-K** | React Key Stability & Memoization | **FAIL** | `breakdownData` uses `key={idx}`. `useSheetCrud` reference instability invalidates `ContactCard` `React.memo`. |
| **Sec. 4-3** | Complexity & Dead-Weight Removal | **FAIL** | Heavy `allBreakdownData` calculation runs inside `usePortfolioAnalytics` despite being unused by `PortfolioDashboardView`. |

---

## 5. Proposed Fix Strategies (Action Plan for Implementer)

### Strategy 1: Disable Refetch on Window Focus in Data Hooks
- **Action**: Add `{ refetchOnWindowFocus: false, refetchIntervalInBackground: false }` to options in `useQuery` calls across `useBudget.ts`, `useTasks.ts`, `useMeetings.ts`, `useProjects.ts`, `useSignal.ts`.
- **Target File**: `src/hooks/useBudget.ts`, `src/hooks/useTasks.ts`, etc.

### Strategy 2: Remove Unused `allBreakdownData` from `usePortfolioAnalytics`
- **Action**: Remove `allBreakdownData` from `usePortfolioAnalytics.ts` (or extract it into a separate dedicated hook `useWorkspaceAnalytics.ts` for `WorkspaceView`).
- **Target File**: `src/hooks/usePortfolioAnalytics.ts`

### Strategy 3: Stabilize `useSheetCrud` Callback References
- **Action**: Wrap the return value of `useSheetCrud` in `useMemo` (or wrap `syncAdd`, `syncUpdate`, `syncDelete` in `useCallback`) in `src/hooks/useGoogleSheet.ts`.
- **Target File**: `src/hooks/useGoogleSheet.ts`

### Strategy 4: Fix Array Index Keys in `PortfolioDashboardView.tsx`
- **Action**: Replace `key={idx}` in `breakdownData.map` with `key={item.formationItem ? `${item.formationItem}-${item.name}` : item.name}`.
- **Target File**: `src/components/dashboard/PortfolioDashboardView.tsx` (line 215)

### Strategy 5: Memoize Recharts Tooltips
- **Action**: Pass memoized tooltip render functions or stable components to `RechartsTooltip`.
- **Target File**: `src/components/dashboard/PortfolioDashboardView.tsx`
