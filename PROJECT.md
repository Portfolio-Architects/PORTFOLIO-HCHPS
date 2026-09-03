# Project: Next.js 16 & React 19 Hydration Mismatch and Zero-Stall Performance Optimization

## Architecture
- **Framework & Runtime**: Next.js 16 (Turbopack, App Router), React 19.2.7, Tailwind CSS v4.
- **Model**: Local PC JSON (`data/*.json`) with 60ms debounce and atomic disk I/O.
- **View**: Client-isolated React 19 UI modules with pixel-accurate skeleton fallback guards and `dynamic(..., { ssr: false })` boundaries.
- **Controller**: React Query custom hooks (`src/hooks/`) with centralized `refetchIntervalInBackground: false` and `useSyncExternalStore` browser storage bridges.
- **Real-Time & Offline**: Yjs CRDT + IndexedDB with tab visibility pausing (`document.hidden`) and physics delta clamping.

## Feature Inventory
| # | Feature | Description | Milestone | Status |
|---|---------|-------------|-----------|--------|
| 1 | R1.1 Purity & Hydration Fix | Eliminate impure `Date.now()` inside `useMemo` in `YangjaeFestivalDashboard.tsx` and add `suppressHydrationWarning`. | M1 | DONE |
| 2 | R1.2 Festival Dynamic Import | Convert `src/app/festival/yangjae/page.tsx` to `dynamic(..., { ssr: false })` with matching `YangjaeFestivalSkeleton`. | M1 | DONE |
| 3 | R1.3 Callback Memoization Alignment | Connect `handleSetMonthly` and `handleSetCumulative` in `PortfolioDashboardView.tsx` to eliminate ESLint warnings and inline lambdas. | M1 | DONE |
| 4 | R2.1 QueryClient Global Background Guard | Add `refetchIntervalInBackground: false` to `queryClient` default options in `src/lib/query-client.ts`. | M2 | DONE |
| 5 | R2.2 Staggered Chunk Preloading | Implement staged idle preloading (+3.5s, +5.5s, +7.5s) in `ProtectedApp.tsx` and streamline `WorkspaceView.tsx`. | M2 | DONE |
| 6 | R2.3 Tab Visibility & Delta Clamping | Standardize `Math.min(now - lastFrameTime, 100)` delta clamping and visibility pause in canvas/simulation loops. | M2 | DONE |
| 7 | R3.1 Secondary List Key Hardening | Upgrade unstable array index keys to composite unique IDs in modals (`AppLogModal`, `CategoryEditModal`, etc.). | M3 | DONE |
| 8 | R3.2 $O(1)$ Complexity & Virtualization | Maintain zero-allocation structures and zero-dependency window virtualization across data hooks and table lists. | M3 | DONE |
| 9 | R4.1 Gatekeeper & Harness Compliance | Verify `npx tsc --noEmit` = 0, `node scripts/run-harness.js` = 0, `npx eslint src` = 0 errors/warnings. | M4 | DONE |
| 10 | R4.2 Engineering Report & Rule Sync | Update `PORTFOLIO VITAL - Engineering Report.md`, `PORTFOLIO VITAL - Engineering Milestones.md` and execute `sync-rules.js`. | M4 | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Zero Hydration Mismatch & Dynamic Imports | `YangjaeFestivalDashboard.tsx`, `festival/yangjae/page.tsx`, `PortfolioDashboardView.tsx` | none | DONE |
| 2 | M2: Zero-Stall Pipeline & Tab Visibility Pausing | `query-client.ts`, `ProtectedApp.tsx`, `WorkspaceView.tsx`, `OntologyCanvasEngine.ts` | M1 | DONE |
| 3 | M3: Stable Unique Keys & Secondary Virtualization | `AppLogModal.tsx`, `CategoryEditModal.tsx`, `DailyExpenseStatModal.tsx`, `SemanticReviewModal.tsx`, `MindMapInspector.tsx`, `BatchEditModal.tsx` | M2 | DONE |
| 4 | M4: Gatekeeper Verification, Engineering Report & Manifest Sync | `PORTFOLIO VITAL - Engineering Report.md`, `PORTFOLIO VITAL - Engineering Milestones.md`, `scripts/sync-rules.js` | M1, M2, M3 | DONE |

## Code Layout
- `src/app/` — Next.js App Router root layouts, pages, and API endpoints.
- `src/components/` — React 19 UI views, dialogs, and skeleton fallbacks.
- `src/hooks/` — React Query custom controllers and `useSyncExternalStore` hooks.
- `src/lib/` — QueryClient singleton, canvas engine, and utility primitives.
- `scripts/` — `run-harness.js`, `diagnose-targets.js`, `sync-rules.js`.
- `PORTFOLIO VITAL - Engineering Report.md` — Authoritative patch log.
- `AGENTS.md` — AI agent manifest and architecture rules.
