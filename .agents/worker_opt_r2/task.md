# Worker 2 Task: Next.js Lazy Loading & FCP (R2) Implementation

## Objective
Convert heavy components (`MindMap3D`, `WeeklyScheduler`, `WikiEditor`) to dynamic import (`ssr: false`) with matching skeletons to improve FCP and prevent Cumulative Layout Shift (CLS).

## Reference Materials
Please read the Explorer's synthesis:
- Synthesis Report: `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\orchestrator\synthesis.md`
- Lazy Loading Details: `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_opt_r2\analysis.md`

## Required Actions

### 1. WikiEditor Deferred Loading inside `src/components/MindMap3D.tsx`
- Remove static import: `import { WikiEditor } from './WikiEditor';`
- Import dynamic: `import dynamic from 'next/dynamic';`
- Define `WikiEditor` dynamic loader:
  ```tsx
  const WikiEditor = dynamic(() => import('./WikiEditor').then(mod => mod.WikiEditor), {
    ssr: false,
    loading: () => <WikiEditorSkeleton />
  });
  ```
- Implement `WikiEditorSkeleton` in the file `src/components/MindMap3D.tsx`. Use the skeleton UI layout designed by the Explorer in `explorer_opt_r2/analysis.md` (lines 108-150), utilizing high-contrast dark classes and an animated spinner/pulse.

### 2. WeeklyScheduler Loading Skeleton in `src/components/dashboard/PortfolioDashboardView.tsx`
- Replace the existing `WeeklyScheduler` dynamic import definition to use a custom `WeeklySchedulerSkeleton` loading fallback.
- Implement `WeeklySchedulerSkeleton` inside `src/components/dashboard/PortfolioDashboardView.tsx`. Use the skeleton UI layout designed by the Explorer in `explorer_opt_r2/analysis.md` (lines 169-218) that matches the full size (`620px`) of the scheduler grid to eliminate Cumulative Layout Shift (CLS).

### 3. MindMap3D Loading Skeleton in `src/app/page.tsx`
- Replace the existing `MindMap3D` dynamic import definition to use a custom `MindMap3DSkeleton` loading fallback.
- Implement `MindMap3DSkeleton` inside `src/app/page.tsx`. Use the skeleton UI layout designed by the Explorer in `explorer_opt_r2/analysis.md` (lines 237-282), with concentric orbital wireframe rings and a dark theme.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Verification
- Run `npm run lint` and `npm run build` after completing the changes to ensure everything compiles without errors.
- Ensure that dynamic chunks are generated (e.g. `components_WeeklyScheduler_tsx.js` or dynamic chunks) in build output logs.
- Report back with a summary of files changed and validation output.
