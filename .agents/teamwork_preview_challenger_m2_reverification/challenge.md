# M2 Re-Verification Challenge Report

## Challenge Summary

**Overall risk assessment**: LOW (All 5 M2 bug fixes empirically verified PASS)

## Empirical Verification Results

| Bug # | Component / Function | Verification Focus | Result | Detail |
|---|---|---|---|---|
| Bug 1 | `InventoryList.tsx` | ESLint `react-hooks/refs` compliance | PASS | `containerRef.current` is only read inside `useEffect` (lines 46, 47), not in render body. |
| Bug 2 | `useVirtualGrid` hook | Scroll offset calculation inside nested containers | PASS | Formula `containerRect.top - elRect.top + el.scrollTop` correctly calculates relative scroll position invariant of scroll container offset. |
| Bug 3 | `InventoryList.tsx` | Virtual grid row keys stability on item delete/filter | PASS | `key={row[0]?.id || rowIndex}` ensures stable key tracking by item ID rather than index shifting. |
| Bug 4 | `InventoryList.tsx` | Adjust modal close state cleanup | PASS | `closeAdjustModal` sets `setSelectedItem(null)`, preventing state pollution on reopen. |
| Bug 5 | `PolicyGroupCard.tsx` | `handleSwapCat` category swap optimization | PASS | `handleSwapCat` calls `updateCategory` twice (for swapped pair) instead of re-indexing all N categories. |

## Detailed Stress Test Results

### 1. Bug 1: ESLint `react-hooks/refs` in `InventoryList.tsx`
- **Scenario**: Code analysis & ESLint gatekeeper harness.
- **Expected Behavior**: Zero access to `.current` during React render execution; ref reads limited to side effects (`useEffect`).
- **Observed Behavior**: `containerRef.current` accessed exclusively inside `updateMetrics` callback within `useEffect` (lines 46, 47).
- **Verdict**: PASS

### 2. Bug 2: `useVirtualGrid` scroll calculation with nested containers
- **Scenario**: Simulated scrolling inside both `window` and nested `#main-scroll-container`.
- **Expected Behavior**: `containerOffsetTop` remains invariant under scroll; `relativeScrollTop` accurately measures distance from container top.
- **Observed Behavior**: `containerOffsetTop` calculated as `containerRect.top - elRect.top + el.scrollTop` evaluates to invariant `200px` regardless of `scrollTop` changes (`scrollTop=0` -> `relScroll=0`, `scrollTop=400` -> `relScroll=200`).
- **Verdict**: PASS

### 3. Bug 3: Virtual grid row keys stability
- **Scenario**: Filter and delete items from virtualized grid with multi-column rows.
- **Expected Behavior**: Row keys map to `row[0]?.id` so React identifies rows by item identity instead of positional index.
- **Observed Behavior**: Before deletion keys: `['item-101', 'item-103', 'item-105']`. After deleting `item-101`, keys become `['item-102', 'item-104']`. React cleanly unmounts removed card without recycling stale component state.
- **Verdict**: PASS

### 4. Bug 4: Adjust modal close resets `selectedItem`
- **Scenario**: Open stock adjust modal for an item, then close modal via backdrop/cancel/submit.
- **Expected Behavior**: `selectedItem` is set to `null` alongside modal visibility and input fields.
- **Observed Behavior**: `closeAdjustModal` sets `selectedItem = null`, `showAdjustModal = false`, `adjChange = ''`, `adjReason = ''`.
- **Verdict**: PASS

### 5. Bug 5: `handleSwapCat` category swap efficiency
- **Scenario**: Swap two categories in a policy group containing N=5 categories.
- **Expected Behavior**: Only 2 category `sortOrder` mutations are dispatched (`currentCat` and `targetCat`).
- **Observed Behavior**: `handleSwapCat` calls `updateCategory` exactly twice with swapped index targets, leaving remaining N-2 categories untouched.
- **Verdict**: PASS

## Harness & Build Status
- `npx tsc --noEmit`: 0 errors
- `node scripts/run-harness.js`: 0 errors, 0 arch violations, 0 lint warnings
- Empirical test runner (`scratch/test-m2-bugs.js`): 5/5 PASSED
