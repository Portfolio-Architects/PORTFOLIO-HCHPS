# Dashboard and Performance Optimization Plan (R1, R2, R3)

## Objectives
Enhance visual presentation, improve dark-theme contrast, implement lazy-loading, and resolve re-rendering/frame drops for the VITAL Dashboard app:
1. **R1 (High Contrast Dark Theme UI)**: Refactor target components (`PortfolioDashboardView.tsx`, `WeeklyScheduler.tsx`, `MindMap3D.tsx`, `MindMapInspector.tsx`, etc.) to use a high-contrast dark theme, import/use `Outfit`/`Inter` fonts, and improve readability with precise borders, shadows, and paddings.
2. **R2 (Next.js Lazy Loading)**: Convert heavy components (`MindMap3D`, `WeeklyScheduler`, `WikiEditor`) to dynamic import (`ssr: false`) to minimize bundle sizes and FCP time.
3. **R3 (Render Blocker/Lock Defense)**: Apply `React.memo`, `useCallback`, and `useMemo` to isolate re-renderings. Implement staggered preloading logic to stagger DOM loads.

## Milestones
| Milestone | Name | Objective | Assigned Subagents | Status |
|-----------|------|-----------|--------------------|--------|
| M1 | Codebase Analysis & Strategy | Analyze components, collect imports/rendering info, and plan layout changes | Explorer (3 parallel) | DONE |
| M2 | High-Contrast Readability (R1) | Refactor component styles, add Outfit/Inter fonts, optimize layout contrast | Worker, Reviewer | IN_PROGRESS |
| M3 | Lazy Loading (R2) | Inject dynamic imports with `ssr: false` | Worker, Reviewer | PLANNED |
| M4 | Performance & Render Isolation (R3) | Memoize components, optimize callbacks/computations, implement staggered preloading | Worker, Reviewer | PLANNED |
| M5 | Verification & Rule Synchronization | Build, lint, log updates in Engineering Report.md, sync rules | Challenger, Auditor | PLANNED |

## Detailed Verification Plan
1. **Lint and Build**: Run `npm run lint` and `npm run build` after modifications.
2. **Code Structure check**: Verify dynamic chunks are generated for lazy-loaded files and verify font imports are present.
3. **Component Profiling**: Challenger checks component props, re-renderings, and dependencies.
4. **Auditing**: Forensic Auditor verifies that optimization isn't cheated or hardcoded.
