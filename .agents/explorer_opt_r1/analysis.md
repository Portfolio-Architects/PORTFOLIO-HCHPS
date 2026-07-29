# Requirement R1 Analysis Report: Budget Table Inline-Editing & Keyboard Navigation System

## Executive Summary
This report presents a comprehensive, read-only architectural investigation into `src/components/budget/` and `src/hooks/useBudget.ts` for Requirement R1 (Table Inline-Editing & Keyboard Navigation System). 

Currently, budget items (`BudgetCategory`) and expense entries (`BudgetEntry`) rely entirely on modal popups (`CategoryEditModal`, `ExpenseEntryModal`) for edits. There is **no inline cell editing** or **keyboard grid navigation** capability. Implementing Requirement R1 will transform the user experience into an Excel/Spreadsheet-like interface with 0ms typing response time, smooth `Tab`/`Shift+Tab`/`Ctrl+Enter`/`Esc` key controls, zero unnecessary re-renders, and full adherence to backend Zod schema constraints.

---

## 1. Budget Rendering Components in `src/components/budget/`

| Component Path | Primary Responsibilities | Target Inline-Edit Areas |
|---|---|---|
| `BudgetDashboard.tsx` | Main dashboard view container, filter bar (`useBudgetFilters`), 4 summary stat cards, modal states, list of policy groups via `<PolicyGroupCard>` | Toolbar keyboard shortcuts, overall grid container context |
| `ui/PolicyGroupCard.tsx` | Group container for policy projects (`policyName`), detail project summaries (`groupedByDetail`), nested `<BudgetCategoryCardItem>` list, and **Expense Entries Table** (`groupEntries`) | **Expense Entries List/Table** (lines 435–494): Date, Purpose, DocRegNum, Amount |
| `ui/BudgetCategoryCardItem.tsx` | Renders single budget category item (`formationItem`, `statItem`, `totalBudget`), expandable sections for sub-items, general expenses, daily expenses, and funding splits | **Category Header**: Total budget, Stat item name.<br/>**Sub-Items Section**: Sub-item name, calculation expression, amount.<br/>**General/Daily Expense Rows**: Purpose, Amount |
| `ui/LedgerModal.tsx` | T-account double-entry cross-verification modal for commitments (`plannedTasks`), issuances (`issuances`), and settled expenses | Inline settlement amount input (`settleAmount`) |
| `ui/ExpenseEntryModal.tsx` | Modal form dialog for adding/editing expense entries | N/A (Modal popup fallback) |
| `ui/CategoryEditModal.tsx` | Modal form dialog for adding/editing budget categories and sub-items | N/A (Modal popup fallback) |

---

## 2. Current Inline Editing Handling & Editing State Analysis

- **Current Handling**: **Completely Absent**.
  - All edit actions currently require clicking a small `<Pencil size={13} />` button on a card or entry row.
  - Clicking pencil triggers parent state handlers (`openEditCat`, `openEditEntry`), opening a modal dialog (`CategoryEditModal` or `ExpenseEntryModal`).
- **Current Component State**:
  - `BudgetDashboard` tracks modal visibility: `showCatModal`, `catModalInitialData`, `showEntryModal`, `entryModalInitialData`.
  - `PolicyGroupCard` tracks `isOpen` (collapsible accordion) and `showAllEntries` (toggle list length).
  - `BudgetCategoryCardItem` tracks `isExpanded` (accordion expansion).
  - **No cell-level editing state** (`editingCellId`, `editingField`, `editValue`) exists in any component.

---

## 3. Keyboard Navigation (`Tab`, `Shift+Tab`, `Ctrl+Enter`, `Esc`) & Performance Strategy

### A. Core Keyboard Navigation Rules
1. **`Tab` (Forward Navigation)**:
   - Save/commit the current cell value (`onCommit()`).
   - Move focus and inline edit mode to the **next editable cell** in the current row. If at the last column, wrap to the first editable cell of the next row.
   - Must execute `e.preventDefault()` to prevent default browser tab focus jumping out of the table.
2. **`Shift + Tab` (Backward Navigation)**:
   - Save/commit the current cell value (`onCommit()`).
   - Move focus and inline edit mode to the **previous editable cell**.
   - Must execute `e.preventDefault()`.
3. **`Ctrl + Enter` or `Enter` (Save & Deactivate)**:
   - Save/commit the current cell value (`onCommit()`).
   - Exit inline editing mode for the active cell.
4. **`Escape` (Cancel Edit)**:
   - Discard uncommitted changes (restore initial buffered value).
   - Exit inline editing mode immediately without calling `updateEntry` or `updateCategory`.

### B. 0ms Input Delay & 60 FPS Performance Guarantee
To comply with AGENTS.md performance rules (Zero-Stall, 60 FPS, Zero GC spikes):
- **Local Buffered State**: The cell input component (`InlineEditCell`) must maintain its own local state (`const [tempValue, setTempValue] = useState(initialValue)`).
- **Single Commit Mutation**: Do **NOT** invoke `updateEntry` or `updateCategory` on every `onChange` keystroke. React Query mutations (`updateRow` HTTP POST to `/api/data/route.ts`) trigger cache invalidation, recalculations, and tree re-renders. `updateEntry`/`updateCategory` must be called **ONLY** on explicit commit actions (`Blur`, `Tab`, `Ctrl+Enter`).
- **Targeted Component Memoization**:
  - `PolicyGroupCard` uses `React.memo` with custom comparator `arePolicyGroupCardPropsEqual`.
  - `BudgetCategoryCardItem` uses `React.memo` with custom comparator `areBudgetCategoryCardItemPropsEqual`.
  - `InlineEditCell` must also be wrapped in `React.memo` to isolate typing re-renders strictly to the active input DOM node.

---

## 4. Keyboard Event Handling Structure & Focus Management Refs

- **Current Event Structure**: Currently, no keyboard navigation event listeners exist in `src/components/budget/`.
- **Proposed Focus Management Architecture**:
  1. **Data Attribute Identification**: Assign `data-cell-id={`${rowId}:${field}`} ` to every editable table/list cell DOM element.
  2. **Central / Context Grid Manager**:
     - Maintain an active cell state: `activeCell: { rowId: string, field: string } | null`.
     - Maintain an ordered array/matrix of editable cell IDs for each table view.
  3. **Focus Ref Registry**:
     - Use `useRef<Map<string, HTMLInputElement | HTMLElement>>(new Map())` to store DOM element references for fast $O(1)$ focus transfers (`cellRefs.current.get(targetCellId)?.focus()`).

---

## 5. 0ms Input Delay & 60 FPS Optimization Details

1. **Local State Buffer**: Keystrokes ($O(1)$ operation) only update local component state.
2. **Single Commit Mutation**: Async API calls execute once when focus leaves or `Enter`/`Tab` is pressed.
3. **Zero Recalculation Overhead**: In `src/hooks/useBudget.ts`, `categoryStatsMap` is calculated inside `useMemo` in $O(M)$ time. Derived lookups via `getCategoryStats` are $O(1)$ constant time lookups. Typing in an inline cell will not force re-calculation of overall stats until the mutation commits.

---

## 6. Schema & Hook Constraints (Zero Breaking Changes)

- **Hook Interface (`useBudget.ts`)**:
  - `updateCategory(id: string, updates: Partial<BudgetCategory>)`
  - `updateEntry(id: string, updates: Partial<BudgetEntry>)`
  - Both wrappers use TanStack Query mutations (`updateCategoryMut`, `updateEntryMut`), supporting optimistic UI updates.
- **Backend API & Schema (`/api/data/route.ts` & `src/lib/schemas.ts`)**:
  - `POST` endpoint validates data payloads using Zod schemas (`BudgetCategorySchema`, `BudgetEntrySchema`).
  - **Critical Rule**: When committing numeric fields (e.g. `amount`, `totalBudget`), the string value from HTML `<input>` must be sanitized and converted to a valid number (`Number(val.replace(/,/g, ''))`). If an unparsed string or invalid number is sent to `updateEntry`/`updateCategory`, `/api/data/route.ts` Zod validation will log `[Zod Gatekeeper Error]` and fail with HTTP 400.
  - Server-side validation rules in `/api/data/route.ts` (lines 360–473) enforce:
    - `totalBudget` limits vs total usage (`spent + planned`).
    - Sub-item locked checks (`isLocked`).
    - Sub-item amount limits (`subLimit`).
    - Daily expense issuance limits (`dailyExpenseIssued` vs `dailyExpenseSpent`).

---

## Proposed Component Architecture for Implementer

### `InlineEditCell.tsx` Design Blueprint

```tsx
import React, { useState, useEffect, useRef } from 'react';

interface InlineEditCellProps {
  value: string | number;
  type?: 'text' | 'number';
  onSave: (newValue: string | number) => void;
  onNavigate?: (direction: 'next' | 'prev') => void;
  cellId: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  className?: string;
}

export const InlineEditCell = React.memo<InlineEditCellProps>(({
  value,
  type = 'text',
  onSave,
  onNavigate,
  cellId,
  isEditing,
  onStartEdit,
  onCancelEdit,
  className = ''
}) => {
  const [tempValue, setTempValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTempValue(String(value));
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleCommit = () => {
    if (type === 'number') {
      const numVal = Number(tempValue.replace(/,/g, ''));
      if (!isNaN(numVal) && numVal !== value) {
        onSave(numVal);
      }
    } else if (tempValue !== value) {
      onSave(tempValue);
    }
    onCancelEdit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      handleCommit();
      if (onNavigate) onNavigate(e.shiftKey ? 'prev' : 'next');
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || type === 'number' || type === 'text')) {
      e.preventDefault();
      handleCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setTempValue(String(value));
      onCancelEdit();
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        data-cell-id={cellId}
        type="text"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={handleKeyDown}
        className={`px-2 py-1 text-xs border border-indigo-400 rounded outline-none bg-white font-mono shadow-inner ${className}`}
      />
    );
  }

  return (
    <div
      data-cell-id={cellId}
      onDoubleClick={onStartEdit}
      className={`cursor-pointer hover:bg-indigo-50/50 rounded px-1.5 py-0.5 transition-colors ${className}`}
      title="더블클릭하여 빠른 수정"
    >
      {value}
    </div>
  );
});

InlineEditCell.displayName = 'InlineEditCell';
```
