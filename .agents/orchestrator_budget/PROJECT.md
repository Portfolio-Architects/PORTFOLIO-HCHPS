# Project: Budget Management UI/UX Overhaul

## Architecture Overview
The Budget Management system is located in `src/components/budget/` and powered by custom hooks in `src/hooks/useBudget.ts`. Data API persistence is provided by `src/app/api/data/route.ts` backing local JSON storage.

### Core Component Structure (Target Areas)
- `src/components/budget/`: Budget management components.
  - Budget overview table / grid (`BudgetDashboard.tsx`, `PolicyGroupCard.tsx`, `BudgetCategoryCardItem.tsx`)
  - Category balance displays
  - Expense entry modals (`ExpenseEntryModal.tsx`, `LedgerModal.tsx`, `BatchEditModal.tsx`)
  - Inline edit component (`InlineEditCell.tsx`)
- `src/hooks/useBudget.ts`: Data fetching & mutation custom hook (CONTRACT PRESERVED).
- `src/app/api/data/route.ts`: Local backend API (CONTRACT PRESERVED).

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | R1: Table Inline-Editing & Keyboard Nav | Cell inline editing, Tab/Shift+Tab focus navigation, Ctrl+Enter save, Esc cancel | None | DONE |
| M2 | R2: Category Balance Highlighting & Filtering | Color badges, state highlights, 0ms stall filtering | M1 | DONE |
| M3 | R3: Batch Actions & Modal Comparison UX | Multi-select approval/status/delete, LedgerModal & ExpenseEntryModal comparison/toggle | M1, M2 | DONE |
| M4 | M4: System Verification & Gatekeeper Audit | `tsc`, `run-harness.js`, zero-stall, tab pause, forensic audit | M1, M2, M3 | DONE |

## Interface Contracts & Constraints
- `useBudget` hook API methods and signatures MUST NOT be broken or altered in backwards-incompatible ways.
- `/api/data/route.ts` JSON endpoint behavior must remain 100% compliant.
- Key navigation bindings:
  - `Tab` / `Shift+Tab`: Move focus to next/previous editable table cell.
  - `Ctrl+Enter`: Save current inline edit / complete input.
  - `Esc`: Cancel editing and restore previous value.
- Performance:
  - 0ms input delay (60 FPS) during cell editing & key nav.
  - 0ms DOM stall during filtering.
  - `document.hidden` / background tab visibility pause handling.

## Code Layout
- `src/components/budget/` - Budget UI components, modals, tables, badges.
- `src/components/budget/ui/InlineEditCell.tsx` - Reusable memoized inline edit cell.
- `src/hooks/useBudget.ts` - React Query custom hook for budget operations.
