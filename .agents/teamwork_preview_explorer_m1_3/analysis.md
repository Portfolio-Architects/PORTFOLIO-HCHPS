# System-wide Zero-Stall, Background Tab Pause & Hydration Isolation Analysis Report

## Executive Summary
This investigation analyzed the entire codebase of **PORTFOLIO - VITAL** for compliance with:
1. **Background Tab Pause Standards (AGENTS.md Sec. 2-J)**: DB watcher polling, 3D simulation loops, and React Query background refetching.
2. **Delta Clamping & Zero-Stall Frame Calculations (AGENTS.md Sec. 2-J)**: Frame delta calculations in WebGL/Canvas physics loops and performance monitors.
3. **Initial Server Hydration & Staggered Chunk Isolation (AGENTS.md Sec. 2-I)**: Dynamic import `dynamic(() => import(...), { ssr: false })` compliance and Skeleton UI fallback guards for heavy components.
4. **Gatekeeper Harness Infrastructure (`scripts/run-harness.js` & `scripts/diagnose-targets.js`)**: Validation of Zod database integrity, ESLint/TypeScript checks, MVC ontology rule enforcement, and diagnostic reporting.

Overall compliance across the codebase is **EXCELLENT**. All 7 heavy components comply with dynamic import rules, frame delta clamping is implemented in physics and freeze detector loops, DB watcher polling pauses when `document.hidden` is true, and harness validation is fully functional. A single minor optimization opportunity was identified in `MindMap3D.tsx`'s performance metrics UI timer.

---

## 1. Background Tab Pause & DB Watcher Polling Audit (AGENTS.md Sec. 2-J)

### A. React Query Hooks & Configuration
- **Global Configuration (`src/lib/query-client.ts:15-16`)**:
  ```typescript
  refetchOnWindowFocus: false, // Prevent heavy main thread block on window focus
  refetchOnReconnect: false,   // Prevent automatic refetch on network reconnect
  ```
  `queryClient` establishes global defaults disabling aggressive refetching on window focus or reconnect.
- **Custom Hooks Audit (`src/hooks/useAppLogs.ts:29-30`)**:
  ```typescript
  refetchInterval: enabled ? 10000 : false,
  refetchIntervalInBackground: false,
  ```
  `useAppLogs` explicitly sets `refetchIntervalInBackground: false`, halting log polling while the browser tab is hidden.
- Other query hooks (`useBudget.ts`, `useTasks.ts`, `useClassificationWords.ts`) inherit the safe global default `refetchOnWindowFocus: false`.

### B. DB Watcher Singleton Polling (`src/hooks/useGraphCustomization.ts:772-785`)
- **Background Pause**:
  ```typescript
  activePollInterval = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    runPoll();
  }, 10000);
  ```
- **Tab Return Handler**:
  ```typescript
  const handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && enabled) {
      runPoll();
      startOrResetInterval();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  ```
- **Assessment**: Fully compliant. Polling yields 0 DB requests during background tab hidden state and resumes instantly upon returning to focus.

### C. 3D WebGL / Canvas Simulation Ticks (`src/components/MindMap3D.tsx:856-867`)
- **Visibility Change Listener**:
  ```typescript
  const handleVisibilityChange = () => {
    if (document.hidden) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = 0;
      }
      engineRef.current?.freeze();
    } else if (isActive) {
      engineRef.current?.resume();
      resumePhysicsLoopRef.current?.();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  ```
- **Assessment**: Physics engine is frozen and `requestAnimationFrame` loop is cancelled when the tab is backgrounded.

### D. Identified Optimization Opportunity
- **MindMap3D Performance Metrics Timer (`src/components/MindMap3D.tsx:1776-1781`)**:
  ```typescript
  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => {
      setPerfMetrics(PerformanceProfiler.getInstance().getMetrics());
      setLagSpikes(PerformanceProfiler.getInstance().getLagSpikes());
    }, 1000);
    return () => clearInterval(timer);
  }, [isActive]);
  ```
  *Issue*: When `MindMap3D` is active but the browser tab is backgrounded (`document.hidden`), this `setInterval` continues triggering React state updates (`setPerfMetrics`, `setLagSpikes`) every 1000ms.
  *Fix Strategy*: Add `if (document.hidden) return;` at the top of the `setInterval` callback.

---

## 2. Frame Delta Calculation & Clamping Audit (AGENTS.md Sec. 2-J)

### A. Physics Animation Loop Clamping (`src/components/MindMap3D.tsx:758-760`)
- **Implementation**:
  ```typescript
  const now = performance.now();
  const delta = Math.min(now - lastFrameTime, 100);
  lastFrameTime = now;
  ```
- **Tab Focus Reset (`src/components/MindMap3D.tsx:834`)**:
  ```typescript
  resumePhysicsLoopRef.current = () => {
    if (!isActive || document.hidden) return;
    if (engineRef.current) {
      engineRef.current.resume?.();
      engineRef.current.needsRedraw = true;
    }
    if (animationRef.current === 0) {
      lastFrameTime = performance.now(); // Reset timestamp on resume
      animationRef.current = requestAnimationFrame(loop);
    }
  };
  ```
- **Assessment**: Clamping `delta` to `Math.min(..., 100)` caps maximum delta step to 100ms. Resetting `lastFrameTime` when tab returns prevents frame accumulator explosion ("whiplash" or particle ejection).

### B. UI Thread Freeze & Stall Detector (`src/hooks/useFreezeDetector.ts:87-105`)
- **Implementation**:
  ```typescript
  const checkFrameDelta = (now: number) => {
    if (document.hidden) {
      lastTime = now;
      animFrameId = requestAnimationFrame(checkFrameDelta);
      return;
    }
    const delta = now - lastTime;
    if (!observer && delta > 150 && delta <= 4000) {
      handleFreeze(delta);
    }
    lastTime = now;
    animFrameId = requestAnimationFrame(checkFrameDelta);
  };

  const handleVisibilityChange = () => {
    lastTime = performance.now();
  };
  window.addEventListener('visibilitychange', handleVisibilityChange);
  ```
- **Assessment**: Fully compliant. Prevents tab-switch false-positive stall reports.

---

## 3. Dynamic Import & High-Contrast Skeleton UI Audit (AGENTS.md Sec. 2-I)

All 7 heavy components specified in AGENTS.md Sec. 2-I were audited:

| Component | Dynamic Import (`ssr: false`) | Skeleton UI Fallback Guard | Location |
|-----------|-------------------------------|----------------------------|----------|
| `PortfolioDashboardView` | ✅ `dynamic(..., { ssr: false })` | ✅ `PortfolioDashboardViewSkeleton` | `src/app/page.tsx:219` |
| `MindMap3D` | ✅ `dynamic(..., { ssr: false })` | ✅ `MindMap3DSkeleton` | `src/app/page.tsx:269` |
| `WorkspaceView` | ✅ `dynamic(..., { ssr: false })` | ✅ `WorkspaceViewSkeleton` | `src/app/page.tsx:274` |
| `ProjectManagementPage` | ✅ `dynamic(..., { ssr: false })` | ✅ `ProjectManagementPageSkeleton` | `src/app/page.tsx:279` |
| `SecurityLockScreen` | ✅ `dynamic(..., { ssr: false })` | ✅ `null` (Overlay modal) | `src/app/page.tsx:285` |
| `AppLogModal` | ✅ `dynamic(..., { ssr: false })` | ✅ `null` (Overlay modal) | `src/app/page.tsx:290` |
| `AIAssistantModal` | ✅ `dynamic(..., { ssr: false })` | ✅ `null` (Overlay modal) | `src/app/page.tsx:295` |

### Subcomponent Dynamic Isolation & Skeletons:
- `WeeklyScheduler`: Imported dynamically in `ProjectManagementPage.tsx:32` with `WeeklySchedulerSkeleton`.
- `BudgetDashboardView`: Imported dynamically in `WorkspaceView.tsx:23` with `BudgetDashboardSkeleton`.
- `WikiEditor`: Imported dynamically in `MindMap3D.tsx:72` with `WikiEditorSkeleton`.

### Staggered Chunk Preloading Protocol (`src/app/page.tsx:410-437`):
Uses `requestIdleCallback` to stagger module chunk downloading after global intro completes:
- 3.5s delay: `import('@/components/MindMap3D')`
- 5.5s delay: `import('@/components/WorkspaceView')`
- 7.5s delay: `import('@/components/project/ProjectManagementPage')`

---

## 4. Gatekeeper Harness Audit (`scripts/run-harness.js` & `scripts/diagnose-targets.js`)

### Harness Verification Architecture:
1. **Zod Database Gatekeeper (`scripts/run-harness.js:9-186`)**:
   - Compares JSON files in `data/*.json` (`TASKS`, `BUDGET_CATEGORIES`, `BUDGET_ENTRIES`, `PROJECTS`) against Zod schemas.
   - Logs detailed line/field-level Zod formatting errors upon failure.
2. **Lint/Type Gatekeeper (`scripts/run-harness.js:194-218`)**:
   - Executes `npm run lint` (`eslint`).
   - If warnings or errors are flagged, automatically executes auto-fixing (`npx eslint --fix .`) and re-verifies.
3. **Milestone Sync (`scripts/run-harness.js:220-234`)**:
   - Automatically executes `node scripts/sync-rules.js` to synchronize `AGENTS.md` logs.
4. **Codebase Diagnostics (`scripts/diagnose-targets.js`)**:
   - **MVC Ontology Check**: Scans `src/components/` to verify no direct `fetch` / `axios` calls exist in UI views.
   - **Performance Bottleneck Check**: Scans for $O(N^2)$ nested loops inside `.map`/`.filter`, state mutations in empty `useEffect` arrays, console logging spams, and synchronous heavy imports.
   - Saves compiled diagnostic report to `data/diagnose_report.json`.

---

## Recommended Action Plan / Fix Strategy

1. **Minor Refinement in `src/components/MindMap3D.tsx` (Line 1776)**:
   - Add background tab check inside performance metrics `setInterval`:
     ```typescript
     useEffect(() => {
       if (!isActive) return;
       const timer = setInterval(() => {
         if (document.hidden) return;
         setPerfMetrics(PerformanceProfiler.getInstance().getMetrics());
         setLagSpikes(PerformanceProfiler.getInstance().getLagSpikes());
       }, 1000);
       return () => clearInterval(timer);
     }, [isActive]);
     ```
2. **Maintain Current Architecture**:
   - Keep dynamic import and skeleton patterns intact across future UI module additions.
