# Execution Plan: Budget Management Page UI Freeze & GC Optimization

## Overview
Eliminate 2-3s UI thread freeze when entering Budget Management page by implementing module pre-evaluation, component virtualization, GC allocation optimization, and background signal isolation.

## Milestones & Phased Plan

### Milestone 1: R1 Module Preloading & Idle Evaluation
- Analyze `WorkspaceView.tsx` preloading timing (dynamic import preloading schedule).
- Adjust staggered timing or apply idle pre-compilation to prevent initial parse stalls.
- Verification: Build/TSC passes, component preloads smoothly in background idle time.

### Milestone 2: R2 Budget Category Cards Virtualization & DOM Node Reduction
- Virtualize list rendering in `PolicyGroupCard` and `BudgetCategoryCardItem`.
- Apply `useVirtualGrid` windowing or memoized chunk rendering to render only visible DOM nodes.
- Verification: Rendering 100+ budget items produces minimal DOM nodes, 0 layout stalls.

### Milestone 3: R3 Fix GC Memory Allocation Spikes in `getCategoryStats`
- Cache `excludePlanned` calculation in `getCategoryStats` or `useBudget`.
- Avoid instantiating temporary objects/arrays inside high-frequency render loops.
- Verification: 0 GC allocation spikes, stats calculations are memoized and instant.

### Milestone 4: R4 Gatekeeper Verification & Sync Rules
- Run `node scripts/run-harness.js` (TSC 0 errors, Zod 0 errors, ESLint 0 warnings, Arch violations 0).
- Verify thread long task (>100ms) count is 0 on entering Budget page.
- Run `node scripts/sync-rules.js` to update `AGENTS.md` milestone log.

## Gatekeeper Protocol per Milestone
1. Worker executes implementation & runs `run-harness.js`.
2. Reviewers / Challengers verify correctness and performance.
3. Forensic Auditor (`teamwork_preview_auditor`) performs integrity audit. Clean audit required to pass.
