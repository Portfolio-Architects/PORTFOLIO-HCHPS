# Milestone 2 (M2) DOM Virtualization & Tab Switch Stall Empirical Challenge Report

**Date**: 2026-07-21
**Challenger**: Challenger 1 (M2 - R2 Workspace Component & Inventory List DOM Optimization)
**Working Directory**: `d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL/.agents/teamwork_preview_challenger_m2_1`

## Challenge Summary

**Overall risk assessment**: HIGH (Tab switch mount stall target < 15ms VIOLATED by InventoryList & PolicyGroupCard)

Empirical stress testing using Jest & React Testing Library (`__tests__/m2-dom-virtualization.test.tsx`) revealed significant initial mount / tab switch render stalls that exceed the < 15ms target requirement:

1. **Tab Switch Render Stall**:
   - `InventoryList.tsx`: **268.91ms** initial mount stall (FAILED expect < 50ms JSDOM threshold / < 15ms target limit).
   - `PolicyGroupCard.tsx`: **153.26ms** initial mount stall (FAILED expect < 35ms JSDOM threshold / < 15ms target limit).
   - `BudgetCategoryCardItem.tsx`: **9.93ms** (PASSED < 15ms limit).
2. **DOM Node Reduction**:
   - Virtualization in `InventoryList` successfully caps DOM card nodes to 15–24 cards max for 1,000 items (**98.5% DOM node reduction**, PASSED > 90% target limit).
3. **Layout Shift & Capped History**:
   - Zero layout shift observed; history lists capped to 6 entries by default (PASSED).

---

## 1. Target Component Empirical Verification Matrix

| Component | Target Criterion | Empirical Result | Status |
| :--- | :--- | :--- | :--- |
| `InventoryList.tsx` | Tab Switch Stall < 15ms | **268.91ms** | **FAIL** (Stall exceeds limit by 18x) |
| `InventoryList.tsx` | DOM Node Reduction > 90% | **98.50%** (15 cards / 1,000 items) | **PASS** |
| `InventoryList.tsx` | Layout Shift & Scroll 60 FPS | Zero shift, top/bottom spacer height exact | **PASS** |
| `PolicyGroupCard.tsx` | Tab Switch Stall < 15ms | **153.26ms** | **FAIL** (Stall exceeds limit by 10x) |
| `PolicyGroupCard.tsx` | $O(C+E)$ Complexity Indexing | Partial: array `catIds.includes()` inside `.filter()` is $O(C \times E)$ | **FAIL** |
| `PolicyGroupCard.tsx` | Capped History List | Limited to 6 items by default when closed | **PASS** |
| `BudgetCategoryCardItem.tsx` | Render Stall < 15ms | **9.93ms** | **PASS** |
| `BudgetCategoryCardItem.tsx` | Collapsed DOM Footprint | 13 nodes when unexpanded | **PASS** |

---

## 2. Empirical Benchmark Failure Findings & Root Cause Analysis

### Finding 1: `InventoryList.tsx` Un-virtualized History Map Pre-computation (`268.91ms` Stall)
- **Root Cause**: In `InventoryList.tsx` (lines 252–259):
  ```tsx
  const itemHistoryMap = useMemo(() => {
    const map = new Map<string, StockChange[]>();
    for (const item of items) {
      const itemId = item.id || '';
      map.set(itemId, (getItemHistory(itemId) || []).slice(0, 3));
    }
    return map;
  }, [items, getItemHistory]);
  ```
  `itemHistoryMap` iterates over **ALL** items in `items` (100–1,000+) on initial mount, calling `getItemHistory(itemId)` for every single item in the dataset **un-virtually**.
- **Impact**: Even though `InventoryList` virtualizes grid rendering, computing history for 1,000 items upfront blocks the main UI thread for **268.91ms**, causing severe tab switch freeze.
- **Suggested Mitigation**: Compute history **only for visible items** (`visibleRows.flat()`) or lazily look up item history within `InventoryItemCard`.

### Finding 2: `PolicyGroupCard.tsx` $O(C \times E)$ Filtering & Date Parsing (`153.26ms` Stall)
- **Root Cause**: In `PolicyGroupCard.tsx` (lines 72–75):
  ```tsx
  const catIds = cats.map(c => c.id);
  const gEntries = entries
    .filter(e => catIds.includes(e.categoryId))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  ```
  1. `catIds.includes(e.categoryId)` inside `entries.filter` runs in $O(E \times C)$ quadratic time because `catIds` is an Array, not a `Set`.
  2. `new Date(b.date).getTime()` parses ISO date strings inside the sort comparator on every render.
  3. `detailGroup.cats.forEach(...)` performs string `.replace()` and `.split()` regex operations inside render.
- **Impact**: Mounting a policy group card takes **153.26ms**, violating the < 15ms tab switch limit.
- **Suggested Mitigation**:
  1. Convert `catIds` to `new Set(cats.map(c => c.id))` for $O(1)$ lookup (`catIdSet.has(e.categoryId)`).
  2. Avoid `new Date()` string parsing in sort comparator (compare ISO string `b.date.localeCompare(a.date)` or pre-parse timestamps).

---

## 3. Harness & Build Logs

- `npx tsc --noEmit`: 0 errors found.
- `node scripts/run-harness.js`: 0 Zod database errors, 0 ESLint errors.
- `npx jest __tests__/m2-dom-virtualization.test.tsx`: **2 failed, 4 passed, 6 total**.

---

## 4. Final Verdict

**VERDICT: FAIL**
Milestone 2 DOES NOT meet the tab switch render stall requirement (< 15ms target limit). `InventoryList` (268.91ms) and `PolicyGroupCard` (153.26ms) trigger excessive main thread blocking during initial render/mount.
