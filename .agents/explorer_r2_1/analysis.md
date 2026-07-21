# R2 Analysis Report: 3D WebGL / Canvas Frame Pause & Physics Freezing

## Executive Summary
This report analyzes Requirement 2 (R2): **3D WebGL / Canvas Frame Pause & Physics Freezing** within the VITAL Work & Wealth Architecture codebase.
The investigation covers:
1. Identifying exact scheduling mechanisms for `requestAnimationFrame` and physics velocity/position integration loops across `MindMap3D.tsx`, `OntologyCanvasEngine.ts`, and `OntologyRenderer.ts`.
2. Evaluating current SPA module tab detection (`activeModule === 'mindmap'`) and identifying browser visibility gaps (`document.visibilityState`).
3. Designing an immediate cancellation and physics freezing strategy when navigating away from the mindmap tab.
4. Designing a zero-whiplash, instant-resume protocol upon returning to the mindmap tab without physics delta spikes or re-simulation explosions.

---

## 1. Codebase Architecture & Loop Locations

### A. Animation Frame Scheduling (`requestAnimationFrame`)
- **Primary Source**: `src/components/MindMap3D.tsx`
- **Loop Functions**:
  - `loop()` (lines 738–829): Main 60 FPS render & physics tick loop.
  - `animationRef.current` (Ref initialized to `0`): Stores the handle returned by `requestAnimationFrame`.
  - Scheduling points:
    - Line 823: `animationRef.current = requestAnimationFrame(loop);` (scheduled at end of frame when `engine.tick()` returns `isDirty = true`).
    - Line 837: `animationRef.current = requestAnimationFrame(loop);` (scheduled inside `resumePhysicsLoopRef.current` when re-awakening an idle engine).
    - Line 715: `resizeTimeout = requestAnimationFrame(...)` (throttled canvas resize handler).

### B. Physics Integration & State Engine (`OntologyCanvasEngine.ts`)
- **Primary Source**: `src/lib/OntologyCanvasEngine.ts`
- **Execution Flow**:
  - `tick()` (line 808): Called once per frame inside `loop()`.
  - `runPhysicsTick()` (lines 498–806):
    - Calculates spatial hash grid repulsions (charge strength 15,000, 45px safety margin, soft-start scale).
    - Calculates spring attractions along edges (weight-based target distance).
    - Calculates orbital layer gravity (restores concentric radial distance based on `orbitIndex`).
    - Applies damping (`damping = 0.75`), velocity clamping (`maxSpeed = 8.0`), dead-zone filtering (`speedSq < 0.012 => vx=0, vy=0`).
    - Integrates position: `worldX += vx * physicsAlpha`, `worldY += vy * physicsAlpha`.
  - LERP Morphing & Camera Interpolation (lines 866–900):
    - Smoothly transitions camera offsets/zoom (`LERP_SPEED = 0.08`).
    - Interpolates node target positions (`targetWorldX/Y`).
  - Idle / Sleep Detection (lines 845–851):
    - Increments `idleFramesCount`. When `idleFramesCount > 90` (~1.5 seconds without interaction), `tick()` sets `needsRedraw = false` and returns `false`, allowing `animationRef.current` to drop to `0`.

### C. Role of `OntologyRenderer.ts`
- **Primary Source**: `src/lib/engine/OntologyRenderer.ts`
- **Role**: Pure static rendering helper class.
  - Executes `OntologyRenderer.render(renderContext)`.
  - Handles Canvas 2D drawing operations: background grid, orbital concentric rings, edge curves, flow particles, node bubbles, text labels, and connection handles.
  - **Does NOT** manage animation frame scheduling, `requestAnimationFrame`, or physics velocity integration. It receives pre-calculated coordinates from `OntologyCanvasEngine`.

---

## 2. Tab Activity Detection Analysis

### A. SPA Module Navigation (Current Implementation)
- **Parent Container**: `src/app/page.tsx` (lines 683–700)
  - Preserves mounted DOM node when navigating away:
    ```tsx
    <div className={activeModule === 'mindmap' ? 'block' : 'hidden'}>
      <MindMap3D ... isActive={activeModule === 'mindmap'} />
    </div>
    ```
- **Child Component**: `src/components/MindMap3D.tsx`
  - Accepts `isActive?: boolean` prop.
  - Controls internal state `engineActive` via a 150ms debounce timer (lines 158–170):
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
  - Main effect hook (lines 685–885) cancels `animationRef.current` and cleans up event listeners whenever `isActive` or `engineActive` becomes `false`.

### B. Identified Detection Gaps
1. **Browser Tab / Window Inactivity (`document.visibilityState`)**:
   - When the user switches browser tabs or minimizes the browser window while remaining on `activeModule === 'mindmap'`, `isActive` remains `true`.
   - The browser automatically throttles or pauses `requestAnimationFrame`, but `performance.now()` continues advancing in the background.
   - Upon tab re-focus, `loop()` receives a massive timestamp jump, potentially distorting performance profiler stats or causing unexpected catch-up iterations if delta time is unmanaged.
2. **Lack of Explicit Engine Freeze API**:
   - `OntologyCanvasEngine` has `wakeUp()` (line 125), but lacks a symmetrical `freeze()` or `pause()` method to explicitly reset velocities (`vx=0, vy=0`), clear LERP momentum, and force `physicsAlpha = 0.0` when leaving the tab.

---

## 3. Immediate Frame Pause & Physics Freezing Strategy

To guarantee zero background resource consumption and freeze all physical movement when navigating away:

1. **Multi-Tiered Active State Resolution**:
   - Create a unified active state boolean inside `MindMap3D.tsx`:
     `const isEffectiveActive = isActive && engineActive && isDocumentVisible;`
   - Bind a `visibilitychange` event listener on `document`:
     ```typescript
     const [isDocumentVisible, setIsDocumentVisible] = useState(!document.hidden);
     useEffect(() => {
       const handleVisibility = () => setIsDocumentVisible(!document.hidden);
       document.addEventListener('visibilitychange', handleVisibility);
       return () => document.removeEventListener('visibilitychange', handleVisibility);
     }, []);
     ```

2. **Immediate Loop Cancellation**:
   - When `isEffectiveActive` becomes `false`:
     - Execute `cancelAnimationFrame(animationRef.current)` and set `animationRef.current = 0`.
     - Execute `cancelAnimationFrame(resizeTimeout)` if pending.

3. **Physics Freezing Protocol in Engine**:
   - Add `freeze()` method to `OntologyCanvasEngine`:
     ```typescript
     public freeze(): void {
       this.physicsAlpha = 0.0;
       this.idleFramesCount = 999;
       this.needsRedraw = false;
       for (const node of this.nodes) {
         node.vx = 0;
         node.vy = 0;
         if (node.targetWorldX !== undefined) node.worldX = node.targetWorldX;
         if (node.targetWorldY !== undefined) node.worldY = node.targetWorldY;
       }
     }
     ```
   - Call `engine.freeze()` inside `MindMap3D.tsx` cleanup when `isEffectiveActive` drops to `false`.
   - Retain `engineRef.current` in memory without calling `destroy()`, maintaining all node positions, custom overrides, and cached `orbitAngle` values.

---

## 4. Zero-Whiplash Instant Resume Strategy

When returning to the MindMap tab (`isEffectiveActive` transitions `false -> true`):

1. **Delta Time Clamping & Timestamp Sync**:
   - Reset `lastFrameTime = performance.now()` immediately prior to restarting `requestAnimationFrame(loop)`.
   - Add a safety delta clamp inside `loop()`:
     ```typescript
     const now = performance.now();
     let delta = now - lastFrameTime;
     lastFrameTime = now;
     
     // Guard against background tab time jumps (Whiplash Prevention)
     if (delta > 100 || delta < 0) {
       delta = 16.67; // Clamp to standard 60 FPS single-frame delta (~16.67ms)
     }
     ```

2. **Soft Physics Re-awakening**:
   - Call `engine.wakeUp()`:
     - Sets `idleFramesCount = 0`, `physicsFrameCount = 0`, `needsRedraw = true`.
     - Forces single-frame initial snap (`isFirstFrame = true` or `physicsAlpha = 0.2`) to prevent explosive velocity accumulation.

3. **Canvas Size & DPR Synchronization**:
   - Execute single non-deferred `resize()` upon resume to ensure `getBoundingClientRect()` and `devicePixelRatio` match container dimensions before drawing the first resumed frame.

---

## 5. Summary Matrix & Proposed Code Changes

| Component | Target File | Proposed Action / Change |
| --- | --- | --- |
| **Visibility Guard** | `MindMap3D.tsx` | Add `document.visibilityState` listener and combine into `isEffectiveActive`. |
| **Loop Cancellation** | `MindMap3D.tsx` | Explicitly cancel `animationRef.current` when `isEffectiveActive` is false. |
| **Delta Clamping** | `MindMap3D.tsx` | Clamp `delta` to `16.67ms` if `delta > 100ms` inside `loop()` to prevent whiplash. |
| **Engine Freeze API** | `OntologyCanvasEngine.ts` | Add `freeze()` method to zero out `vx, vy`, snap `worldX/Y` to targets, and set `physicsAlpha = 0`. |
| **Engine Resume API** | `OntologyCanvasEngine.ts` | Call `wakeUp()` on resume to re-enable `needsRedraw` cleanly. |

---

## Conclusion
Implementing these strategies will achieve:
1. **0% CPU/GPU overhead** when MindMap tab is inactive or browser is minimized.
2. **Instant, smooth resume** without node explosion, spatial teleportation, or lag spike profiler artifacts.
3. **100% state preservation** of custom pins, orbit angles, and camera coordinates.
