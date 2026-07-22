# Project Orchestrator Plan — UI Thread Stall Elimination & Zero-Stall Optimization

## Architecture & Requirements
- **Goal**: Full execution of R1, R2, R3 requirements and Acceptance Criteria specified in ORIGINAL_REQUEST.md.

### R1. UI Thread Stall Cause Analysis & Isolation (`dashboard` & `workspace`)
- Target components: `src/components/dashboard/*`, `src/components/workspace/*` (e.g. `PortfolioDashboardView.tsx`, `WorkspaceView.tsx`, `InventoryList.tsx`, `MindMap3D.tsx`, etc.).
- Isolated main thread blocking bottlenecks during large DOM traversals or async transactions.
- Applied UI virtualization (`useVirtualGrid`) and Props memoization (`React.memo`, `useMemo`, `useCallback`, custom comparator `areInventoryItemCardPropsEqual`) to reduce render frame occupancy below 100ms.

### R2. Zero-Stall & Background Tab Pause Standards (AGENTS.md Sec. 2-J)
- Implemented `document.hidden` / tab blur pause mechanisms: DB watcher polling, 3D WebGL physics simulation ticks (`isPaused`), and React Query background refetch (`refetchIntervalInBackground: false`, `refetchOnWindowFocus: false`).
- Enforced Instant-Resume on tab focus with delta clamping `Math.min(now - lastFrameTime, 33.3ms)` and physics freeze/resume to prevent whiplash / physics explosion.

### R3. Hydration Chunk Isolation & Dynamic Imports (AGENTS.md Sec. 2-I)
- Enforced dynamic imports `dynamic(() => import(...), { ssr: false })` for heavy components (`MindMap3D`, `PortfolioDashboardView`, `WorkspaceView`, `ProjectManagementPage`, `SecurityLockScreen`, `AppLogModal`, `AIAssistantModal`, `MindMapInspector`, `SemanticReviewModal`, `BudgetDashboard` modals).
- Rendered modals conditionally in JSX tree (`page.tsx`, `BudgetDashboard.tsx`).
- Ensured matching skeleton UI fallbacks (`WeeklySchedulerSkeleton`, `MindMap3DSkeleton`, `InventoryListSkeleton`, etc.) to prevent layout shifts.

### Acceptance Criteria Verification
- Zero UI thread stall (> 100ms) & target 60 FPS.
- `npx tsc --noEmit` succeeds with 0 errors.
- `node scripts/run-harness.js` succeeds with 0 errors/warnings.
- `node scripts/sync-rules.js` updates AGENTS.md milestone log automatically.

## Milestones Table
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Exploration & Cause Analysis | Scan `dashboard` & `workspace` components, hook performance, tab visibility hooks, dynamic imports | None | DONE |
| M2 | R1, R2, R3 Optimization Implementation | Implement R1 (virtualization/memo), R2 (tab hidden pause/clamping), R3 (dynamic imports & skeletons) | M1 | DONE |
| M3 | Build & Harness Verification + Rules Sync | Run `tsc`, `run-harness.js`, record patch in `Engineering Report.md`, run `sync-rules.js` | M2 | DONE |
| M4 | Review & Forensic Integrity Audit | Reviewers, Challengers, and Forensic Auditor verification (CLEAN verdict) | M3 | DONE |

## Code Layout
- Dashboard: `src/components/dashboard/*`, `src/hooks/usePortfolioAnalytics.ts`
- Workspace: `src/components/workspace/*`, `src/components/inventory/InventoryList.tsx`, `src/components/MindMap3D.tsx`
- System/Hooks: `src/hooks/*`, `src/app/page.tsx`
- Verification & Scripts: `scripts/run-harness.js`, `scripts/sync-rules.js`
