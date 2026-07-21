# Handoff Report — Requirement 2 (R2: 3D WebGL Frame Pause & Physics Freezing)

## 1. Observation

### Code Inspections
- **`src/lib/OntologyCanvasEngine.ts` (Lines 123-138 & Line 824)**:
  ```ts
  123:   public pause(): void {
  124:     this.isPaused = true;
  125:   }
  126: 
  127:   public resume(): void {
  128:     this.isPaused = false;
  129:     this.wakeUp();
  130:   }
  131: 
  132:   public freeze(): void {
  133:     this.isPaused = true;
  134:     for (const node of this.nodes) {
  135:       node.vx = 0;
  136:       node.vy = 0;
  137:     }
  138:   }
  ...
  824:   tick(): boolean {
  825:     if (this.isPaused) return false;
  ```

- **`src/components/MindMap3D.tsx` (Lines 860-883)**:
  ```ts
  860:     const handleVisibilityChange = () => {
  861:       if (document.hidden) {
  862:         if (animationRef.current) {
  863:           cancelAnimationFrame(animationRef.current);
  864:           animationRef.current = 0;
  865:         }
  866:         engineRef.current?.freeze();
  867:       } else if (isActive) {
  868:         resumePhysicsLoopRef.current?.();
  869:       }
  870:     };
  871:     document.addEventListener('visibilitychange', handleVisibilityChange);
  872: 
  873:     return () => {
  874:       ro.disconnect();
  875:       if (resizeTimeout) {
  876:         cancelAnimationFrame(resizeTimeout);
  877:       }
  878:       canvas.removeEventListener('wheel', wheelHandler);
  879:       document.removeEventListener('visibilitychange', handleVisibilityChange);
  880:       if (animationRef.current) {
  881:         cancelAnimationFrame(animationRef.current);
  882:         animationRef.current = 0;
  883:       }
  ...
  ```

- **`src/components/MindMap3D.tsx` (Lines 832-841)**:
  ```ts
  832:     resumePhysicsLoopRef.current = () => {
  833:       if (!isActive || document.hidden) return;
  834:       if (animationRef.current === 0) {
  835:         if (engineRef.current) {
  836:           engineRef.current.needsRedraw = true;
  837:         }
  838:         lastFrameTime = performance.now();
  839:         animationRef.current = requestAnimationFrame(loop);
  840:       }
  841:     };
  ```

### Build & Verification Commands
- `npx tsc --noEmit`: Executed successfully with zero errors.
- `node scripts/run-harness.js`: Failed due to ESLint errors in test files (`__tests__/r2-physics-visibility.test.tsx`: `require()` style import is forbidden).

## 2. Logic Chain

1. **Velocity Zeroing & Physics Pause (`freeze()` / `pause()`)**:
   - Calling `engine.pause()` sets `this.isPaused = true`.
   - Calling `engine.freeze()` sets `this.isPaused = true` and loops through `this.nodes`, setting `node.vx = 0` and `node.vy = 0` for all nodes.
   - In `tick()`, line 824 checks `if (this.isPaused) return false;`. This prevents physics updates and dirty calculations while paused/frozen.

2. **`visibilitychange` Cleanup**:
   - `document.addEventListener('visibilitychange', handleVisibilityChange)` is added when the canvas effect runs.
   - On component unmount, `document.removeEventListener('visibilitychange', handleVisibilityChange)` is called inside the cleanup callback (line 879).
   - Event listener cleanup on unmount is properly implemented.

3. **CRITICAL DEFECT — Canvas Stays Permanently Frozen Upon Tab Return**:
   - When the user switches to another tab (`document.hidden === true`), `handleVisibilityChange` calls `engineRef.current?.freeze()`.
   - `freeze()` sets `engine.isPaused = true`.
   - When the user switches back to the tab (`document.hidden === false`), `handleVisibilityChange` calls `resumePhysicsLoopRef.current?.()`.
   - `resumePhysicsLoopRef.current` starts `requestAnimationFrame(loop)`.
   - In `loop()`, `engine.tick()` is called.
   - Inside `engine.tick()`, `if (this.isPaused) return false;` fires because `this.isPaused` is STILL `true` — `engineRef.current?.resume()` was NEVER called.
   - Because `engine.tick()` returns `false`, `loop()` does not render and sets `animationRef.current = 0`, exiting the animation loop without ever unsetting `isPaused`.
   - Result: The 3D MindMap canvas is permanently stuck in frozen state after tab switching.

## 3. Caveats

- TypeScript check (`npx tsc --noEmit`) passed with 0 errors.
- `node scripts/run-harness.js` failed on ESLint lint rules in test files (`__tests__`).

## 4. Conclusion

**Verdict**: **FAIL / REQUEST_CHANGES**

- **Pass**: `freeze()` correctly zeroes node velocities (`vx`, `vy`) and `pause()` stops physics tick via `isPaused`.
- **Pass**: `visibilitychange` listener is cleaned up properly on unmount.
- **Critical Finding**: When returning from tab hide (`document.hidden` becomes false), `engine.resume()` is never called. As a result, `engine.isPaused` remains `true` permanently, causing `tick()` to continuously return `false` and freezing the 3D MindMap canvas permanently.
- **Required Fix**: Update `handleVisibilityChange` (or `resumePhysicsLoopRef`) in `MindMap3D.tsx` to call `engineRef.current?.resume()` when tab becomes visible.

## 5. Verification Method

- **Static Verification**:
  1. Inspect `src/components/MindMap3D.tsx` around line 867 (`handleVisibilityChange`) and line 835 (`resumePhysicsLoopRef`).
  2. Verify if `engineRef.current?.resume()` is called when `!document.hidden`.
- **Runtime Verification**:
  1. Run Next.js app (`npm run dev`).
  2. Open 3D MindMap, switch browser tab, and return.
  3. Verify whether nodes resume animation and interactive canvas responses (orbiting/dragging) work.
