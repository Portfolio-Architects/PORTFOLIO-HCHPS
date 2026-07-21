# Project: VITAL Web Application Performance Optimization (Phase 2026-07-21)

## Architecture
- **Model**: Local file-based storage (`data/*.json`) loaded via `src/app/api/data/route.ts` as SSOT. `localStorage` is volatile offline cache.
- **View (UI)**:
  - `src/app/page.tsx`: Entry point containing ProtectedApp and heavy workspace/dashboard modules.
  - `src/components/dashboard/`: Dashboard subcomponents (MetricsOverview, RecentActivities, QuickActions, etc.).
  - `src/components/workspace/`: Workspace components including InventoryList, BudgetCategoryCard, Tasks, etc.
  - `src/components/MindMap3D.tsx`: 3D WebGL Mindmap component.
- **Controller (Hooks)**:
  - `src/hooks/`: React Query custom hooks (`useTasks`, `useBudget`, `useInventory`, etc.).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | M1_hydration_lazy | Initial Server Hydration & Staggered Chunk Isolation (React.lazy/dynamic with idle deferral in page.tsx / widgets) | None | DONE |
| 2 | M2_dom_virtualization | Workspace Component & Inventory List DOM Optimization (virtualized/windowed rendering for InventoryList & BudgetCategoryCard) | M1 | DONE |
| 3 | M3_gatekeeper_harness | Gatekeeper Verification & Zero-Stall Guarantee (tsc, run-harness.js, Engineering Report & sync-rules) | M2 | DONE |
