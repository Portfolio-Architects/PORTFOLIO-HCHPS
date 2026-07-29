# Budget Management UI/UX Analysis Report (Requirement R2)

**Working Directory**: `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_opt_r2`  
**Target Subsystem**: `src/components/budget/` & `src/hooks/useBudget.ts` / `src/hooks/useBudgetFilters.ts`  
**Objective**: Real-time Category Balance Highlighting & Filtering Optimization (0ms DOM Stall, 60 FPS Reactivity, Zero-Stall & Background Tab Pause Compliance).

---

## 1. Executive Summary & Architecture Overview

The Budget Management module follows the project's modified FSD (Feature-Sliced Design) and MVC architecture:
- **Model / Data Layer**: Managed via TanStack Query in `src/hooks/useBudget.ts`, backed by `readSheet`/`addRow`/`updateRow`/`deleteRow`/`replaceAll` from `@/lib/sheets-api` targeting local PC disk storage (`data/*.json`). `localStorage` acts as a fallback cache.
- **Controller / Filter Layer**: `src/hooks/useBudgetFilters.ts` handles hierarchical cascading multi-select filters and policy group aggregations.
- **View / UI Layer**: `src/components/budget/BudgetDashboard.tsx` orchestrates the top risk alert banner, hierarchical filter bar, 4 summary stat cards, virtualized policy group cards (`PolicyGroupCard.tsx`), and category item rows (`BudgetCategoryCardItem.tsx`), alongside modal dialogs (`ExpenseEntryModal`, `CategoryEditModal`, `BatchEditModal`, `LedgerModal`, `DailyExpenseStatModal`).

---

## 2. Current Implementation Analysis

### 2.1 Category Balances, Budget Limits, & Actual Execution Computation (`useBudget.ts`)

#### A. Category Stats Calculation (`categoryStatsMap` in `useBudget.ts`)
- **Grouping Strategy**: Entries are grouped by `categoryId` in $O(M)$ time using an internal `entriesMap` (`Map<string, BudgetEntry[]>`) to prevent $O(N \times M)$ iteration overhead across unique categories.
- **Entry Action Type Breakdown**:
  - `isPlanned && !isSettled`: Accumulated into `planned` amount (encumbered budget / 품의 금액).
  - `general`, `correction`, `transfer`: Accumulated into `generalSpent`.
    - If `actionType === 'transfer'`: `transferDirection === 'out'` adds to `generalSpent`; `transferDirection === 'in'` subtracts.
  - `issuance`: Accumulated into `dailyExpenseIssued` (일상경비 교부액).
  - `daily_expense`: Accumulated into `dailyExpenseSpent` (일상경비 실지출액).
- **Aggregate Formulas**:
  - `spent` = `generalSpent + dailyExpenseIssued`
  - `lockedAmount`: Sum of sub-item / calculation amounts marked with `isLocked === true`.
  - `remaining` (Standard, including planned) = `totalBudget - spent - planned - lockedAmount`.
  - `remainingExclude` (Exclude planned) = `totalBudget - spent - lockedAmount`.
  - `dailyExpenseRemaining` = `dailyExpenseIssued - dailyExpenseSpent`.
  - `usageRate` (Standard) = `totalBudget > 0 ? ((spent + planned) / totalBudget) * 100 : 0`.
  - `usageRateExclude` = `totalBudget > 0 ? (spent / totalBudget) * 100 : 0`.

#### B. Budget Limit Validation (`checkLimit` in `useBudget.ts`)
- **Daily Expense Guard**: Ensures `delta <= stats.dailyExpenseRemaining`. Blocks execution with `alert()` if exceeded.
- **General Budget Guard**:
  - For planned entries (`isPlanned === true`): Ensures `delta <= stats.remaining`.
  - For actual entries (`isPlanned === false`): Ensures `delta <= (totalBudget - spent - locked)`.
  - Blocks execution with `alert()` if budget limit is exceeded.

#### C. Overall Summary Totals (`overallStats` & `overallStatsActual`)
- Computed via `useMemo` by iterating over `categoryStatsMap.values()` in $O(K)$ time ($K$ = number of unique categories).

---

### 2.2 Category Color Badges, Status Indicators, & Highlight Animations

#### A. Category Color Badges
- **Policy Group Level (`PolicyGroupCard.tsx:269-270`)**: Renders a 40x40px icon box with `cats[0]?.color` (with 15% opacity background) and a 12x12px colored dot indicator.
- **Category Item Level (`BudgetCategoryCardItem.tsx:154`)**: Renders a 10x10px pulsing colored dot (`animate-pulse`) using `cat.color || '#4A6CF7'`.

#### B. Status Indicators (Usage Rate Thresholds)
- Currently implemented via usage rate percentage thresholds in progress bars:
  - **Over Budget / High Risk ($\ge 95\%$)**: `bg-gradient-to-r from-red-500 to-rose-600` (Policy Group) / `from-red-500 to-rose-500` (Category Item).
  - **Caution ($\ge 80\%$)**: `bg-gradient-to-r from-amber-400 to-amber-600` / `from-amber-400 to-amber-500`.
  - **Normal ($< 80\%$)**: `bg-gradient-to-r from-blue-500 to-indigo-600` / `from-blue-500 to-indigo-500`.
- **Risk Alert Widget (`BudgetDashboard.tsx:181-189`)**: Top banner evaluating 2 risk conditions:
  1. Q3/Q4 Under-execution: `currentMonth >= 9 && st.usageRate < 70` -> "3분기 집행률 70% 미만".
  2. Year-End Imminent Remaining: `currentMonth >= 11 && (st.remaining / st.totalBudget) >= 0.1` -> "회계연도 마감 임박 (가용 잔액 10% 초과)".

#### C. Highlight Animations
- **Shimmer Effect**: Progress bars inside `PolicyGroupCard.tsx:314` and `BudgetCategoryCardItem.tsx:205` use an absolute positioned overlay with class `animate-shimmer` (`backgroundSize: '200% 100%'`).
- **Pulsing Dot**: Category dots use `animate-pulse` in `BudgetCategoryCardItem.tsx:154`.

---

### 2.3 Filtering Architecture (`useBudgetFilters.ts` & `MultiSelectDropdown.tsx`)

#### A. Current Filter State & Options
- Maintains 4 hierarchical array states:
  - `filterPolicy` (정책사업명)
  - `filterUnit` (단위사업명)
  - `filterDetail` (세부사업명)
  - `filterStat` (통계목)
- Persisted in `localStorage['hchps-budget-filters-v2']`.

#### B. Hierarchical Filtering Flow
1. Converts state arrays into `Set` instances (`policySet`, `unitSet`, `detailSet`, `statSet`) for $O(1)$ lookup inside `useMemo`.
2. Iterates through `categories`:
   - Computes matching boolean flags (`pMatch`, `uMatch`, `dMatch`, `sMatch`).
   - Aggregates option totals (`policySums`, `unitSums`, `detailSums`, `statSums`) to populate suffix amounts in dropdowns (e.g. `20,000,000원`).
   - Pushes matching categories into `filteredCategoriesTree`.
3. Groups `filteredCategoriesTree` by `policyProject` into `groupedByPolicy`.
4. Computes `filteredStats` dynamically by summing stats of categories in `filteredCategoriesTree`.

---

## 3. Performance & 0ms DOM Stall Analysis

### 3.1 Rerender & Virtualization Audit

1. **Virtualization in `BudgetDashboard.tsx`**:
   - Uses `useVirtualList` for policy groups when `groupedByPolicy.length > 4`.
   - **Height Assumption Issue**: Sets fixed `itemHeight: 220`. However, a `PolicyGroupCard`'s height varies depending on whether it is expanded, how many sub-detail groups it contains, and how many expenditure entries are shown.
2. **Virtualization in `PolicyGroupCard.tsx`**:
   - Uses `useVirtualList` for detailed project groups when `groupedByDetail.length > 3` with `itemHeight: 200`.
3. **`React.memo` Comparison Flaw in `PolicyGroupCard.tsx`**:
   - `arePolicyGroupCardPropsEqual` compares callback props and category/entry array contents.
   - **Gap**: It does NOT compare `getCategoryStats` evaluation outputs or stats object values! Because `getCategoryStats` function identity is recreated whenever `categoryStatsMap` updates in `useBudget.ts`, `prevProps.getCategoryStats === nextProps.getCategoryStats` evaluates to `false`, causing unnecessary full rerenders of `PolicyGroupCard` components whenever any single budget entry changes elsewhere.

### 3.2 Filtering Reactivity
- Filtering currently recalculates synchronously on every dropdown click.
- For large category trees (> 100 items with many entries), synchronous filtering during fast dropdown selection or search keying can block the main thread for > 16ms (causing frame drop).

---

## 4. Background Tab Pause & Visibility Standards Compliance (AGENTS.md Rule 2-J)

### 4.1 React Query Configuration
- In `useBudget.ts`:
  - `refetchOnWindowFocus: false`
  - `refetchIntervalInBackground: false`
  - Fully compliant with Rule 2-J (no background polling while tab is unfocused).

### 4.2 CSS Keyframe Animations Audit
- `animate-shimmer` and `animate-pulse` in `PolicyGroupCard.tsx` and `BudgetCategoryCardItem.tsx` currently run continuously regardless of `document.hidden` status.
- **Violation Risk**: Active keyframe animations on unfocused tabs keep the browser compositor thread active and increase idle power/CPU consumption.
- **Resolution Strategy**: Integrate `useDocumentVisibility()` or visibility CSS guard (`document.hidden ? 'animate-none' : 'animate-shimmer'`) to pause all CSS animations when tab is hidden.

---

## 5. Gap Analysis & Proposed Optimization Strategy for Requirement R2

### 5.1 Requirement R2 Gaps & Target Features

| Feature | Current State | Required R2 Target |
|---|---|---|
| **Category Status Badges** | Only visual progress bar color | Explicit status badges (**"초과" [Red], "주의" [Amber], "정상" [Green]**) with exact remaining balance highlight |
| **Monthly Filter** | Not implemented (All entries shown) | Add **Monthly Filter (1월 ~ 12월 & 전체)** to filter budget entries by execution month |
| **Status Filter** | Not implemented | Add **Status Filter (전체, 초과/위험, 주의, 정상)** to isolate high-risk categories |
| **Search Filter** | Not implemented | Add **Search Keyword Input** for instant search by category name, detailed project, or stat item |
| **Reactivity & 0ms Stall** | Synchronous filtering | Wrap search & filter updates in **`useDeferredValue`** / memoized lookups for 60 FPS guaranteed typing |
| **Visibility Pause** | React Query background fetch paused | Add **`useDocumentVisibility`** guard to pause progress bar `animate-shimmer` and `animate-pulse` on hidden tab |

---

## 6. Detailed Implementation Strategy Blueprint

### 6.1 Category Status Classification Logic

Define status helper in `src/types/budget.ts` or `src/hooks/useBudgetFilters.ts`:
```ts
export type CategoryStatus = 'OVER' | 'WARNING' | 'NORMAL';

export function getCategoryStatus(usageRate: number, remaining: number): CategoryStatus {
  if (usageRate >= 95 || remaining < 0) return 'OVER';
  if (usageRate >= 80) return 'WARNING';
  return 'NORMAL';
}

export const STATUS_CONFIG: Record<CategoryStatus, { label: string; badgeClass: string; borderClass: string; textClass: string }> = {
  OVER: { label: '초과/위험', badgeClass: 'bg-red-500/10 text-red-600 border-red-200', borderClass: 'border-red-300', textClass: 'text-red-600' },
  WARNING: { label: '주의', badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-200', borderClass: 'border-amber-300', textClass: 'text-amber-600' },
  NORMAL: { label: '정상', badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', borderClass: 'border-emerald-300', textClass: 'text-emerald-600' },
};
```

### 6.2 Filter Expansion in `useBudgetFilters.ts`

Expand `useBudgetFilters` signature and state:
- `filterMonth`: `number | 'ALL'` (1~12 or ALL)
- `filterStatus`: `'ALL' | 'OVER' | 'WARNING' | 'NORMAL'`
- `searchTerm`: `string` (deferred with `useDeferredValue(searchTerm)`)

```ts
// Enhanced Filtering Loop with O(1) Sets & Deferred Reactivity
const deferredSearch = useDeferredValue(searchTerm);

const filteredCategoriesTree = useMemo(() => {
  const normalizedQuery = deferredSearch.trim().toLowerCase();
  
  return categories.filter(c => {
    // 1. Hierarchical Match
    if (policySet.size > 0 && !policySet.has(c.policyProject || '')) return false;
    if (unitSet.size > 0 && !unitSet.has(c.unitProject || '')) return false;
    if (detailSet.size > 0 && !detailSet.has(c.detailedProject || '')) return false;
    if (statSet.size > 0 && !statSet.has(c.statItem || '')) return false;

    // 2. Status Match
    const st = getCategoryStats(c.id);
    if (!st) return false;
    const status = getCategoryStatus(st.usageRate, st.remaining);
    if (filterStatus !== 'ALL' && status !== filterStatus) return false;

    // 3. Search Match
    if (normalizedQuery) {
      const matchName = c.name?.toLowerCase().includes(normalizedQuery);
      const matchDetail = c.detailedProject?.toLowerCase().includes(normalizedQuery);
      const matchStat = c.statItem?.toLowerCase().includes(normalizedQuery);
      const matchManagement = c.managementProject?.toLowerCase().includes(normalizedQuery);
      if (!matchName && !matchDetail && !matchStat && !matchManagement) return false;
    }

    return true;
  });
}, [categories, policySet, unitSet, detailSet, statSet, filterStatus, deferredSearch, getCategoryStats]);
```

### 6.3 Background Tab Pause Guard (`useDocumentVisibility`)

Create lightweight hook or inline tab listener:
```ts
export function useDocumentVisibility() {
  const [isVisible, setIsVisible] = useState(
    typeof document !== 'undefined' ? !document.hidden : true
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return isVisible;
}
```
Apply to CSS animation classes in `PolicyGroupCard.tsx` and `BudgetCategoryCardItem.tsx`:
```tsx
const isTabVisible = useDocumentVisibility();

// Inside progress bar shimmer div:
<div className={`absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent ${isTabVisible ? 'animate-shimmer' : ''}`} style={{ backgroundSize: '200% 100%' }} />

// Inside category dot:
<div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isTabVisible ? 'animate-pulse' : ''}`} style={{ backgroundColor: cat.color || '#4A6CF7' }} />
```

### 6.4 `React.memo` Prop Equality Refinement

Update `arePolicyGroupCardPropsEqual` and `areBudgetCategoryCardItemPropsEqual` to compare evaluated category stats (`totalBudget`, `spent`, `planned`, `remaining`, `usageRate`) rather than function identity of `getCategoryStats`.

---

## 7. Verification Method

1. **TypeScript Build Check**: `npx tsc --noEmit`
2. **Harness Verification**: `node scripts/run-harness.js` (Verify 0 Zod errors, 0 ESLint errors/warnings, 0 MVC violations)
3. **DOM Stall Benchmark**: Profile UI filter/search interaction with 60 FPS performance monitoring tool.
4. **Visibility Pause Verification**: Toggle browser tab visibility (`document.hidden = true`) and verify CSS shimmer/pulse animations pause completely.
