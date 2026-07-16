# Project: Dashboard Design and Performance Optimization (R1, R2, R3)

## Architecture
- **Model**: `src/app/api/data/route.ts` (SSOT) managing data JSON files under `data/`.
- **View (UI)**: React components styled with TailwindCSS, utilizing Inter/Outfit fonts for high-contrast dark mode readability.
- **Controller**: React Query hooks under `src/hooks/` for state and data mutations.
- **Optimizations**: Next.js dynamic lazy loading for heavy components; React.memo, useCallback, useMemo, and staggered preloading for frame stability.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Codebase Analysis & Strategy | Analyze components (`PortfolioDashboardView`, `WeeklyScheduler`, `MindMap3D`, `MindMapInspector`, `WikiEditor`, and cards/modals) to draft concrete suggestions | None | DONE |
| M2 | High-Contrast Readability & Fonts (R1) | Add Outfit/Inter fonts, enhance readability, contrast, borders, and shadows in components | M1 | IN_PROGRESS |
| M3 | Next.js Lazy Loading & FCP (R2) | Implement `next/dynamic` with `ssr: false` for `MindMap3D`, `WeeklyScheduler`, and `WikiEditor` | M2 | PLANNED |
| M4 | Performance & Render Isolation (R3) | Apply `React.memo`, `useCallback`, `useMemo`, and staggered preloading logic to target components | M3 | PLANNED |
| M5 | Validation & Rule Synchronization | Run lint/build check, update `Engineering Report.md`, execute `sync-rules.js`, and verify compliance | M4 | PLANNED |

## Code Layout
- `src/components/dashboard/PortfolioDashboardView.tsx`: Main dashboard entry point.
- `src/components/dashboard/WeeklyScheduler.tsx`: Weekly scheduling grid component.
- `src/components/MindMap3D.tsx`: Heavy 3D Force-Directed MindMap component.
- `src/components/MindMapInspector.tsx`: Side panel inspector for mindmap nodes.
- `src/components/WikiEditor.tsx`: Rich markdown/text editor component.
- `src/components/ui/card.tsx` / `modal.tsx`: Base UI elements to adapt high-contrast themes.
- `PORTFOLIO VITAL - Engineering Report.md`: Log of updates and patches.
- `AGENTS.md`: Agent manifest and rules index.

## Interface Contracts
- **Dynamic Imports**: Components loaded with `dynamic(..., { ssr: false })` must expose identical prop signatures as their static counterparts.
- **Staggered Preloading**: Main view state controls sequence of initialization (`isSchedulerReady`, `isMindmapReady`) to split rendering frames.
