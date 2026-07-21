# Adversarial Challenge Report — Milestone 2 (R2 Workspace Component & Inventory List DOM Optimization)

## Challenge Summary

**Overall risk assessment**: **HIGH** / **FAIL**

Empirical testing and static/harness verification revealed critical bugs and React anti-patterns in `InventoryList.tsx` and performance bottlenecks in `PolicyGroupCard.tsx`:
1. **ESLint / React Compiler Rule Violation (`react-hooks/refs`)**: Accessing `containerRef.current` during render in `InventoryList.tsx` fails `node scripts/run-harness.js` lint verification (3 ESLint errors).
2. **Incorrect Scroll Offset in `useVirtualGrid`**: `containerRef.current?.offsetTop` measures distance relative to `offsetParent` instead of the scroll container, breaking virtualization scroll top when components are nested inside relative container layout elements.
3. **Stale Scroll Listener Registration**: `scrollParent` is captured once on mount without re-binding if `#main-scroll-container` is mounted asynchronously or dynamically.
4. **DOM Row Key Index Shift (`key={rowIndex}`)**: Index-based row keys cause DOM reconciliation thrashing during item deletion, search filtering, and fast scrolling.
5. **Stale Modal State Retention**: `handleAdjust` leaves `selectedItem` populated after closing the stock adjustment modal.
6. **Collapsed Policy Group Computation & Over-fetching Mutations**: `PolicyGroupCard` runs heavy date sorting and set operations even when collapsed, and `handleSwapCat` fires N mutation requests instead of 2.

---

## Challenges

### [High] Challenge 1: React Compiler & Lint Failure in `useVirtualGrid` (`react-hooks/refs`)

- **Assumption challenged**: `containerRef.current?.offsetTop` can be accessed directly in the body of `useVirtualGrid` during render.
- **Attack scenario**: `node scripts/run-harness.js` executes ESLint rules. ESLint flags 3 errors: `Error: Cannot access refs during render (react-hooks/refs)` at lines 65 and 66 of `InventoryList.tsx`. Accessing refs during render breaks React Concurrent Mode guarantees and causes unpredictable UI updates.
- **Blast radius**: Fails CI gatekeeper build (`run-harness.js`). Potential React 19 concurrent hydration/render failures.
- **Mitigation**: Move `offsetTop` reading inside `handleScroll` event listener or a state/effect callback, or calculate offset relative to scroll container dynamically via `getBoundingClientRect()`.

---

### [High] Challenge 2: Virtualization Offset Miscalculation in Nested Layouts

- **Assumption challenged**: `containerRef.current.offsetTop` accurately reflects the scroll offset of `InventoryList` relative to `window.scrollY` or `#main-scroll-container`.
- **Attack scenario**: Place `InventoryList` inside a flex container or tab panel with `position: relative`. `HTMLElement.offsetTop` returns `0` relative to the tab panel, while `scrollTop` is 1000px. `relativeScrollTop` is calculated as `Math.max(0, 1000 - 0) = 1000px`, miscalculating `startRowIndex` prematurely and causing visible top items to unmount or blank out while scrolling.
- **Blast radius**: Broken list rendering, blank whitespace during scroll, incorrect item row visibility.
- **Mitigation**: Calculate container top offset using `containerRef.current.getBoundingClientRect().top + scrollTop` inside `handleScroll`.

---

### [Medium] Challenge 3: Stale Listener Registration in `useVirtualGrid`

- **Assumption challenged**: `#main-scroll-container` is always present in the DOM when `useVirtualGrid` mounts.
- **Attack scenario**: If `InventoryList` mounts inside a tab before `#main-scroll-container` is attached or if `#main-scroll-container` is dynamically rendered, `scrollParent` resolves to `window`. The empty `useEffect` dependency array `[]` prevents re-attaching event listeners when `#main-scroll-container` appears.
- **Blast radius**: Scrolling inside `#main-scroll-container` fails to update `scrollTop`, freezing the virtual grid in place.
- **Mitigation**: Re-evaluate scroll container on scroll/resize or accept a scroll container selector/ref in dependencies.

---

### [Medium] Challenge 4: DOM Node Reconciliation Shift on Row Keys (`key={rowIndex}`)

- **Assumption challenged**: Using `key={rowIndex}` for virtual grid rows in `visibleRows.map` is safe during item deletion and filtering.
- **Attack scenario**: User scrolls to row 3 and deletes an item. Slicing shifts all subsequent items across rows. Because row keys remain `0, 1, 2, ...`, React reuses row `<div>` DOM nodes, forcing item cards to be re-parented into old row containers during rapid scroll or live CRUD.
- **Blast radius**: Visual flicker, broken CSS transitions, loss of focused state on modified inventory items.
- **Mitigation**: Construct stable row keys based on the first item ID in each row (e.g. `key={row[0]?.id || rowIndex}`).

---

### [Low] Challenge 5: Stale Modal State Retention in `InventoryList`

- **Assumption challenged**: `selectedItem` state is cleared when stock adjustment modal closes.
- **Attack scenario**: `handleAdjust` calls `setShowAdjustModal(false)` but omits `setSelectedItem(null)`. `selectedItem` remains retained in state pointing to stale pre-adjusted item data.
- **Blast radius**: Memory leak of deleted item references, unexpected behavior if modal is re-opened without item parameter.
- **Mitigation**: Add `setSelectedItem(null)` to `handleAdjust` and modal close handlers.

---

### [Medium] Challenge 6: Aggregation Overhead in Collapsed Cards & O(N) Swap Mutations (`PolicyGroupCard.tsx`)

- **Assumption challenged**: Collapsed `PolicyGroupCard` components do not impact rendering performance.
- **Attack scenario**: `PolicyGroupCard` runs `useMemo` for date sorting and category map indexing regardless of `isOpen` state. When budget entries change anywhere in the app, every collapsed policy card re-executes array filter and sort functions. Furthermore, `handleSwapCat` executes `updateCategory` for ALL categories in `sortedCats` instead of only the 2 swapped categories.
- **Blast radius**: UI lag during expense edits when multiple policy groups are rendered; excessive API/KV sync calls on category reordering.
- **Mitigation**: Guard heavy aggregations inside `isOpen` check or split metadata calculation; optimize `handleSwapCat` to update only `idx` and `targetIdx`.

---

## Stress Test Results

| Scenario | Expected Behavior | Actual Behavior | Result |
| text | text | text | text |
| Harness Verification (`node scripts/run-harness.js`) | 0 ESLint errors | 3 ESLint errors (`react-hooks/refs` in `InventoryList.tsx:65,66`) | **FAIL** |
| TypeScript Compiler (`npx tsc --noEmit`) | Clean build | Clean build (0 errors) | **PASS** |
| Nested Container Virtualization Scroll | Items render smoothly at correct scroll position | `offsetTop` miscalculates relative scroll top if container is nested in relative element | **FAIL** |
| Item Deletion during Active Scroll | Smooth shift of remaining items | Row key `key={rowIndex}` reuses DOM row wrappers, causing node re-parenting shift | **FAIL** |
| Category Order Swap (`handleSwapCat`) | Swaps 2 category order indices | Calls `updateCategory` N times for all items in group | **FAIL** |
| Stock Adjustment Modal Close | Reset state completely | `selectedItem` retained in memory | **FAIL** |

---

## Unchallenged Areas

- Zod schema definitions (`schemas.ts`): Fully validated and passing DB integrity test.
- Basic budget category card stats rendering (`getCategoryStats` accuracy): Logic works as intended for standard entry calculations.
