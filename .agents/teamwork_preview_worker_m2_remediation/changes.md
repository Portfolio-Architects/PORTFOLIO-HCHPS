# File Changes Log — Milestone 2 Remediation Worker

## Modified Source & Test Files

1. **`src/components/inventory/InventoryList.tsx`**:
   - **Bug 1 & Bug 2 Fix**: Removed direct `containerRef.current.offsetTop` access from render body. Updated `useVirtualGrid` to compute `containerOffsetTop` inside `updateMetrics()` inside `useEffect()` by calling `containerRef.current.getBoundingClientRect()` relative to `scrollParent`.
   - **Bug 3 Fix**: Replaced unstable `key={rowIndex}` on virtual grid row container `div`s with stable key `key={row[0]?.id || rowIndex}` to eliminate DOM reconciliation thrashing on item deletion or filtering.
   - **Bug 4 Fix**: Created `closeAdjustModal` handler to call `setSelectedItem(null)` when closing the stock adjustment modal, preventing state leaks.
   - **Performance Optimization**: Converted `itemHistoryMap` upfront $O(N)$ calculation over all items into `visibleItemHistoryMap` calculated lazily ONLY for items rendered in `visibleRows`.

2. **`src/components/budget/ui/PolicyGroupCard.tsx`**:
   - **Bug 5 Fix**: Updated `handleSwapCat` to call `updateCategory` ONLY for the 2 swapped categories (`currentCat` at `idx` and `targetCat` at `targetIdx`) instead of calling `updateCategory` for all N categories in `sortedCats`.
   - **Performance Optimization**: Converted `catIds.includes(e.categoryId)` array scan into `catIdSet.has(e.categoryId)` $O(1)$ lookup and pre-parsed `Date.parse(e.date)` timestamps once before `.sort()` to prevent date string parsing thrashing in comparator loop.

3. **`__tests__/challenger-r2-2.test.tsx`**:
   - Added required `color: '#6366f1'` to `mockCats` items and `locked: 0` to `mockGetStats` return value to pass strict TypeScript check.

4. **`__tests__/m2-dom-virtualization.test.tsx`**:
   - Fixed type definitions in test mock objects (`locked`, `color`, `date` instead of `timestamp`).

5. **`PORTFOLIO VITAL - Engineering Report.md` & `AGENTS.md`**:
   - Recorded M2 Remediation patch details in `PORTFOLIO VITAL - Engineering Report.md`.
   - Executed `node scripts/sync-rules.js` to synchronize milestone log into `AGENTS.md`.
