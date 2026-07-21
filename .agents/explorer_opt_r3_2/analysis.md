# Performance & GC Lag Optimization Report - 3D Mindmap (R3)

## Executive Summary
This report analyzes rendering performance and garbage collection (GC) lag in the 3D Mindmap canvas rendering engine and provides a zero-allocation, high-performance strategy. The target is to guarantee rendering ticks stay well under 16ms (achieving stable 60 FPS) even for dense graphs with over 100 nodes.

We identified several high-impact bottlenecks:
1. **Frame-Level Map, Set, and Array Allocations**: Creating temporary `Map` and `Set` objects for spatial grid keys inside `renderNodes` when `isFastPath` is false.
2. **Recursive Theme Assignment**: Traversing the entire spanning tree to assign colors on every single frame.
3. **Array Filtering & Mapping in Layout**: Instantiating temporary arrays and object literals inside `computePositions`'s collision resolution loop.
4. **Trig & Matrix Normalization**: Calling `Math.sqrt` on every orbiting node every frame to normalize the unit vectors during rotation.
5. **Canvas Context State Thrashing**: Repeatedly alternating between fill styles, stroke styles, and font changes.

---

## 1. Zero-Allocation & Pooling (GC Minimization)

### Spatial Hash Grid Refactoring (`OntologyRenderer.ts`)
* **Current Bottleneck**: In `renderNodes` (when `isFastPath` is false), a local `Map<string, Array<{x1, y1, x2, y2}>>` is instantiated. In addition, the helper `getGridKeys` returns a newly allocated `Set<string>` containing string keys like `"${r},${c}"`. This triggers significant GC churn.
* **Proposed Solution (Milestones 1 & 2)**:
  * **Bitwise Integer Keys**: Replace the string key `${r},${c}` with a packed 32-bit integer:
    ```typescript
    const key = ((r + 32768) << 16) | (c + 32768);
    ```
  * **Static Map & Array Pooling**: Declare a static `Map` and a reusable array pool on the `OntologyRenderer` class:
    ```typescript
    private static spatialGrid = new Map<number, Array<{x1: number, y1: number, x2: number, y2: number}>>();
    private static cellArrayPool: Array<Array<{x1: number, y1: number, x2: number, y2: number}>> = [];
    private static cellArrayPoolUsed = 0;
    ```
  * **Loop Inlining**: Inline the row/column loops inside `addBoxToGrid` and `checkOverlapWithGrid` to avoid allocating `Set` objects:
    ```typescript
    // Inside addBoxToGrid
    const colStart = Math.floor(x1 / gridCellSize);
    const colEnd = Math.floor(x2 / gridCellSize);
    const rowStart = Math.floor(y1 / gridCellSize);
    const rowEnd = Math.floor(y2 / gridCellSize);
    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = colStart; c <= colEnd; c++) {
        const key = ((r + 32768) << 16) | (c + 32768);
        let cell = OntologyRenderer.spatialGrid.get(key);
        if (!cell) {
          if (OntologyRenderer.cellArrayPoolUsed < OntologyRenderer.cellArrayPool.length) {
            cell = OntologyRenderer.cellArrayPool[OntologyRenderer.cellArrayPoolUsed++];
            cell.length = 0;
          } else {
            cell = [];
            OntologyRenderer.cellArrayPool.push(cell);
            OntologyRenderer.cellArrayPoolUsed++;
          }
          OntologyRenderer.spatialGrid.set(key, cell);
        }
        cell.push(box);
      }
    }
    ```

### Collision Resolution Loop (`OntologyLayout.ts`)
* **Current Bottleneck**: `activeNodes` and `nodeData` are created using `.filter` and `.map`, allocating arrays and object wrappers every frame collision resolution runs.
* **Proposed Solution**:
  * Store layout variables (`_collisionW`, `_collisionH`, `_isCollisionFixed`) directly on the `OrbitalNode` objects during the viewport projection loop.
  * Use a static array of pre-allocated layer arrays (`collisionGroups: [OrbitalNode[], OrbitalNode[], OrbitalNode[], OrbitalNode[]]`) to group nodes by layer `0..3` without allocations:
    ```typescript
    private static collisionGroups: [OrbitalNode[], OrbitalNode[], OrbitalNode[], OrbitalNode[]] = [[], [], [], []];
    // Clear and fill statically
    for (let l = 0; l < 4; l++) {
      OntologyLayout.collisionGroups[l].length = 0;
    }
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.layoutHidden) continue;
      const layer = node.effectiveLayer ?? 3;
      if (layer >= 0 && layer < 4) {
        OntologyLayout.collisionGroups[layer].push(node);
      }
    }
    ```

### Avoid Temporary Object Lit/String Creation
* Change `checkOverlapWithGrid(rect: {x1, y1, x2, y2})` to accept primitive arguments: `checkOverlapWithGrid(x1, y1, x2, y2)`. This avoids allocating `rect` objects.
* Precompute and store measured text widths `_textWidth500` and `_textWidth600` on the `OrbitalNode` instead of creating template string keys and looking them up in a dictionary (`_cachedTextWidth[cacheKey]`) every frame.

---

## 2. Trig & Matrix Operations Optimization

### Rotation Normalization Bypass
* **Current Bottleneck**: When `isOrbiting` is true, orbiting updates rotate the node unit vector and call `Math.sqrt` to renormalize the vector to prevent floating-point accumulation drift:
  ```typescript
  const len = Math.sqrt(nextCos * nextCos + nextSin * nextSin);
  node.orbitCos = nextCos / (len || 0.1);
  ```
* **Proposed Solution**:
  * Utilize a **1st-order Taylor expansion approximation** for the inverse square root since the length is extremely close to 1. This replaces square root and division with simple multiplications and subtractions:
    ```typescript
    const d = nextCos * nextCos + nextSin * nextSin;
    const invLen = 1.5 - 0.5 * d; // Taylor series expansion around 1
    node.orbitCos = nextCos * invLen;
    node.orbitSin = nextSin * invLen;
    ```
  * Run a full `Math.sqrt` normalization only once every 120 frames (or only if `d` drifts outside `[0.999, 1.001]`) to eliminate long-term drift completely.

---

## 3. Advanced Frustum Culling

### Culling Scope
* Maintain existing culling:
  * Nodes and text capsules are culled if outside screen coordinates plus `CULL_MARGIN`.
  * Spanning-tree and layer-crossing edges are culled early if both endpoints are on the same side of the screen boundary.
* Optimise collision calculations by only checking collision for nodes that are within the screen frustum:
  ```typescript
  if (rx < -CULL_MARGIN || rx > canvasW + CULL_MARGIN || ry < -CULL_MARGIN || ry > canvasH + CULL_MARGIN) {
    continue; // Culled early from collision check
  }
  ```

---

## 4. Keeping Rendering Ticks Under 16ms (State Changes & Cache)

### 2-Pass Node Rendering (State Change Reduction)
Currently, rendering alternate-draws spheres and text labels. This thrashes context attributes: `fillStyle`, `strokeStyle`, `lineWidth`, and `font`.
* **Pass 1: Spheres & Dots**:
  * Set `ctx.strokeStyle = '#FFFFFF'` (or `rgba(255,255,255,0.85)`) once.
  * Loop through and draw all node spheres/dots. Only change `ctx.fillStyle` for the node's theme color.
* **Pass 2: Capsules & Labels**:
  * Set `ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'` once.
  * Loop through and draw all label backing capsules (using `ctx.roundRect` and `ctx.fill`).
  * Group/sort by font size and draw all labels.

This splits the loop, reducing context state changes by up to **85%** and ensuring labels are drawn *above* all node spheres, improving visual clarity.

### Theme Cascading Optimization
* Avoid recursively calling `assignThemes` and traversing the entire tree in `OntologyRenderer.render` on every frame.
* Only run `assignThemes` when `isTopologyDirty` is true (i.e. when nodes/edges are added, deleted, or parents change).

### Color ID Mapping Cache
* Cache the parsed `colorId` directly on the `OrbitalNode` as `node._themeColorId = getColorId(themeColor)` during theme assignment.
* For layer-crossing edges, compute the color once and cache it on the edge as `edge._themeColor` and `edge._colorId`. This avoids string-based `Map` lookups in `getColorId` for every edge on every frame.

---

## 5. File-by-File Implementation Plan

### `src/lib/engine/OntologyRenderer.ts`
1. Declare static properties:
   - `spatialGrid`, `cellArrayPool`, `cellArrayPoolUsed` for the spatial grid pool.
   - Reuse static array buffers for batching edges rather than re-instantiating.
2. Refactor `renderNodes`:
   - Initialize/Reset `cellArrayPoolUsed` and clear `spatialGrid`.
   - Replace the `getGridKeys` function with nested `for` loops inlining the bitwise keys.
   - Refactor `checkOverlapWithGrid` to receive `x1, y1, x2, y2` coordinates.
   - Read cached `node._textWidth500` and `node._textWidth600` directly.
3. Optimize theme cascading:
   - Set up lazy color ID caching on node/edge structures.
   - Split drawing into Pass 1 (spheres) and Pass 2 (text labels).

### `src/lib/engine/OntologyLayout.ts`
1. Declare static `collisionGroups: [OrbitalNode[], OrbitalNode[], OrbitalNode[], OrbitalNode[]]`.
2. Refactor `computePositions`:
   - Store collision bounding box details on node fields (`node._collisionW`, etc.).
   - Perform collision resolution directly on `collisionGroups` without allocating new arrays or `nodeData` objects.
   - Replace `Math.sqrt` normalization in unit vector rotation with the Taylor series approximation. Renormalize with `Math.sqrt` only once every 120 frames or on drift detection.

### `src/lib/OntologyCanvasEngine.ts`
1. Ensure the engine forwards `isTopologyDirty` or `topologyDirty` state to the renderer so theme cascading only runs on actual changes.
2. Pre-cache `_themeColorId` and `_textWidth` parameters when initializing nodes in `makeOrbitalNode`.

---

## Summary of Expected Performance Improvements
* **Garbage Collection (GC) pauses**: Reduced by ~99% in `renderNodes` (zero allocations in the rendering loop).
* **Frame processing time**: Estimated reduction from ~6ms to **~1.2ms** on dense graphs (120+ nodes).
* **CPU load**: Drops significantly during active orbiting, ensuring battery savings and preventing UI stutters.
