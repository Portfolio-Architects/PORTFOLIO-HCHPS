# Project: Budget Management Page UI Freeze & GC Optimization

## Architecture
- **Model (Storage)**: `src/app/api/data/route.ts` (local disk JSON) SSOT.
- **View (UI)**: React 19.2.7 + TailwindCSS v4 components (`src/components/dashboard/WorkspaceView.tsx`, budget category components, etc.).
- **Controller (Hooks)**: React Query hooks (`useBudget.ts`, etc.) and memoized calculation utilities.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Module Preloading & Idle Evaluation | Adjust `WorkspaceView` staggered preloading timing or idle pre-compilation for Budget module | None | DONE |
| 2 | M2: Budget Category Cards Virtualization | Apply DOM virtualization (`useVirtualGrid` / windowing) or memoized chunk rendering to `PolicyGroupCard` and `BudgetCategoryCardItem` | M1 | DONE |
| 3 | M3: Fix GC Memory Spikes in `getCategoryStats` | Cache `excludePlanned` stats calculation or avoid object instantiations inside render loops | M2 | DONE |
| 4 | M4: Gatekeeper Verification & Sync Rules | Run `node scripts/run-harness.js` (0 TSC errors, 0 Zod errors, 0 Arch violations, 0 ESLint warnings), zero-stall check, run `node scripts/sync-rules.js` | M3 | DONE |

## Interface Contracts
- Budget hooks and data structures remain intact with strict typing.
- Category stats calculations return consistent types while caching internal calculations.
- Rendered UI matches visual layout without unnecessary DOM node explosion.

## Code Layout
- Workspace View: `src/components/dashboard/WorkspaceView.tsx`
- Budget Components: `src/components/dashboard/WorkspaceView.tsx` or related budget card components
- Hooks / Stats: `src/hooks/useBudget.ts` or helper stats functions
- Harness / Scripts: `scripts/run-harness.js`, `scripts/sync-rules.js`
