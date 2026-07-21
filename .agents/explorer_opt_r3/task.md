# Explorer 3 Task: Re-render Isolation & Staggered Preloading Analysis (R3)

## Objective
Analyze target components (`PortfolioDashboardView.tsx`, `WeeklyScheduler.tsx`, `MindMap3D.tsx`, `MindMapInspector.tsx`, and related cards/modals) to prevent unnecessary re-renderings and design a staggered preloading workflow.

## Target Components
- `src/components/dashboard/PortfolioDashboardView.tsx`
- `src/components/dashboard/WeeklyScheduler.tsx`
- `src/components/MindMap3D.tsx`
- `src/components/MindMapInspector.tsx`
- related cards/subcomponents in the dashboard.

## Key Requirements to Research
1. Identify components that re-render too often or suffer from prop changes (e.g. passing inline arrays/objects or recreated event handlers).
2. Recommend where `React.memo` is needed for subcomponents (e.g., individual scheduler blocks, task lists, contacts box).
3. Find functions and state mutations that need `useCallback` or `useMemo`.
4. Design a Staggered Loading mechanism for heavy DOM parts (e.g. `WeeklyScheduler` and `MindMap3D`). Recommend state flags (e.g. `renderScheduler`, `renderMindmap`) and deferred execution (using `useEffect` and `requestAnimationFrame` or `setTimeout`) to stagger loading over multiple frames and avoid main thread freezing on page entry.

## Deliverables
- Write `analysis.md` in your folder (`.agents/explorer_opt_r3/`) detailing:
  - Exact components to wrap in `React.memo`.
  - Inline event handlers/computations that should be wrapped in `useCallback` / `useMemo`.
  - Design of staggered preloading flags and initialization sequence in `PortfolioDashboardView.tsx`.
- Report back with a summary when complete.
