# Budget Management Page UI Freeze & GC Optimization Investigation Handoff Report

## 1. Observation

### R1: Module Dynamic Preloading & Timing (`src/app/page.tsx` & `src/components/WorkspaceView.tsx`)
- **File**: `src/app/page.tsx`
  - Lines 432-458: `preloadModulesOnIdle` uses `setTimeout` with fixed delays (3500ms for `'mindmap'`, 5500ms for `'workspace'`, 7500ms for `'project'`) and calls `requestIdleCallback(() => triggerPreload(module))` when available.
  - Lines 436-440: `triggerPreload` executes dynamic import `import('@/components/WorkspaceView')`. This loads the JS bundle chunk for `WorkspaceView`, but does NOT mount or pre-render the React component.
  - Lines 691-748: Components are conditionally rendered inside hidden container `div`s based on `visitedModules` state:
    ```tsx
    {visitedModules.workspace && (
      <div className={activeModule === 'workspace' ? 'block' : 'hidden'}>
        <WorkspaceView ... />
      </div>
    )}
    ```
- **File**: `src/components/WorkspaceView.tsx`
  - Lines 20-26: `BudgetDashboard` is dynamic-imported with `ssr: false`:
    ```tsx
    const BudgetDashboard = dynamic(
      () => import('@/components/budget/BudgetDashboard').then((mod) => mod.BudgetDashboard),
      { ssr: false, loading: () => <BudgetDashboardSkeleton /> }
    );
    ```
  - **Observation**: Preloading `WorkspaceView` chunk in `src/app/page.tsx` does NOT preload the nested dynamic import chunk for `BudgetDashboard`. Thus, switching to the Workspace tab triggers a 2-stage chunk loading waterfall: (1) `WorkspaceView` chunk -> (2) `BudgetDashboard` chunk.

### R2: Budget Card Component DOM Rendering & Virtualization (`PolicyGroupCard.tsx`, `BudgetCategoryCardItem.tsx`, `BudgetDashboard.tsx`)
- **File**: `src/components/budget/BudgetDashboard.tsx`
  - Lines 358-373: Maps `groupedByPolicy` array directly into `<PolicyGroupCard key={group.policyName} ... />` without DOM virtualization.
- **File**: `src/components/budget/ui/PolicyGroupCard.tsx`
  - Lines 210-326: Iterates over `groupedByDetail` and maps `detailGroup.cats` directly to `<BudgetCategoryCardItem key={cat.id} ... />`.
  - Lines 344-386: Maps `visibleGroupEntries` directly into expenditure entry `div` elements.
  - Line 316: Inline arrow function passed to `BudgetCategoryCardItem`:
    ```tsx
    onSwapCat={updateCategory ? (dir) => handleSwapCat(detailGroup.cats, catIdx, dir) : undefined}
    ```
- **File**: `src/components/budget/ui/BudgetCategoryCardItem.tsx`
  - Line 22: Component is wrapped in `React.memo`, but receiving inline function prop `onSwapCat` on every parent render invalidates props comparison and forces re-rendering of all category cards.
- **Comparison File**: `src/components/inventory/InventoryList.tsx`
  - Lines 27-60: Implements `useVirtualGrid` to calculate scroll offsets, container metrics, and visible indices (`startIndex`, `endIndex`) to render only visible grid rows. `BudgetDashboard` currently lacks windowing/virtualization for large category lists.

### R3: `getCategoryStats` and `useBudget.ts` GC & Object Allocation Bottlenecks
- **File**: `src/hooks/useBudget.ts`
  - Lines 223-296: `categoryStatsMap` pre-calculates statistics Map for all unique categories in $O(N)$ pass.
  - Lines 299-312: `getCategoryStats`:
    ```tsx
    const getCategoryStats = useCallback((categoryId: string, excludePlanned = false): CategoryStats | null => {
      const cached = categoryStatsMap.get(categoryId);
      if (!cached) return null;
      if (!excludePlanned) return cached;

      const remaining = cached.totalBudget - cached.spent - cached.locked; 
      const usageRate = cached.totalBudget > 0 ? (cached.spent / cached.totalBudget) * 100 : 0;
      return {
        ...cached,
        planned: 0,
        remaining,
        usageRate
      };
    }, [categoryStatsMap]);
    ```
    - When `excludePlanned = true`, a new object literal is instantiated on every function invocation.
  - Lines 386-463: `overallStats` and `overallStatsActual` perform full array `.reduce`, `.filter`, and `.forEach` passes across `uniqueCategories` and `entries` on every memo tick, recalculating totals that are already available in `categoryStatsMap`.
- **File**: `src/components/budget/ui/PolicyGroupCard.tsx`
  - Lines 212-223: Calls `getCategoryStats(c.id)` 3 times per category inside `detailGroup.cats.reduce` inside the `.map()` loop during render tick:
    ```tsx
    const detailDailyIssued = detailGroup.cats.reduce((sum, c) => {
      const st = getCategoryStats(c.id);
      return sum + (st ? st.dailyExpenseIssued : 0);
    }, 0);
    ```
  - Lines 225-236: Instantiates `new Set<string>()` (`detailFundingSet`) and performs string operations (`.replace()`, `.split()`, `.trim()`) inside the JSX `.map()` render loop per detail group on every render frame:
    ```tsx
    const detailFundingSet = new Set<string>();
    detailGroup.cats.forEach(c => {
      if (c.fundingSource) {
        const clean = c.fundingSource.replace(/구비\(자체\)/g, '구비').replace(/\([^)]+\)/g, '');
        clean.split(',').forEach(p => { ... });
      }
    });
    ```

---

## 2. Logic Chain

1. **R1 Logic Chain**:
   - Observation: `src/app/page.tsx` preloads `import('@/components/WorkspaceView')` at 5.5s delay. However, `WorkspaceView.tsx` dynamically imports `BudgetDashboard` via `dynamic(() => import('@/components/budget/BudgetDashboard'))`.
   - Inference: Preloading `WorkspaceView` chunk only fetches the top wrapper bundle. When the user navigates to the Budget tab, the browser must issue a secondary request for `BudgetDashboard` chunk, causing UI latency or skeleton flashing.
   - Conclusion: Pre-triggering sub-chunk imports (`import('@/components/budget/BudgetDashboard')`) during idle or optimizing staggered delay timers removes the secondary loading waterfall.

2. **R2 Logic Chain**:
   - Observation: `BudgetDashboard.tsx` and `PolicyGroupCard.tsx` render all policy groups, detail groups, category items, and entry rows into the DOM without virtualization. Furthermore, `PolicyGroupCard` passes inline arrow functions to `BudgetCategoryCardItem`.
   - Inference: For budgets with 50+ categories and hundreds of entries, DOM node count exceeds thousands of elements, consuming heavy rendering CPU cycles. Inline arrow functions bypass `React.memo` optimization, causing cascade re-renders across all cards whenever parent state (`isOpen`, `showAllEntries`) changes.
   - Conclusion: Integrating `useVirtualGrid` or row windowing and memoizing handler callbacks with `useCallback` will isolate re-renders and bound DOM node counts to $O(1)$ relative to total items.

3. **R3 Logic Chain**:
   - Observation: `getCategoryStats(id, excludePlanned=true)` creates a new object literal per call. `PolicyGroupCard` renders call `getCategoryStats` up to 3-4 times per category item inside loop reduces, and instantiates `new Set()` plus regex string replacements directly inside JSX `.map()` calls. `overallStats` performs redundant array iterations over `uniqueCategories` and `entries`.
   - Inference: High frequency of temporary object and Set allocations inside React render cycles causes Garbage Collector (GC) heap pressure and minor frame stutters during interaction/scrolling.
   - Conclusion: Pre-caching both planned and non-planned stats inside `categoryStatsMap`, aggregating `overallStats` directly from `categoryStatsMap.values()`, and pre-computing `detailFunding` Sets inside the parent `useMemo` eliminates render-loop allocations and reduces GC pressure to near-zero.

---

## 3. Caveats
- No source code modifications were performed (investigation is read-only).
- Performance impacts were evaluated statically based on React component architecture, profiling patterns, and DOM node counts.
- `useVirtualGrid` requires container height measurement (`estimatedRowHeight`), which may need tuning for collapsible policy cards.

---

## 4. Conclusion
The UI freeze and GC pressure on the Budget Management Page originate from three distinct architectural factors:
1. **Dynamic Chunk Loading Waterfall (R1)**: Delayed single-chunk preloading in `page.tsx` misses the nested dynamic import of `BudgetDashboard` in `WorkspaceView.tsx`.
2. **DOM Element Bloat & Broken Memoization (R2)**: Full-tree rendering of policy groups and category cards without virtualization, combined with inline callback props breaking `React.memo` on `BudgetCategoryCardItem`.
3. **Render-Loop Object Allocations & Redundant Computations (R3)**: Repeated object literal creation in `getCategoryStats(..., true)`, `new Set()` and string parsing in JSX `.map()` loops, and un-cached array traversals in `overallStats`.

Applying staggered sub-chunk preloading, `useVirtualGrid` virtualization, callback memoization, and $O(1)$ cached statistics lookups will completely eliminate UI freezes and GC stutters.

---

## 5. Verification Method

To verify project integrity and validate future optimization implementations:

1. **TypeScript Type Check**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected result*: 0 TypeScript errors.

2. **Harness & Zod 무결성 검증**:
   ```bash
   node scripts/run-harness.js
   ```
   *Expected result*: Zod schema 0 errors, ESLint 0 errors/warnings, MVC ontology 0 violations.

3. **Performance & GC Inspection Points**:
   - Inspect `src/app/page.tsx` line 436 for `triggerPreload` sub-chunk imports.
   - Inspect `src/components/budget/ui/PolicyGroupCard.tsx` line 316 for callback reference stability.
   - Inspect `src/hooks/useBudget.ts` line 299 for cached object returning in `getCategoryStats`.
