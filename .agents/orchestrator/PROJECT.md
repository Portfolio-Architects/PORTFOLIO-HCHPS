# Project: VITAL Web Application Performance Optimization

## Architecture
- **Model**: Local file-based storage (`data/*.json`) loaded via `src/app/api/data/route.ts` as SSOT. Yjs CRDT is used for collaborative sync with a PartyKit backend.
- **View (UI)**:
  - `src/app/page.tsx`: Entry point containing the modules.
  - `src/components/dashboard/`: Dashboard subcomponents.
  - `src/components/budget/BudgetDashboard.tsx`: Budget Management UI.
  - `src/components/inventory/InventoryList.tsx`: Promotion Material Inventory UI.
  - `src/components/MindMap3D.tsx`: 3D Force-Directed Mindmap component.
- **Controller (Hooks)**:
  - `src/hooks/useTasks.ts`, `src/hooks/useBudget.ts`, etc. (React Query queries and mutations).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | explorer_analysis | Analyze codebase for performance bottlenecks and propose optimization | None | DONE |
| 2 | r1_initial_loading | Implement dynamic lazy loading and splash optimization | M1 | DONE |
| 3 | r2_tab_switching | Prevent tab UI freeze using memoization and useCallback | M2 | IN_PROGRESS |
| 4 | r3_mindmap_optimization | Optimize 3D mindmap rendering and GC (pooling, cached math) | M3 | PLANNED |
| 5 | r4_api_fetching_cache | Configure React Query cache and stale times for hooks | M4 | PLANNED |
| 6 | final_verification | Run build/lint, run tests, update report, run sync-rules | M5 | PLANNED |
