# Synthesized Performance Optimization Strategy (Milestone 2 - R2)

## 1. Dirty-Flag Layout Calculations (BFS Optimization)
- **Problem**: BFS tree traversal and full coordinate layout calculations are executed on every single frame during interaction (dragging, panning, zooming, physics) because `recomputeWorldPositions` depends directly on `layoutWorldGeometryDirty`.
- **Solution**:
  1. Introduce `isTopologyDirty: boolean = true` in `OntologyCanvasEngine.ts`.
  2. Set `isTopologyDirty = true` ONLY on initial layout, node click, expand/collapse, layer toggle, classification word changes, and file radar injection.
  3. In `computePositions()`, set `const forceRecompute = this.isTopologyDirty` and reset `this.isTopologyDirty = false` at the end of the method.
  4. In `OntologyLayout.ts`, skip BFS traversal and tree reconstruction if `recomputeWorldPositions` is false.
  5. Fast path: if `isOrbiting` is false, reuse cached positions (`targetWorldX`/`targetWorldY`) without recalculation.

## 2. Viewport & Label Frustum Culling
- **Problem**: Text backing boxes, node labels, and edge labels are processed even when the node or midpoint is off-screen.
- **Solution**:
  1. In `OntologyRenderer.ts:renderNodes()`, skip off-screen nodes entirely for both fast path and normal path rendering.
  2. In `OntologyRenderer.ts:renderEdges()`, verify the edge midpoint is within viewport boundaries before allocating label data structures.

## 3. Collision Loop & Damping Calibration
- **Problem**: Fixed 5-iteration nested loops cause framerate drops under high density or low performance. Overlap wiggles cause trembling during camera pan/zoom.
- **Solution**:
  1. Scale collision iterations dynamically based on FPS retrieved from `PerformanceProfiler.getInstance().getMetrics().fps` (e.g. limit to 2 if FPS < 50, limit to 1 if FPS < 40).
  2. Apply a damping decay factor of `0.80` on each loop iteration to prevent micro-oscillations.
  3. Ignore overlaps below a dead-zone threshold of `0.8px`.
  4. Only run collision resolution during active layout updates or dragging. Skip it during camera panning/zooming.
  5. Calibrate the velocity damping dead-zone in `runPhysicsTick` to sleep velocities faster once they settle (speedSq < 0.012).

## 4. Orbiting & Ring Rendering Efficiency
- **Problem**: Coordinate drift from repeated rotation matrix multiplication; visual lag shaking from LERPing orbiting nodes; expensive trigonometric calls in the orbiting calculations, tilt rotations, ring drawing, and collision loop.
- **Solution**:
  1. **Unit Vector Orbiting**: Cache normalized unit vector `(orbitCos, orbitSin)` on each orbiting node. Rotate the unit vector incrementally, renormalize to eliminate rounding errors, and scale by orbit radius.
  2. **Bypass LERP**: Direct copy `worldX = targetWorldX` and `worldY = targetWorldY` during active orbiting to eliminate LERP phase lag trembling.
  3. **Taylor-Series Approximation**: In the collision loop, use a small-angle Taylor-series approximation for the rotation matrix instead of calling `Math.cos`/`Math.sin`.
  4. **Tilt Angle Cache**: Cache `cosTilt` and `sinTilt` for 42 degrees statically on `OntologyLayout`.
  5. **Precomputed Rings**: Cache 64-segment unit circle points statically in `OntologyRenderer` to render orbit rings with lookup tables instead of 260+ trig calls per frame.
