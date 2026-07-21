# Synthesis Report — Milestone 2: Workspace Component & Inventory List DOM Optimization

## 1. Consensus & Strategy Overview

### Problem Statement
Switching tabs to the Workspace module or navigating between Inventory and Budget views was causing a **246ms to 500ms DOM render stall**.
- **InventoryList**: Rendered all items simultaneously in a 3-column CSS Grid without windowing (~18,000 DOM nodes for 1,000 items).
- **BudgetDashboard / PolicyGroupCard**: Rendered 120+ category cards with `max-h-[25000px]` and `max-h-[8000px]` layout-thrashing transitions (~8,200 DOM nodes simultaneously mounted even when collapsed), with inline `.sort()` and `.filter()` operations inside JSX.

### Concrete Solutions

#### Component 1: `src/components/inventory/InventoryList.tsx`
- Implement responsive row chunking based on screen width (1 col mobile, 2 cols tablet, 3 cols desktop).
- Add lightweight, zero-dependency `useVirtualGrid` hook to track scroll position on `#main-scroll-container` and render only visible viewport rows + 2 buffer rows.
- Use top/bottom spacer `<div>` blocks (`style={{ height: topPadding }}`) to preserve exact scroll height.
- Wrap `InventoryItemCard` in `React.memo`.
- **Impact**: Reduces DOM node count by **97.8%** (from ~18,000 to ~360 nodes), mount time from ~400ms to **< 10ms**.

#### Component 2: `src/components/budget/ui/BudgetCategoryCardItem.tsx` (New File)
- Extract inline category card rendering into a standalone `BudgetCategoryCardItem` component wrapped in `React.memo`.
- Pre-filter and sort category entries (`generalEntries`, `dailyExpenseEntries`, `totalIssuance`, etc.) inside `useMemo` hooks.
- Render detailed expanded panel conditionally (`isExpanded && <ExpandedContent />`) so collapsed cards take zero extra DOM node overhead.

#### Component 3: `src/components/budget/ui/PolicyGroupCard.tsx`
- Refactor to import and use `BudgetCategoryCardItem`.
- Replace layout-thrashing `max-h-[25000px]` and `max-h-[8000px]` CSS classes with clean CSS Grid height transitions or conditional rendering.
- Pre-compute array sorts (`groupEntries`, `groupedByDetail`) using `useMemo`.
