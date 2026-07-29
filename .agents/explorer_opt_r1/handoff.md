# Handoff Report: Requirement R1 (Table Inline-Editing & Keyboard Navigation System)

## 1. Observation
- **Inspected Files**:
  - `src/components/budget/BudgetDashboard.tsx` (Lines 1–472)
  - `src/components/budget/ui/PolicyGroupCard.tsx` (Lines 1–502)
  - `src/components/budget/ui/BudgetCategoryCardItem.tsx` (Lines 1–375)
  - `src/components/budget/ui/LedgerModal.tsx` (Lines 1–211)
  - `src/components/budget/ui/ExpenseEntryModal.tsx` (Lines 1–388)
  - `src/components/budget/ui/CategoryEditModal.tsx` (Lines 1–250)
  - `src/hooks/useBudget.ts` (Lines 1–468)
  - `src/app/api/data/route.ts` (Lines 1–565)
  - `src/lib/schemas.ts` (Lines 1–198)

- **Direct Findings**:
  1. **Table rendering locations**:
     - `PolicyGroupCard.tsx` lines 435–494 renders the **Expense Entries Table/List** (`groupEntries`) for each policy group with fields `badge` (actionType), `unitProject`, `date`, `docRegNum`, `purpose`, and `amount`.
     - `BudgetCategoryCardItem.tsx` lines 211–273 renders sub-items and calculations, lines 275–307 renders general expense entries, and lines 309–341 renders daily expense entries.
  2. **Editing Mechanism Absence**:
     - Editing is currently initiated exclusively via `<button onClick={() => openEditCat(cat)}><Pencil size={13} /></button>` or `<button onClick={() => openEditEntry(entry)}><Pencil size={13} /></button>` triggering modal dialogs (`CategoryEditModal`, `ExpenseEntryModal`).
     - No inline cell editing or keyboard event handling (`onKeyDown`, `Tab`, `Ctrl+Enter`, `Esc`) is present in any table component.
  3. **Data Mutation & Constraints**:
     - `useBudget.ts` exports `updateCategory(id, updates)` and `updateEntry(id, updates)`.
     - Data updates invoke `updateRow` in `@/lib/sheets-api`, sending HTTP `POST` requests to `/api/data/route.ts`.
     - `/api/data/route.ts` runs Zod gatekeeper validation (`validateDataPayload`) using `BudgetCategorySchema` and `BudgetEntrySchema` from `src/lib/schemas.ts`. `amount` fields must be numbers, not strings.

---

## 2. Logic Chain
1. **Observation 1 & 2** show that budget expense items are rendered inside `PolicyGroupCard.tsx` and `BudgetCategoryCardItem.tsx`, but editing requires opening modal dialogs via click handlers.
2. Therefore, to fulfill Requirement R1 without disrupting existing modal popups, an `InlineEditCell` / `EditableCell` component should be introduced into the table rows of `PolicyGroupCard.tsx` (for expense entry fields: `purpose`, `amount`, `docRegNum`, `date`) and `BudgetCategoryCardItem.tsx` (for category amount/name/sub-items).
3. **Observation 3** shows that `updateEntry` and `updateCategory` trigger network POST requests to `/api/data/route.ts`. If an `onChange` handler fired mutations on every keypress, it would cause severe network spam, UI freezing, and Zod validation errors on incomplete input strings.
4. Step 3 implies that `InlineEditCell` must use local buffered component state (`tempValue`) while typing and invoke `onSave` (which calls `updateEntry` / `updateCategory`) **only on explicit commit events** (`Blur`, `Tab`, `Ctrl+Enter`).
5. **Observation 1** shows `PolicyGroupCard` and `BudgetCategoryCardItem` are memoized using `React.memo` with custom prop equality checkers (`arePolicyGroupCardPropsEqual`, `areBudgetCategoryCardItemPropsEqual`).
6. Step 5 implies that adding cell editing state will preserve 60 FPS performance as long as typing stays local to `InlineEditCell` and does not trigger re-evaluations of un-targeted rows.

---

## 3. Caveats
- **Sub-Item Calculations**: Sub-item calculations (`subItems[].calculations`) involve complex nested formulas and locking logic (`isLocked`, `subLimit`). Inline editing for sub-item calculation formulas should sanitize strings carefully or fall back to `CategoryEditModal` for structural additions.
- **Server Validation Errors**: Editing amounts beyond available budget or sub-item locks will trigger server-side 409 responses from `/api/data/route.ts`. The UI must catch these errors gracefully and notify the user.

---

## 4. Conclusion
Requirement R1 can be seamlessly implemented by introducing an `InlineEditCell` component and a lightweight `useKeyboardGridNav` focus management strategy into `PolicyGroupCard.tsx` and `BudgetCategoryCardItem.tsx`. This preserves all existing schema rules and `useBudget.ts` hook APIs while enabling high-performance spreadsheet-like inline editing with 0ms typing latency and 60 FPS UI fluidity.

---

## 5. Verification Method
To verify the implementation once completed by Implementer:
1. **TypeScript Compilation Check**:
   ```powershell
   npx tsc --noEmit
   ```
2. **Harness & Schema Validation**:
   ```powershell
   node scripts/run-harness.js
   ```
3. **Interactive UI Verification**:
   - Double-click an amount or purpose cell in the expense table of `PolicyGroupCard.tsx`.
   - Type new text/amount — verify 0ms typing lag.
   - Press `Tab`: verify focus moves to the next cell and previous edit saves.
   - Press `Shift+Tab`: verify focus moves to previous cell.
   - Press `Ctrl+Enter`: verify cell saves and editing deactivates.
   - Press `Esc`: verify edit cancels and original value restores.
