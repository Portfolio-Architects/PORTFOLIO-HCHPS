# Requirement 2 (R2) Technical Analysis: 3D WebGL Frame Pause & Physics Freezing

## 1. Executive Summary
This report presents a thorough investigation of Requirement 2 (R2): **3D WebGL Frame Pause & Physics Freezing** for the 3D MindMap module (`src/components/MindMap3D.tsx`, `src/lib/OntologyCanvasEngine.ts`, `src/lib/engine/OntologyRenderer.ts`).

### Key Discoveries:
1. **Absence of Engine Pause State**: `OntologyCanvasEngine` currently lacks an explicit `isPaused` property or formal lifecycle methods (`pause()`, `resume()`, `start()`, `stop()`).
2. **Unguarded `resumePhysicsLoop`**: In `MindMap3D.tsx`, `resumePhysicsLoopRef.current` can be triggered by mouse, wheel, or window resize events even when `isActive` is `false` or when `document.visibilityState === 'hidden'`. This causes background 60 FPS animation loops to restart unintentionally in inactive tabs.
3. **Missing `visibilitychange` Listener**: Changing browser tabs or minimizing the browser window does not pause the animation frame or set an engine pause flag because `MindMap3D.tsx` lacks a HTML5 Page Visibility API listener (`document.addEventListener('visibilitychange')`).
4. **Unclamped `deltaTime` & Physics Whiplash**: Upon tab restoration or loop resumption, `lastFrameTime` can lag behind `performance.now()` by seconds or minutes. Without resetting `lastFrameTime` prior to loop resumption and clamping maximum frame delta, physics and orbital tick calculations experience extreme `deltaTime` jumps, leading to camera/node teleportation and profiler lag spikes.

---

## 2. Codebase Investigation & Line-by-Line Evidence

### A. Lifecycle in `MindMap3D.tsx`
- **File**: `src/components/MindMap3D.tsx`
- **Lines 160–169**: `isActive` prop controls `engineActive` state via a 150ms delay:
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
- **Lines 685–701**: Main animation loop `useEffect` cleanup cancels `animationRef.current` when `isActive` or `engineActive` becomes `false`:
  ```tsx
  if (loading || error || !isCloudLoaded || !isActive || !engineActive) {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = 0;
      }
    };
  }
  ```
- **Lines 831–839**: `resumePhysicsLoopRef.current` definition:
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
  **Vulnerability**: `resumePhysicsLoopRef.current` does **not** verify `isActive`, `engineActive`, or `document.visibilityState`. If any mouse move, wheel, or resize event triggers `resumePhysicsLoop()`, the loop immediately resumes even when the mindmap tab is inactive.

- **Lines 763–765**: Timestamp delta tracking inside `loop()`:
  ```tsx
  const now = performance.now();
  const delta = now - lastFrameTime;
  lastFrameTime = now;
  ```
  **Vulnerability**: If browser tab execution was backgrounded/throttled without resetting `lastFrameTime` on resume, `delta` becomes several thousand milliseconds, triggering lag spike diagnostics and potential physics instability.

---

### B. Engine Capabilities in `OntologyCanvasEngine.ts`
- **File**: `src/lib/OntologyCanvasEngine.ts`
- **Observation**:
  - `OntologyCanvasEngine` has `physicsAlpha`, `idleFramesCount`, `needsRedraw`, and `physicsFrameCount`.
  - It does **NOT** contain `isPaused: boolean`, `pause(): void`, `resume(): void`, `start(): void`, or `stop(): void`.
  - In `tick()` (lines 808–931), `OntologyCanvasEngine` continues computing LERP, physics step, and orbital angles unless `idleFramesCount > 90`.

---

### C. Static Renderer in `OntologyRenderer.ts`
- **File**: `src/lib/engine/OntologyRenderer.ts`
- **Observation**:
  - `OntologyRenderer` is a static rendering engine (`OntologyRenderer.render(context)`).
  - It relies on `RenderContext` passed from `OntologyCanvasEngine.render()`.
  - It does not schedule frame loops independently, but benefits when `OntologyCanvasEngine.tick()` returns `false` or is short-circuited by `isPaused = true`.

---

## 3. Detailed Vulnerability & Gap Matrix

| Component / Layer | Issue Description | Root Cause | Impact |
| --- | --- | --- | --- |
| `OntologyCanvasEngine.ts` | Missing `isPaused` flag & pause/resume methods | Incomplete lifecycle API contract on Engine | Cannot explicitly freeze engine physics or check pause state |
| `MindMap3D.tsx` | `resumePhysicsLoop` lacks activity/visibility guards | No checks for `isActive`, `engineActive`, `document.hidden` | Background events wake up 60 FPS animation loop in hidden tabs |
| `MindMap3D.tsx` | Missing `visibilitychange` listener | No Page Visibility API integration | Browser tab switching leaves WebGL/Canvas loop running |
| `MindMap3D.tsx` | Unclamped `deltaTime` jump on resume | `lastFrameTime` not reset on visibility restore | Large `delta` causes node whiplash, profiler spikes, or UI jump |

---

## 4. Proposed Solution & Concrete Implementation Steps

### Step 1: Add Lifecycle Methods and `isPaused` Flag to `OntologyCanvasEngine.ts`
1. Declare `public isPaused: boolean = false;` in `OntologyCanvasEngine`.
2. Implement explicit lifecycle methods:
   - `pause(): void`: Sets `this.isPaused = true`, sets `this.physicsAlpha = 0`.
   - `resume(): void`: Sets `this.isPaused = false`, calls `this.wakeUp()`.
   - `start(): void`: Ensures `this.isPaused = false`, calls `this.wakeUp()`.
   - `stop(): void`: Calls `this.pause()`.
3. In `tick()`: Add an early return guard:
   ```ts
   if (this.isPaused) return false;
   ```

### Step 2: Implement Page Visibility API & Guarded Loop Control in `MindMap3D.tsx`
1. **Define explicit Pause/Resume Helpers**:
   - `pauseEngine()`:
     - Cancels `animationRef.current` if non-zero and sets `animationRef.current = 0`.
     - Calls `engineRef.current?.pause()`.
   - `resumeEngine()`:
     - Guards: If `document.hidden || !isActive || !engineActive`, return early.
     - Calls `engineRef.current?.resume()`.
     - Resets `lastFrameTime = performance.now()`.
     - Starts `requestAnimationFrame(loop)` if `animationRef.current === 0`.

2. **Add `visibilitychange` Listener**:
   ```tsx
   useEffect(() => {
     const handleVisibilityChange = () => {
       if (document.hidden) {
         pauseEngine();
       } else if (isActive && engineActive) {
         resumeEngine();
       }
     };
     document.addEventListener('visibilitychange', handleVisibilityChange);
     return () => {
       document.removeEventListener('visibilitychange', handleVisibilityChange);
     };
   }, [isActive, engineActive, pauseEngine, resumeEngine]);
   ```

3. **Guard `resumePhysicsLoopRef`**:
   ```tsx
   resumePhysicsLoopRef.current = () => {
     if (document.hidden || !isActive || !engineActive) return;
     if (engineRef.current?.isPaused) {
       engineRef.current.resume();
     }
     if (animationRef.current === 0) {
       if (engineRef.current) {
         engineRef.current.needsRedraw = true;
       }
       lastFrameTime = performance.now();
       animationRef.current = requestAnimationFrame(loop);
     }
   };
   ```

4. **Clamp `deltaTime` in `loop()`**:
   ```tsx
   const now = performance.now();
   let delta = now - lastFrameTime;
   if (delta > 100) {
     delta = 16.67; // Clamp max frame delta to ~60 FPS frame duration
   }
   lastFrameTime = now;
   ```

---

## 5. Proposed Code Patches (Diff Format)

### Patch A: `src/lib/OntologyCanvasEngine.ts`
```diff
--- a/src/lib/OntologyCanvasEngine.ts
+++ b/src/lib/OntologyCanvasEngine.ts
@@ -48,6 +48,7 @@ export class OntologyCanvasEngine {
   zoom = 1;
   targetZoom = 1;
   public needsRedraw: boolean = true;
+  public isPaused: boolean = false;
   public layoutWorldGeometryDirty: boolean = true;
   public cameraOffsetX = 0;
   private activeTreeSetCache: Set<string> = new Set();
@@ -130,6 +131,24 @@ export class OntologyCanvasEngine {
     this.needsRedraw = true;
   }
 
+  public pause(): void {
+    this.isPaused = true;
+    this.physicsAlpha = 0;
+  }

+  public resume(): void {
+    this.isPaused = false;
+    this.wakeUp();
+  }

+  public start(): void {
+    this.isPaused = false;
+    this.wakeUp();
+  }

+  public stop(): void {
+    this.pause();
+  }
+
   // ============ Init ============
 
   init(graph: OntologyGraph, callbacks?: EngineCallbacks, prevNodes?: OrbitalNode[]): void {
@@ -808,6 +827,8 @@ export class OntologyCanvasEngine {
   tick(): boolean {
+    if (this.isPaused) return false;
+
     let isDirty = false;
 
     // LERP 상태나 카메라 모션이 존재하는지 확인
```

### Patch B: `src/components/MindMap3D.tsx`
```diff
--- a/src/components/MindMap3D.tsx
+++ b/src/components/MindMap3D.tsx
@@ -700,6 +700,19 @@ const MindMap3DComponent = function MindMap3D({ signalKeywords, signalEntries,
       };
     }
 
+    const pauseEngine = () => {
+      if (animationRef.current) {
+        cancelAnimationFrame(animationRef.current);
+        animationRef.current = 0;
+      }
+      if (engineRef.current) {
+        engineRef.current.pause();
+      }
+    };
+
     let lastFrameTime = performance.now();
 
     // Animation
@@ -763,6 +776,9 @@ const MindMap3DComponent = function MindMap3D({ signalKeywords, signalEntries,
       const now = performance.now();
-      const delta = now - lastFrameTime;
+      let delta = now - lastFrameTime;
+      if (delta > 100) {
+        delta = 16.67;
+      }
       lastFrameTime = now;
 
       if (delta > 32 && delta < 1000) {
@@ -831,6 +847,10 @@ const MindMap3DComponent = function MindMap3D({ signalKeywords, signalEntries,
     resumePhysicsLoopRef.current = () => {
+      if (document.hidden || !isActive || !engineActive) {
+        return;
+      }
+      if (engineRef.current?.isPaused) {
+        engineRef.current.resume();
+      }
       if (animationRef.current === 0) {
         if (engineRef.current) {
           engineRef.current.needsRedraw = true;
         }
         lastFrameTime = performance.now();
         animationRef.current = requestAnimationFrame(loop);
       }
     };
 
     resumePhysicsLoop();
+
+    const handleVisibilityChange = () => {
+      if (document.hidden) {
+        pauseEngine();
+      } else if (isActive && engineActive) {
+        if (engineRef.current) {
+          engineRef.current.resume();
+        }
+        resumePhysicsLoop();
+      }
+    };
+    document.addEventListener('visibilitychange', handleVisibilityChange);
 
     return () => {
       ro.disconnect();
+      document.removeEventListener('visibilitychange', handleVisibilityChange);
       if (resizeTimeout) {
         cancelAnimationFrame(resizeTimeout);
       }
       canvas.removeEventListener('wheel', wheelHandler);
       if (animationRef.current) {
         cancelAnimationFrame(animationRef.current);
         animationRef.current = 0;
       }
+      if (engineRef.current) {
+        engineRef.current.pause();
+      }
```

---

## 6. TypeScript Cleanliness & Side Effect Verification
- **Backwards Compatibility**: Adding `isPaused: boolean = false`, `pause()`, `resume()`, `start()`, `stop()` on `OntologyCanvasEngine` is purely additive and does not break any existing code.
- **Type Safety**: All return types are strictly typed (`void`, `boolean`).
- **Memory & Resource Safety**:
  - `document.addEventListener('visibilitychange')` is cleaned up in the `useEffect` return statement.
  - Calling `cancelAnimationFrame(animationRef.current)` and setting `animationRef.current = 0` prevents duplicate frame loops and dangling handles.
  - Orbit angles continue to be saved to `sessionStorage` on tab switch or cleanup, ensuring visual continuity without physics whiplash.
