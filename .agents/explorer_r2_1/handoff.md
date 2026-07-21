# Handoff Report — Requirement 2 (R2): 3D WebGL Frame Pause & Physics Freezing

## 1. Observation
- **Parent SPA Navigation**: In `src/app/page.tsx` (lines 683–700), `MindMap3D` is kept mounted in the DOM when navigating between tabs via `<div className={activeModule === 'mindmap' ? 'block' : 'hidden'}>`, passing `isActive={activeModule === 'mindmap'}`.
- **Component Active State Debounce**: In `src/components/MindMap3D.tsx` (lines 158–170), `engineActive` is updated via a 150ms `setTimeout`:
  ```tsx
  useEffect(() => {
    if (!isActive) {
      setEngineActive(false);
      return;
    }
    const timer = setTimeout(() => {
      setEngineActive(true);
    }, 150);
    return () => clearTimeout(timer);
  }, [isActive]);
  ```
- **Animation Loop Scheduling**: In `src/components/MindMap3D.tsx`:
  - Line 823: `animationRef.current = requestAnimationFrame(loop);` inside `loop()`.
  - Line 837: `animationRef.current = requestAnimationFrame(loop);` inside `resumePhysicsLoopRef.current`.
  - Line 715: `resizeTimeout = requestAnimationFrame(...)` inside `resize()`.
- **Loop Cleanup on Inactive**: In `src/components/MindMap3D.tsx` (lines 858–867), cleanup executes:
  ```tsx
  if (animationRef.current) {
    cancelAnimationFrame(animationRef.current);
    animationRef.current = 0;
  }
  ```
- **Physics Integration & Dampening**: In `src/lib/OntologyCanvasEngine.ts`:
  - Lines 751–770: `vx` and `vy` are damped (`damping = 0.75`), clamped (`[-8.0, 8.0]`), dead-zone filtered (`speedSq < 0.012`), and integrated: `node.worldX += vx * physicsAlpha`.
  - Lines 845–851: `idleFramesCount` triggers sleep after 90 idle frames.
  - Line 125: `wakeUp()` method exists:
    ```typescript
    public wakeUp(): void {
      this.physicsFrameCount = 0;
      this.physicsAlpha = 1.0;
      this.idleFramesCount = 0;
      this.needsRedraw = true;
    }
    ```
  - **No `freeze()` or `pause()` method** currently exists in `OntologyCanvasEngine.ts` to zero out velocity vectors and clear physics momentum on tab departure.
- **Timestamp Delta Computation**: In `src/components/MindMap3D.tsx` (lines 763–765):
  ```typescript
  const now = performance.now();
  const delta = now - lastFrameTime;
  lastFrameTime = now;
  ```
  If `lastFrameTime` is not reset immediately before resuming or if `delta` is un-clamped when waking from a background browser tab, `delta` can exceed several thousand milliseconds.

---

## 2. Logic Chain
1. **Observation**: `MindMap3D.tsx` receives `isActive` prop from `page.tsx`, which turns `false` when `activeModule !== 'mindmap'`.
2. **Reasoning**: Setting `isActive` to `false` triggers `setEngineActive(false)` and runs the main `useEffect` cleanup, calling `cancelAnimationFrame(animationRef.current)`.
3. **Observation**: `OntologyCanvasEngine` remains alive in `engineRef.current` without being destroyed during tab switches.
4. **Reasoning**: Node physical velocities (`vx`, `vy`) and LERP targets (`targetWorldX/Y`) remain un-cleared in `engineRef.current` memory when leaving the tab.
5. **Observation**: Browser tab switching (`document.visibilityState`) does not change `activeModule` or `isActive`.
6. **Reasoning**: If a user switches browser tabs, `isActive` stays `true`, leaving `requestAnimationFrame` to be throttled by the browser while `performance.now()` continues advancing.
7. **Observation**: Upon tab wake-up, `loop()` calculates `delta = now - lastFrameTime`. If `lastFrameTime` was set in the past, `delta` spikes.
8. **Conclusion**: To achieve complete 0% CPU overhead and zero whiplash:
   - Combine `isActive`, `engineActive`, and `document.visibilityState` into `isEffectiveActive`.
   - On `isEffectiveActive = false`: Cancel `rAF` and invoke `engine.freeze()` to zero velocities and lock coordinates.
   - On `isEffectiveActive = true`: Force `lastFrameTime = performance.now()`, clamp `delta` to `16.67ms` if `delta > 100ms`, and call `engine.wakeUp()`.

---

## 3. Caveats
- **No Direct Source Changes Made**: As an explorer, no changes were written to `MindMap3D.tsx` or `OntologyCanvasEngine.ts`.
- **Canvas Context Loss**: WebGL context loss is not applicable here because `OntologyCanvasEngine` utilizes standard HTML5 Canvas 2D (`CanvasRenderingContext2D`), so context restoration events (`webglcontextlost`) are not required.
- **ResizeObserver Timing**: When switching tabs, container dimensions may temporarily report `0x0` in hidden state (`display: none`). Resizing must occur AFTER `isEffectiveActive` becomes `true` and container is visible (`display: block`).

---

## 4. Conclusion
Requirement 2 (R2) can be fully satisfied with localized modifications in `src/components/MindMap3D.tsx` and `src/lib/OntologyCanvasEngine.ts`:
1. Add `freeze()` method to `OntologyCanvasEngine.ts` to reset velocities and physics alpha.
2. Add `document.visibilityState` listener to `MindMap3D.tsx`.
3. Clamp `delta` to `16.67ms` on wake-up inside `loop()` in `MindMap3D.tsx`.
4. Ensure `lastFrameTime` is synchronized to `performance.now()` before scheduling the resume frame.

---

## 5. Verification Method
1. **Inspect Report Files**:
   - Verify `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_r2_1\analysis.md`
   - Verify `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_r2_1\handoff.md`
2. **Code Inspection**:
   - Inspect `src/components/MindMap3D.tsx` lines 715–840 for `requestAnimationFrame` loop handles.
   - Inspect `src/lib/OntologyCanvasEngine.ts` lines 125, 498–806, 808–900 for physics ticks and sleep logic.
3. **Behavioral Invalidation Conditions**:
   - If `requestAnimationFrame` continues running while `isActive === false` or `document.hidden === true`.
   - If returning to the MindMap tab causes nodes to jump, vibrate, or explode outwards due to delta spike.
