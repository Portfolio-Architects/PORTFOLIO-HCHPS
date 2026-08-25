# Project: React 19 & Next.js 16 App Router Compatibility, O(1) Complexity Leap & 0-0-0 Full Integrity

## Architecture
- **Ontology (M-V-C)**:
  - **Model (Storage)**: `src/app/api/data/route.ts` managing `data/*.json` SSOT disk storage with atomic temporary file writes, rename retries, pre-write Zod gatekeepers, 3-tier GFS backup rotations, and 30-day tombstone GC.
  - **View (UI)**: React 19 / Next.js 16 App Router UI modules (`src/components/`, `src/app/`) with high-contrast TailwindCSS dark theme, client-safe hydration boundaries, dynamic imports (`ssr: false`) and skeleton guards.
  - **Controller (Hooks)**: React Query custom hooks (`src/hooks/`) mediating all data fetching, mutations, optimistic updates, and pre-indexed $O(1)$ Map/Set query caches.
  - **Real-time Engine**: Three.js WebGL and 2D canvas simulation engines (`src/lib/`) with zero-allocation physics ticks, dirty-flag caching, and $O(1)$ graph traversals.

## Code Layout
- `src/app/` — Next.js 16 App Router routes, layout, global CSS, login, and `/api/data` backend endpoints.
- `src/components/` — 41+ UI modules (dashboard, budget, inventory, law, mindmap, modals, project).
- `src/hooks/` — React Query custom hooks (controllers) with optimistic updates and $O(1)$ Map caches.
- `src/lib/` — Domain engines, signal graph algorithms, schemas (`schemas.ts`), ontology service, sheets API.
- `scripts/` — Gatekeeper harness (`run-harness.js`), diagnostics (`diagnose-targets.js`), rule sync (`sync-rules.js`).
- `data/` — SSOT JSON database files (`TASKS.json`, `BUDGET_CATEGORIES.json`, `BUDGET_ENTRIES.json`, `PROJECTS.json`, etc.).

## Feature Inventory
Every feature from the Phase 0 Survey is inventoried and assigned to a milestone:

| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| 1 | SSR-Safe Hook Hydration | Eliminate `localStorage` / browser globals in `useState` & `initialData` initializers across 8 hooks/components (`useBudgetFilters`, `useTasks`, `useBudget`, `useContacts`, `useInventory`, `useNotificationAlerts`, `useAIChat`, `useBudgetSimulator`, `WikiEditor`) | M1 | Survey Explorer 1 | DONE |
| 2 | React 19 Date Hoisting | Hoist `new Date().toDateString()` in `WeeklyScheduler.tsx` to eliminate render loop allocations and purity violations | M1 | Survey Explorer 1 | DONE |
| 3 | React 19 Mutation Purity | Remove `mutation.reset()` from render body and stabilize effect deps in `SearchResultModal.tsx` | M1 | Survey Explorer 1 | DONE |
| 4 | React 19 Ref Modernization | Modernize `DynamicForceGraph.tsx` from deprecated `forwardRef` to direct React 19 `ref` prop | M1 | Survey Explorer 1 | DONE |
| 5 | React 19 Render State Sync | Refactor `InlineEditCell.tsx` to eliminate `setState` in render body | M1 | Survey Explorer 1 | DONE |
| 6 | Effect Dependency Strictness | Resolve missing callback dependencies in `SecurityLockScreen.tsx` | M1 | Survey Explorer 1 | DONE |
| 7 | Deterministic Schema Catchers | Replace `Math.random()` in `ScheduleSchema` & `ContactSchema` fallback catchers with deterministic generators | M1 | Survey Explorer 1 & 3 | DONE |
| 8 | Signal Graph O(1) Leap | Pre-index nodes & edges into Map/Set in `src/lib/signal-graph.ts` (lines 515–545, 709–764) | M2 | Survey Explorer 2 | DONE |
| 9 | Centrality Zero-Allocation | Eliminate heap array allocations and spread operations in `src/lib/ontology.service.ts` | M2 | Survey Explorer 2 | DONE |
| 10 | Layout Recursion Indexing | Forward `siblingIndex` in `OntologyLayout.ts` to convert layout from $O(S^2)$ to $O(S)$ linear time | M2 | Survey Explorer 2 | DONE |
| 11 | Festival Validation Inverted Index | Pre-index `allNodesMap` & `tasks` into keyword inverted Maps in `useFestivalValidation.ts` | M2 | Survey Explorer 2 | DONE |
| 12 | Timetable Slot O(1) Grouping | Pre-group timetable schedules by `${dayStr}:${hourStr}` in `WeeklyScheduler.tsx` to eliminate 98 linear filters per render | M2 | Survey Explorer 2 | DONE |
| 13 | Ledger Modal T-Account Memoization | Wrap T-account filtering/sorting in `useMemo` and use $O(1)$ category Map in `LedgerModal.tsx` | M2 | Survey Explorer 2 | DONE |
| 14 | Expense Entry Modal Indexing | Index subitems and calculations in Map for $O(1)$ lookup in `ExpenseEntryModal.tsx` | M2 | Survey Explorer 2 | DONE |
| 15 | MindMap Search Memoization | Memoize search query filter in `MindMap3D.tsx` to prevent redundant full-array scans on keystrokes | M2 | Survey Explorer 2 | DONE |
| 16 | Inspector O(1) Lookups & Jaccard Optimization | Replace linear searches with `nodeMap.get()` and eliminate Set spreads in `MindMapInspector.tsx` | M2 | Survey Explorer 2 | DONE |
| 17 | Semantic Review Label Pre-Indexing | Pre-index `nodeLabelMap` in `SemanticReviewModal.tsx` to reduce edge warning check from $O(E \cdot N)$ to $O(E)$ | M2 | Survey Explorer 2 | DONE |
| 18 | Hook Unification for Auth | Abstract `fetch('/api/auth')` in `src/app/login/page.tsx` into `useAuth.ts` for 100% MVC hook uniformity | M3 | Survey Explorer 3 | DONE |
| 19 | SSOT Storage & Tombstone Verification | Verify atomic file operations, pre-write Zod gatekeeper, and 30-day tombstone GC in `src/app/api/data/route.ts` | M3 | Survey Explorer 3 | DONE |
| 20 | Full Harness & Gatekeeper Verification | Verify `tsc --noEmit` (0 errors), `run-harness.js` (0-0-0), and `diagnose-targets.js --force` (0-0-0) | M4 | All Explorers | DONE |
| 21 | Engineering Report & AGENTS.md Sync | Update `PORTFOLIO VITAL - Engineering Report.md` and execute `node scripts/sync-rules.js` | M4 | Sentinel Requirements | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | React 19 & Next.js 16 Compatibility & Hydration | Features 1–7: SSR-safe hydration, Date hoisting, mutation purity, ref prop, render state sync, schema catchers | none | DONE |
| M2 | Codebase-wide O(1) Complexity Leap & GC Elimination | Features 8–17: Signal graph, Centrality, OntologyLayout, FestivalValidation, WeeklyScheduler, LedgerModal, ExpenseModal, MindMap3D, MindMapInspector, SemanticReviewModal | M1 | DONE |
| M3 | MVC Ontology & SSOT Integrity | Features 18–19: Auth hook encapsulation, SSOT disk storage validation | M1, M2 | DONE |
| M4 | Final Integration, Gatekeeper Verification & Sync | Features 20–21: 0-0-0 harness validation, Engineering Report update, AGENTS.md synchronization | M1, M2, M3 | DONE |

## Interface Contracts
### Hook Storage Hydration Contract
- Custom hooks reading from local storage MUST initialize state with deterministic defaults on the initial render.
- Secondary hydration synchronization MUST occur inside `useEffect` or through `useSyncExternalStore` with matching `getServerSnapshot` to guarantee identical server and client 1st render trees.

### O(1) Pre-Indexing Contract
- All graph algorithms and UI list transformations traversing collections MUST construct `Map<string, T>` / `Set<string>` before loops.
- Lookup operations MUST use `map.get(id)` or `set.has(id)` ($O(1)$) instead of `.find()`, `.some()`, or `.filter()` inside loops.

### Gatekeeper Verification Contract
- `npx tsc --noEmit` -> 0 errors
- `node scripts/run-harness.js` -> 0 Zod errors, 0 ESLint errors/warnings, 0 architecture violations (0-0-0 Full Integrity)
- `node scripts/diagnose-targets.js --force` -> 0 warnings, 0 violations, 0 bottlenecks
