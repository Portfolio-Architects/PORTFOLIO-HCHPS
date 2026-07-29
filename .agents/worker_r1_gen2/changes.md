# Implementation Changes Report - Requirement R1 (Table Inline-Editing & Keyboard Navigation)

## Summary of Changes

### 1. `InlineEditCell.tsx` (`src/components/budget/ui/InlineEditCell.tsx`)
- **Local Buffered State & State Sync**: Uses `tempValue` state managed locally inside `React.memo` component, buffering user keystrokes without firing network requests or parent component re-renders (0ms input delay / 60 FPS). Synchronizes `tempValue` with `value` prop updates during render via `useState(value)` comparison (`prevValue !== value`), avoiding `react-hooks/set-state-in-effect` and ref mutation during render.
- **Keyboard Event Handling**:
  - `Tab` / `Shift+Tab`: Commits buffered change via `handleCommit()`, calls `e.preventDefault()`, and triggers `onNavigate('next' | 'prev')` to move edit mode to adjacent cells in the table sequence.
  - `Enter` / `Ctrl+Enter`: Commits buffered change via `handleCommit()`, calls `e.preventDefault()`, and exits cell edit mode.
  - `Esc`: Cancels editing, restores original cell value, calls `e.preventDefault()`, and exits edit mode.
- **Safe Number Parsing**: Removes formatting commas (`tempValue.replace(/,/g, '').trim()`), converts to number, and validates with `!isNaN(numVal)` before invoking `onSave`.

### 2. `PolicyGroupCard.tsx` (`src/components/budget/ui/PolicyGroupCard.tsx`)
- **Direct Cell Editing**:
  - Integrated `InlineEditCell` into budget expense entries table rows for `date`, `docRegNum`, `purpose`, and `amount` fields.
  - Number parsing: `Number(String(newVal).replace(/,/g, '').trim())` executed prior to invoking `updateEntry`.
- **Keyboard Navigation Sequence**:
  - Computes `entryCellIdList` memoized across all visible entries (`${entry.id}:date`, `${entry.id}:docRegNum`, `${entry.id}:purpose`, `${entry.id}:amount`).
  - `handleCellNavigate` moves focus sequentially through entry cells on `Tab` / `Shift+Tab`.
- **Prop Forwarding**:
  - Forwards `updateCategory` and `updateEntry` down to `BudgetCategoryCardItem` instances.

### 3. `BudgetCategoryCardItem.tsx` (`src/components/budget/ui/BudgetCategoryCardItem.tsx`)
- **Direct Cell Editing**:
  - Category header `statItem` (text input -> `updateCategory(cat.id, { statItem })`).
  - Total category budget `totalBudget` (number input -> `updateCategory(cat.id, { totalBudget })`).
  - Sub-items `name` & `amount` (sub-item inline edit -> `handleSubItemUpdate` with comma-stripped number parsing).
- **Keyboard Navigation**:
  - `cellIdList` includes `${cat.id}:statItem`, `${cat.id}:totalBudget`, and `${cat.id}:sub:${idx}:name` / `${cat.id}:sub:${idx}:amount`.
  - `handleCellNavigate` navigates across category & sub-item editable cells.

## Verification
- `npx tsc --noEmit`: PASS (0 errors)
- `npx eslint src/components/budget/ui/InlineEditCell.tsx src/components/budget/ui/BudgetCategoryCardItem.tsx src/components/budget/ui/PolicyGroupCard.tsx`: PASS (0 errors, 0 warnings)
- `node scripts/run-harness.js`: PASS (0 Zod schema errors)
