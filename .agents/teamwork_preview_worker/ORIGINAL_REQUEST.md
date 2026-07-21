## 2026-07-16T12:00:51Z
You are the teamwork_preview_worker. Your task is to implement the following changes in the VITAL Work & Wealth repository:

### 1. Relocate PR Materials (InventoryList) to WorkspaceView (Milestone 2)
- Modify `src/components/WorkspaceView.tsx`:
  - Dynamically import `InventoryList` from `@/components/inventory/InventoryList` with `ssr: false` and a nice loading spinner or text.
  - Implement a state `const [activeTab, setActiveTab] = useState<'budget' | 'inventory'>('budget')`.
  - Render a styled tab bar at the top of the component to let the user switch between "예산 대조보드" and "홍보물 관리" (using Outfit/Inter typography, borders, and margins matching the existing dashboard style).
  - Conditionally render `<BudgetDashboard>` or `<InventoryList>` depending on the active tab. Pass the corresponding inventory props (inventoryItems, addItem, updateItem, deleteItem, adjustStock, getItemHistory) to `<InventoryList>`.

### 2. Move LawSearchPanel and Remove it from BudgetDashboard (Milestone 3 part A)
- Move `src/components/budget/ui/LawSearchPanel.tsx` to `src/components/law/LawSearchPanel.tsx`. Update the imports if needed (hooks use absolute path `@/hooks/useLawSearch`, so they should not break).
- Remove `LawSearchPanel` from `src/components/budget/BudgetDashboard.tsx`:
  - Remove the import: `import { LawSearchPanel } from './ui/LawSearchPanel';`
  - Remove the rendering block: `<LawSearchPanel />` near the bottom.

### 3. Create LawSystemPage Component (Milestone 3 part B)
- Create `src/components/law/LawSystemPage.tsx` which includes:
  - Tab navigation between:
    1. "법령/조례 실시간 검색" (renders the moved `LawSearchPanel` component).
    2. "자치/행정 용어 사전" (displays an interactive list/search of local municipal and administrative terms).
    3. "공문서 표준 작성 가이드" (displays formatting rules, margins, typography, bullet hierarchy, spacing, ending rules like "끝.", and administrative language standards).
  - Local Law Dictionary content:
    Provide cards or search/filter UI for 13+ critical municipal and administrative terms. Include terms like:
    * 세출예산 (Annual Expenditure Budget)
    * 일상경비 (Daily Operations Expenses)
    * 편성목 (Budget Allocation Item)
    * 통계목 (Statistical Account Item)
    * 원인행위 (Debt Commitment)
    * 지출품의 (Expense Authorization)
    * 예비비 (Reserve Fund)
    * 추가경정예산 (Supplementary Budget)
    * 지방재정법 (Local Finance Act)
    * 지방자치법 (Local Autonomy Act)
    * 행정규칙 (Administrative Rules)
    * 조례 (Municipal Ordinance)
    * 규칙 (Municipal Rule)
    Include clear definitions and correct usage examples.
  - Standard Document Guide Panel content:
    Format rules based on `hwp_generation_guidelines.md` and `AGENTS.md`:
    * Document Layout: margins (top/bottom 15mm, left/right 20mm), 130% line height.
    * Typography Standards: Heading 1 (22pt, HeadlineM), Level 1 index (16pt, HeadlineM), Body text (15pt, Human Myeongjo, 98% width, -2% letter spacing), Tables/Notes (13pt, Jung Gothic).
    * Hierarchical Indexing: Bullet hierarchy (Ⅰ. -> 가. -> 1) -> 가) -> ⑴), indenting by 10pt (2 spaces) per level, and aligning subsequent lines.
    * Spacing Guidelines: 1 space after heading indexes. 2 spaces after attachments ('붙임  1.').
    * "끝." (The End) Rules:
      - No attachment: add 2 spaces after final word and write `끝.` (e.g. `수고하셨습니다.  끝.`).
      - With attachment: add 2 spaces after final attachment list and write `끝.` (e.g. `1부.  끝.`).
      - Ending with a Table: Write `끝.` 2 spaces after the bottom boundary of the table, left-aligned.
    * Administrative Value Tuning: Factuality (no `-시키다` suffix), Accessibility (purifying loanwords), Non-Authoritativeness (avoiding military commands), Neutrality (female-first 가나다순 list ordering, e.g. `여 15, 남 20`).

### 4. Update Sidebar and Page Routes (Milestone 3 part C)
- Modify `src/types/index.ts`:
  - Update `ModuleType` enum to replace `inventory` with `law`.
- Modify `src/components/Sidebar.tsx`:
  - Import `Scale` icon from `lucide-react`.
  - Replace the `inventory` nav item with `law` (label: "법령/지침", icon: `Scale`).
- Modify `src/app/page.tsx`:
  - Update `visitedModules` state initialization (replace `inventory` with `law`).
  - Update `triggerPreload` and staggered preloading timers to preload `law` (via `@/components/law/LawSystemPage`).
  - Update swipe order array `order` (replace `'inventory'` with `'law'`).
  - Update browser page header title rendering (replace `'inventory'` block with `'law'`).
  - Remove `InventoryList` dynamic import.
  - Dynamically import `LawSystemPage` from `@/components/law/LawSystemPage` with `ssr: false` and a nice skeleton loading fallback.
  - Replace the rendering of the `inventory` module block with the `law` module block (rendering `<LawSystemPage />` when `activeModule === 'law'`).

### 5. Verification & Sync (Milestone 4)
- Run linting and check TypeScript build compiling (e.g. running `node scripts/run-harness.js` or `npm run lint` and `npm run build` using the terminal).
- Verify that Zod validations pass.
- Record details of the patches in `PORTFOLIO VITAL - Engineering Report.md`.
- Run the rule synchronization script: `node scripts/sync-rules.js`.
