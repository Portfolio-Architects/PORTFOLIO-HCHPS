# Original User Request

## 2026-07-23T01:28:18Z

# Teamwork Project Prompt — Localhost UX Optimization

Implement comprehensive Localhost UX optimizations for the PORTFOLIO - VITAL application, enhancing local data loading responsiveness, adding a real-time Localhost Daemon/Health Status HUD, implementing a `Ctrl+K` command palette for instant navigation, and reinforcing offline-first Zero-Stall reliability.

Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL
Integrity mode: development

## Requirements

### R1. Local Data Hydration & Instant UI Feedback
Optimize local JSON disk I/O operations and React Query hooks (`useTasks`, `useBudget`, `useInventory`, `useContacts`) to provide instant 0ms UI feedback (optimistic updates) for all local data mutations, eliminating visual delays during disk auto-saves.

### R2. Localhost Health & Daemon Status HUD Component
Implement a modern, sleek Localhost Status HUD widget in the layout/sidebar displaying real-time local environment metrics: Server Port (3001), Local Heap Usage (MB), Auto-Backup count, File Watcher status, and Offline Sync indicator.

### R3. Keyboard Shortcut Command Palette (`Ctrl+K` / `Cmd+K`)
Add a global keyboard command palette accessible via `Ctrl+K` / `Cmd+K` that enables instant keyboard navigation across all 4 main modules (Dashboard, MindMap, Workspace, Projects) and quick searching/filtering of local items.

### R4. Offline-First Zero-Stall Reliability & Codebase Integrity
Ensure all local operations function completely offline without external network dependencies, preserving zero-stall thread responsiveness (>100ms stall 0) and adhering to the project's MVC ontology.

## Acceptance Criteria

### Localhost UX & Functionality
- [ ] A Localhost Status HUD widget is integrated into the UI showing Port 3001, Heap Memory, and Local Storage health.
- [ ] Pressing `Ctrl+K` (or `Cmd+K`) opens a polished Command Palette modal with instant search and tab navigation.
- [ ] Local data modifications (task edits, budget additions, contact changes) immediately reflect in the UI via optimistic updates.
- [ ] App operates 100% offline without external network call failures.

### Automated Verification
- [ ] `node scripts/run-harness.js` passes cleanly with 0 TypeScript compilation errors, 0 Zod schema errors, and 0 ESLint warnings.
- [ ] `node scripts/sync-rules.js` automatically syncs the updated milestone log to `AGENTS.md`.

## 2026-07-23T13:50:53Z

Eliminate the 2-3s UI thread freeze when entering the Budget Management page by implementing module pre-evaluation, component virtualization, GC allocation optimization, and isolation of background signal computations.

Requirements:
- R1: Optimize Module Preloading & Idle Evaluation (adjust WorkspaceView staggered preloading timing or idle pre-compilation).
- R2: Virtualize Budget Category Cards & Eliminate Excess DOM Nodes (apply DOM virtualization via useVirtualGrid/windowing or memoized chunk rendering to PolicyGroupCard and BudgetCategoryCardItem).
- R3: Fix GC Memory Allocation Spikes in getCategoryStats (cache excludePlanned stats calculation or avoid object instantiations inside render loops).

Acceptance Criteria:
- No UI thread long task (> 100ms) on entering the Budget Management page.
- `npx tsc --noEmit` completes with 0 errors.
- `node scripts/run-harness.js` passes clean.
- `node scripts/sync-rules.js` updates AGENTS.md milestone log.

