# Requirement 2 (R2): 3D WebGL Frame Pause & Physics Freezing — Detailed Analysis Report

## Executive Summary
This report provides a comprehensive architectural and code-level investigation of **Requirement 2 (R2)**: 3D WebGL Frame Pause & Physics Freezing in the PORTFOLIO - VITAL application. 

The investigation examined `src/components/MindMap3D.tsx`, `src/lib/OntologyCanvasEngine.ts`, `src/lib/engine/OntologyRenderer.ts`, and `src/lib/engine/OntologyLayout.ts`. We traced the render loop, frame scheduling via `requestAnimationFrame`, timestamp delta calculations (`lastFrameTime`, `delta`), physics simulation mechanisms, idle auto-sleeping, and tab visibility / module switching dynamics.

---

## Key Findings

### 1. Component Structure & Responsibilities
- **`src/components/MindMap3D.tsx`**: React component wrapper. Manages DOM container, canvas dimensions, Device Pixel Ratio (`dpr`), mouse/touch/wheel event bindings, UI HUD, inspector panel, dynamic modals, and React lifecycle hooks.
- **`src/lib/OntologyCanvasEngine.ts`**: Standalone engine controller (decoupled from React). Owns graph state (`nodes`, `edges`), engine state (`cameraOffsetX/Y`, `zoom`, `physicsAlpha`, `idleFramesCount`), physics loop (`runPhysicsTick`), tick processing (`tick`), layout coordinate computation trigger, and idle sleeping logic.
- **`src/lib/engine/OntologyRenderer.ts`**: Pure 2D Canvas rendering engine. Renders 3D acrylic layer planes (L0~L3), concentric orbit rings, Bezier edges with flow particles/labels, and 3D perspective-projected node templates.
- **`src/lib/engine/OntologyLayout.ts`**: Spatial geometry engine. Calculates 3D perspective projections (`projectTo`), builds Spanning Trees for graph layout, places nodes along concentric orbits, and handles screen-space collision resolution.

---

### 2. Render / Tick Loop & Frame Scheduling Trace

#### A. Frame Scheduling via `requestAnimationFrame`
In `MindMap3D.tsx` (lines 685–885), the animation loop is governed by `useEffect` and `requestAnimationFrame`:
```typescript
// MindMap3D.tsx (lines 738-838)
const loop = () => {
  const engine = engineRef.current;
  if (!engine || !ctx || !canvasRef.current) {
    animationRef.current = 0;
    return;
  }
  ...
  const now = performance.now();
  const delta = now - lastFrameTime;
  lastFrameTime = now;

  if (delta > 32 && delta < 1000) {
    const diagnostic = PerformanceProfiler.getInstance().getSpikeDiagnostic(delta);
    PerformanceProfiler.getInstance().recordLagSpike(diagnostic);
  }

  const isDirty = engine.tick();
  if (isDirty) {
    const t0 = performance.now();
    engine.render(ctx, w, h);
    const t1 = performance.now();
    PerformanceProfiler.getInstance().recordRender(t1 - t0);
    animationRef.current = requestAnimationFrame(loop);
  } else {
    animationRef.current = 0;
  }
  ctx.restore();
};
```

#### B. Idle Auto-Sleeping Mechanism
`OntologyCanvasEngine.ts` (lines 808–852) tracks user activity and motion:
- When no user interaction (dragging, panning, zooming) or node LERP morphing occurs, `idleFramesCount` and `physicsFrameCount` increment each tick.
- Once `idleFramesCount > 90` (approx. 1.5 seconds of complete inactivity), `engine.tick()` returns `false`.
- When `isDirty` is `false`, `MindMap3D.tsx` sets `animationRef.current = 0` and stops calling `requestAnimationFrame(loop)`. This reduces idle CPU usage to near 0%.

#### C. Engine Wake-Up Trigger (`resumePhysicsLoop`)
When user events (mousemove, mousedown, mouseup, click, wheel, touchstart, touchmove, touchend, resize) occur:
```typescript
// MindMap3D.tsx (lines 831-839)
resumePhysicsLoopRef.current = () => {
  if (animationRef.current === 0) {
    if (engineRef.current) {
      engineRef.current.needsRedraw = true;
    }
    lastFrameTime = performance.now(); // Resets timestamp to current time on wake-up!
    animationRef.current = requestAnimationFrame(loop);
  }
};
```

---

### 3. Physics Simulation & Whiplash / Lag Spike Prevention

#### A. Physics Simulation Mechanics
`runPhysicsTick()` in `OntologyCanvasEngine.ts` (lines 498–806) includes:
1. **Spatial Hash Grid Repulsion** (cell size 160px) to prevent node overlaps.
2. **Spring Attraction** (`springStrength = 0.055`) towards dynamic equilibrium distances.
3. **Orbital Layer Gravity** (`orbitalGravity = 0.016 * (1.0 + degree * 0.45)`).
4. **Velocity Integration & Clamping**:
   - Damping factor: `0.75`
   - Speed cap: `maxSpeed = 8.0`
   - Dead-zone filter: `speedSq < 0.012` => velocities zeroed.
   - Position update: `node.worldX += vx * physicsAlpha`, `node.worldY += vy * physicsAlpha`.

#### B. Fixed-Step vs. Variable-Delta Integration
- **Fixed Step**: The engine's position updates (`worldX += vx * physicsAlpha`, `orbitAngle += orbitSpeed`, LERP morphing `currentX + dx * LERP_SPEED`) run fixed discrete steps per tick instead of multiplying by `deltaTime`.
- **Whiplash Protection**:
  1. Because physics equations do NOT multiply velocities by `deltaTime` (e.g. `x += v * delta`), large frame time gaps cannot cause numerical integration explosion (nodes shooting off to infinity).
  2. When waking from idle sleep (`animationRef.current === 0`), `resumePhysicsLoop()` explicitly executes `lastFrameTime = performance.now()`, ensuring `delta` starts at ~16ms on resume.
  3. LERP morphing uses a bounded step (`0.08` ratio per frame or `0.20` during initial 25 frames), preventing camera or node teleportation spikes.

---

### 4. Tab Visibility & `isActive` Prop Control

#### A. Internal Module Switching (`isActive` prop)
- `MindMap3D.tsx` receives `isActive?: boolean` (default `true`) from `page.tsx` (`isActive={activeModule === 'mindmap'}`).
- In `MindMap3D.tsx` (lines 160–170):
  - When switching away (`isActive = false`), `setEngineActive(false)` triggers instantly, cancelling `requestAnimationFrame(animationRef.current)`.
  - When switching back (`isActive = true`), a 150ms deferred timer sets `engineActive(true)` before restarting the engine loop.
- In `OntologyCanvasEngine.ts` (line 651):
  ```typescript
  if (!isActive || !engineActive) return; // Background tab state completely halts engine
  ```

#### B. Browser-Level Tab Switching (Page Visibility API)
- **Current Observation**: `MindMap3D.tsx` does NOT currently register a listener for `document.addEventListener('visibilitychange')`.
- **Behavior when switching browser tabs**:
  - The browser automatically pauses/throttles `requestAnimationFrame`.
  - `isActive` remains `true` in React state.
  - When returning to the browser tab, `loop()` fires with `now = performance.now()`.
  - `delta = now - lastFrameTime` is large (> 1000ms), but `lastFrameTime` is updated immediately to `now`.
  - Fixed-step physics prevents position/velocity explosions.
- **Recommended Enhancement**: Adding explicit `visibilitychange` handling will allow the engine to pause immediately when the tab is hidden and execute a clean `lastFrameTime = performance.now()` reset upon tab unhide.

---

## Summary Table of Verification Points

| Aspect | Location | Mechanism | Status / Finding |
|---|---|---|---|
| Frame Loop | `MindMap3D.tsx:738-830` | `requestAnimationFrame(loop)` | Verified: Active only when `isActive` & `engineActive` are true and engine is dirty. |
| Timestamp Delta | `MindMap3D.tsx:702,763-766` | `now = performance.now()`, `delta = now - lastFrameTime` | Verified: Delta measured; recorded in `PerformanceProfiler` if `32ms < delta < 1000ms`. |
| Idle Sleep | `OntologyCanvasEngine.ts:835-851` | `idleFramesCount > 90` -> returns `false` -> `rAF` stopped | Verified: Engine enters sleep after ~1.5s of inactivity, reducing CPU usage to 0%. |
| Sleep Wake-Up | `MindMap3D.tsx:831-839` | `resumePhysicsLoop()` | Verified: Resets `lastFrameTime = performance.now()` and restarts `rAF`. |
| Physics Integration | `OntologyCanvasEngine.ts:769-780` | `worldX += vx * physicsAlpha` | Verified: Fixed-step integration per tick prevents numerical explosion. |
| Module Control | `MindMap3D.tsx:160-170`, `page.tsx:695` | `isActive={activeModule === 'mindmap'}` | Verified: Pauses engine completely when non-mindmap tab is active. |
| Tab Visibility | Browser native `rAF` throttling | Browser pauses `rAF` when tab hidden | Verified: Functional; `visibilitychange` listener recommended for extra optimization. |

---

## Conclusion & Recommendations
1. **R2 Architecture Soundness**: The 3D WebGL / Canvas engine design in `MindMap3D.tsx` and `OntologyCanvasEngine.ts` is robust. It features idle auto-sleeping, LERP morphing, fixed-step physics integration, and module-level `isActive` control.
2. **Lag Spike Prevention**: Whiplash lag spikes are prevented by resetting `lastFrameTime = performance.now()` on wake-up and using fixed-step velocity integration (`vx * physicsAlpha`).
3. **Suggested Optimization**:
   - Add a `visibilitychange` event listener in `MindMap3D.tsx` to explicitly pause `animationRef.current` when `document.hidden === true` and reset `lastFrameTime = performance.now()` on tab re-focus.
