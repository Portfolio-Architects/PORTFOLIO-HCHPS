# Handoff Report — explorer_r2_3

## 1. Observation
- **`src/components/MindMap3D.tsx` (Lines 160–169)**:
  `isActive` prop controls `engineActive` state via `setTimeout(..., 150)`.
- **`src/components/MindMap3D.tsx` (Lines 685–701)**:
  The animation loop `useEffect` cancels `animationRef.current` when `isActive` or `engineActive` becomes `false`.
- **`src/components/MindMap3D.tsx` (Lines 831–839)**:
  ```tsx
  resumePhysicsLoopRef.current = () => {
    if (animationRef.current === 0) {
      if (engineRef.current) {
        engineRef.current.needsRedraw = true;
      }
      lastFrameTime = performance.now();
      animationRef.current = requestAnimationFrame(loop);
    }
  };
  ```
  `resumePhysicsLoopRef.current` does **not** check `isActive`, `engineActive`, `isPaused`, or `document.hidden`.
- **`src/components/MindMap3D.tsx` (Lines 763–765)**:
  ```tsx
  const now = performance.now();
  const delta = now - lastFrameTime;
  lastFrameTime = now;
  ```
  `delta` calculation inside `loop()` is not clamped against large background delays (> 100ms).
- **`src/lib/OntologyCanvasEngine.ts`**:
  `OntologyCanvasEngine` has `physicsAlpha`, `idleFramesCount`, `needsRedraw`, and `physicsFrameCount`, but lacks `isPaused: boolean`, `pause(): void`, `resume(): void`, `start(): void`, or `stop(): void` methods.

## 2. Logic Chain
1. **From Observation 1 & 3**: When a user switches to a different tab within the application, `isActive` becomes `false` and `cancelAnimationFrame` is called. However, `resumePhysicsLoopRef.current` remains attached to event listeners (e.g. mouse move, wheel, window resize). If an event fires while `isActive === false`, `resumePhysicsLoopRef.current` runs, sees `animationRef.current === 0`, and schedules `requestAnimationFrame(loop)` again because it lacks an `isActive` / `isPaused` guard.
2. **From Observation 4**: When switching browser tabs or minimizing the window, `isActive` (React prop) stays `true`, but the browser throttles `requestAnimationFrame`. When the tab becomes active again, `lastFrameTime` holds a timestamp from before the tab was hidden. Upon resume, `delta = now - lastFrameTime` becomes extremely large (seconds to minutes), causing profiler lag spikes and potential physics/camera whiplash unless `lastFrameTime` is reset to `performance.now()` on resume AND `delta` is clamped in `loop()`.
3. **From Observation 5**: Adding `isPaused: boolean`, `pause()`, `resume()`, `start()`, `stop()` to `OntologyCanvasEngine` provides a single authoritative state for pausing physics and rendering, short-circuiting `tick()` instantly when paused (`if (this.isPaused) return false;`).

## 3. Caveats
- **No caveats.** The analysis covers tab switching within the React app (`isActive` prop), browser tab switching / window minimizing (Page Visibility API `visibilitychange`), engine lifecycle state methods, and `deltaTime` physics protection.

## 4. Conclusion
Requirement 2 (R2) analysis is complete. The explicit 4-step implementation plan and patch set in `analysis.md` will ensure:
1. Moving away from the mindmap tab or hiding the window calls `cancelAnimationFrame(animationRef.current)`, sets `animationRef.current = 0`, and sets `engine.isPaused = true`.
2. On resume, `engine.resume()` is called, `lastFrameTime` is reset to `performance.now()`, `delta` in `loop()` is clamped to <= 100ms, and `resumePhysicsLoop` is guarded against inactive/hidden execution.
3. TypeScript cleanliness is 100% maintained with 0 side effects.

## 5. Verification Method
1. **File Inspection**:
   - Inspect `src/lib/OntologyCanvasEngine.ts` to confirm presence of `isPaused`, `pause()`, `resume()`, `start()`, `stop()`, and `if (this.isPaused) return false;` in `tick()`.
   - Inspect `src/components/MindMap3D.tsx` to confirm `visibilitychange` listener, guarded `resumePhysicsLoop`, and `deltaTime` clamping.
2. **Build and Type Check**:
   - Propose/Run `node scripts/run-harness.js` or `npx tsc --noEmit` to verify type cleanliness and zero TypeScript errors.
3. **Behavioral Invalidation Conditions**:
   - Moving to another tab while monitoring DevTools Performance tab shows 0% CPU/GPU usage from `MindMap3D`.
   - Returning to the mindmap tab after 10+ seconds results in smooth resume without node teleportation, whiplash, or lag spike logs.
