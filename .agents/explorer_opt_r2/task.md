# Explorer 2 Task: Lazy Loading & FCP Analysis (R2)

## Objective
Analyze how heavy components (`MindMap3D.tsx`, `WeeklyScheduler.tsx`, `WikiEditor.tsx`) are currently imported and used in the dashboard layout, and determine how to implement Next.js dynamic imports with `{ ssr: false }`.

## Target Components
- `src/components/dashboard/PortfolioDashboardView.tsx` (where they are likely imported)
- `src/components/MindMap3D.tsx`
- `src/components/dashboard/WeeklyScheduler.tsx`
- `src/components/WikiEditor.tsx`

## Key Requirements to Research
1. Locate where these components are imported statically.
2. Determine their prop signatures and verify that dynamic loading won't break prop passing.
3. Suggest a loading fallback/placeholder component to show while loading to improve user experience and prevent layout shift (CLS).
4. Identify any third-party dependencies (like Yjs, ForceGraph, Monaco, etc.) that contribute to initial bundle bloat and ensure they are only loaded in client-side dynamic chunks.

## Deliverables
- Write `analysis.md` in your folder (`.agents/explorer_opt_r2/`) detailing:
  - Exact locations where static imports exist and how to refactor them to `next/dynamic`.
  - Prop signatures and handling of dynamic wrapper exports.
  - Mock/placeholder UI design for the loading phase.
- Report back with a summary when complete.
