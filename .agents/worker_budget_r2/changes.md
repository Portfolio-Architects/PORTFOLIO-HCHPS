# Changes Report - Milestone 2 Requirement R2 (Real-time Category Balance Highlighting & Filtering Optimization)

## Summary of Changes
Implemented Real-time Category Balance Highlighting, Multi-Criteria Filtering Optimization with 0ms DOM stall via `useDeferredValue`, and Background Tab Animation Pause (AGENTS.md Rule 2-J Compliance) for the budget system.

## Modified & Created Files

1. **`src/hooks/useDocumentVisibility.ts`** (NEW):
   - Implemented custom React hook `useDocumentVisibility` listening to `visibilitychange` events on `document.hidden`.
   - Used across budget components to automatically pause keyframe CSS animations (`animate-shimmer`, `animate-pulse`) when the tab is backgrounded.

2. **`src/hooks/useBudgetFilters.ts`**:
   - Added and exported status helper functions & configs:
     - `getCategoryStatus(usageRate: number, remaining: number): CategoryStatus` (`'OVER'` | `'WARNING'` | `'NORMAL'`)
     - `STATUS_CONFIG` maps status types to badges ('초과/위험', '주의', '정상') and tailwind class combinations (`bg-red-500/20 text-red-400 border border-red-500/30`, `bg-amber-500/20 text-amber-400 border border-amber-500/30`, `bg-emerald-500/20 text-emerald-400 border border-emerald-500/30`).
   - Added extended filter states:
     - `filterMonth`: Month selector ('전체', '1월'~'12월')
     - `filterStatus`: Status selector ('전체', '초과', '주의', '정상')
     - `searchTerm`: Keyword query state
     - `deferredSearchTerm`: Wrapped in `useDeferredValue(searchTerm)` to guarantee 0ms DOM stall / high-frequency keystroke responsiveness.
   - Updated hierarchical filtering logic in `useMemo` to evaluate month matches, status matches, and keyword search matches across policy name, unit name, detailed project name, category name, formation item, stat item, management project, sub-item names/calculations, docRegNum, and expense purpose.
   - Updated `handleSaveFilters` and `handleResetFilters` to persist/clear extended filter state in `localStorage` under key `hchps-budget-filters-v2`.

3. **`src/components/budget/BudgetDashboard.tsx`**:
   - Destructured `filterMonth`, `setFilterMonth`, `filterStatus`, `setFilterStatus`, `searchTerm`, `setSearchTerm`, `deferredSearchTerm` from `useBudgetFilters`.
   - Rendered real-time keyword search bar with search icon (`Search`) and instant clear button (`✕`).
   - Rendered Month (`filterMonth`) and Status (`filterStatus`) selector controls alongside existing multi-select dropdowns.

4. **`src/components/budget/ui/BudgetCategoryCardItem.tsx`**:
   - Integrated `useDocumentVisibility()` to pause `animate-pulse` and `animate-shimmer` keyframes when `document.hidden === true`.
   - Rendered high-contrast status badge ('초과/위험', '주의', '정상') in the category item header.
   - Added explicit category balance callout banners with highlight text (`🚨 [예산 초과/위험]`, `⚠️ [예산 주의]`) when budget usage reaches threshold levels or remaining balance becomes negative.

5. **`src/components/budget/ui/PolicyGroupCard.tsx`**:
   - Integrated `useDocumentVisibility()` to pause `animate-shimmer` keyframes when backgrounded.
   - Computed policy group overall category status via `getCategoryStatus` with explicit `CategoryStatus` typing, and rendered group-level high-contrast status badge in policy group header.

## Verification
- `npx tsc --noEmit` passed with 0 errors.
- `node scripts/run-harness.js` passed all database integrity and ESLint checks with 100% SUCCESS.
