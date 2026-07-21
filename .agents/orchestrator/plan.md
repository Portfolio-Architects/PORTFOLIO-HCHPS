# Project Plan: Ultra-Fast Tab Switching & 3D WebGL Performance Optimization (2026-07-21)

## Objectives
1. **R1**: Top-Level Hook Scoping & Conditional Computing in `ProtectedApp` (`src/app/page.tsx`). Pause heavy hooks (`useMergedSignals`, `useGraphCustomization`) when target view (mindmap) is inactive. Memoize `aiContextData` & signal extraction results to eliminate re-computation on tab switch.
2. **R2**: 3D WebGL Frame Pause & Physics Freezing in `OntologyRenderer.tsx` and `MindMap3D.tsx`. Pause `requestAnimationFrame` loop and freeze node positions when away from mindmap tab; resume instantly upon activation without whiplash/lag spike.
3. **R3**: DB Polling & React Query Refetch Optimization in `useGraphCustomization.ts` and query hooks (`useTasks`, `useBudget`, `useInventory`, etc.). Suspend polling when tab is inactive or hidden; ensure refetching is debounced and cached cleanly.
4. **R4**: Automated Verification & Documentation (`npx tsc --noEmit`, `node scripts/run-harness.js` with 0 errors/warnings/violations/bottlenecks, update `PORTFOLIO VITAL - Engineering Report.md`, execute `node scripts/sync-rules.js`).

## Milestone Breakdown
- **Milestone 1**: Top-Level Hook Scoping & Conditional Computing (R1) [IN_PROGRESS]
- **Milestone 2**: 3D WebGL Frame Pause & Physics Freezing (R2) [PLANNED]
- **Milestone 3**: DB Polling & React Query Refetch Optimization (R3) [PLANNED]
- **Milestone 4**: Final Verification, Harness Testing, Engineering Report & Sync Rules (R4) [PLANNED]

