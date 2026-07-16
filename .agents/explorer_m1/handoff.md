# Handoff Report — Codebase Explorer

## 1. Observation
I directly observed the following from the codebase:
- **`src/app/page.tsx`**:
  - Line 178: `const { items: inventoryItems, addItem, updateItem, deleteItem, adjustStock, getItemHistory } = useInventory();`
  - Line 186: `const { mergedKeywordMap, mergedEntries } = useMergedSignals(signalEntries, keywordMap, tasks, projects, meetings, budgetEntries, inventoryItems);`
  - Lines 500–519: `WorkspaceView` component renders and is passed the inventory-related state and handlers as props.
  - Lines 524–535: Renders `<InventoryList />` when `activeModule === 'inventory'`.
- **`src/components/WorkspaceView.tsx`**:
  - Lines 26–31: Defines the inventory props in the `WorkspaceViewProps` interface but only renders the `<BudgetDashboard />` component at lines 72–84.
- **`src/components/Sidebar.tsx`**:
  - Line 21: `navItems` array includes `{ id: 'inventory', label: '홍보물', icon: Package }`.
- **`src/types/index.ts`**:
  - Line 167: `export type ModuleType = 'workspace' | 'mindmap' | 'dashboard' | 'inventory';`
- **`src/components/budget/BudgetDashboard.tsx`**:
  - Line 15: `import { LawSearchPanel } from './ui/LawSearchPanel';`
  - Line 358: Renders `<LawSearchPanel />` at the bottom of the budget dashboard.
- **`src/components/budget/ui/LawSearchPanel.tsx`**:
  - Contains the legal search panel component. It relies on the absolute path `@/hooks/useLawSearch` for query hooks.
- **`hwp_generation_guidelines.md`**:
  - Contains detailed specifications for A4 page margins (top/bottom 15mm, left/right 20mm), hierarchical headings (`Ⅰ.` $\rightarrow$ `가.` $\rightarrow$ `1)`), spacings (1 space after index, 2 spaces after attachments), and ending rule `"끝."` formats.

## 2. Logic Chain
Based on the observations:
1. **Relocating Inventory to WorkspaceView**:
   - Since `WorkspaceView` is already passed the inventory state and handlers as props by `src/app/page.tsx` (but doesn't render them), we can convert `WorkspaceView` to a tabbed view.
   - Introducing an `activeTab` state (`'budget' | 'inventory'`) in `WorkspaceView.tsx` allows the component to swap between `BudgetDashboard` and `InventoryList`.
   - Implementing this swap with Next.js dynamic import for `InventoryList` keeps loading optimal.
2. **Replacing Inventory Module with Law Module**:
   - `inventory` is defined in `ModuleType` (`src/types/index.ts`), navigation items (`src/components/Sidebar.tsx`), and page lifecycle/swipe controls (`src/app/page.tsx`).
   - By updating `ModuleType` to replace `'inventory'` with `'law'`, we can substitute the nav item icon and label, change the preload logic, and render the new `<LawSystemPage />` in place of the standalone `<InventoryList />` when `activeModule === 'law'`.
3. **Isolating BudgetDashboard**:
   - Removing the `LawSearchPanel` import and element from `BudgetDashboard.tsx` isolates budget tracking from law references.
4. **Designing LawSystemPage**:
   - The new page component `LawSystemPage.tsx` will unify:
     1. The moved `LawSearchPanel` (moved to `src/components/law/LawSearchPanel.tsx` or `src/components/law/ui/LawSearchPanel.tsx`).
     2. A local administrative dictionary component based on the key terms from the guidelines.
     3. An administrative formatting guide panel detailing page layouts, typography, indexing, spacing, and ending rules from the official guidelines.

## 3. Caveats
- The Ministry of Government Legislation API hooks in `useLawSearch` are assumed to be fully functional.
- The inventory module is no longer a top-level route/tab; it is nested inside the 예산관리 (Workspace) tab. If any deep linking or routing directly opens `inventory`, it must be redirected to `workspace` with `activeTab` set to `'inventory'`.

## 4. Conclusion
The proposed plan provides a clean separation of concerns:
- Moves promotional materials (Inventory) under 예산관리 (Workspace) as a sub-tab, leveraging existing hooks and props propagation.
- Replaces the top-level inventory tab with a new independent "법령/지침" (Law) page.
- Removes the law panel from the budget dashboard and moves it to the Law System page alongside a local administrative term dictionary and typography guideline sheet.

## 5. Verification Method
1. **Verification of compilation**:
   - Run `npm run lint` and `npm run build` after implementing.
2. **Verification of database integrity**:
   - Run `node scripts/run-harness.js` to ensure the Zod schemas and database file mappings remain fully valid.
   - *Verification note*: The baseline has been verified by running `node scripts/run-harness.js` during the exploration phase, passing with 0 database errors, 0 ESLint warnings, and 0 architectural violations.
3. **Manual checklist verification**:
   - Verify that clicking '법령/지침' on the sidebar opens the new Law System page.
   - Verify that clicking the '예산관리' tab shows the tab switcher (예산 대조보드 / 홍보 자재 관리).
   - Check that the budget dashboard no longer displays the law search panel at the bottom.
