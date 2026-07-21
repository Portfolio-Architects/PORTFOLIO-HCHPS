# Unified Optimization Plan: 3D Mindmap Rendering Speed & GC Lag (R3)

## 1. Zero-Allocation & Pooling (Objective 1)

### A. Spatial Hash Grid (OntologyRenderer.ts)
- **Grid Key Packing**: Replace string keys like `"${r},${c}"` with packed 32-bit integers: `const key = ((r + 32768) << 16) | (c + 32768);`.
- **Static Map & Array Pool**: Declare static `spatialGrid` map and reusable array pools:
  ```typescript
  private static spatialGrid = new Map<number, Array<{x1: number, y1: number, x2: number, y2: number}>>();
  private static cellArrayPool: Array<Array<{x1: number, y1: number, x2: number, y2: number}>> = [];
  private static cellArrayPoolUsed = 0;
  ```
- **Overlap & Insertion Inlining**: Avoid allocating `Set` objects by inlining row/column loops inside `addBoxToGrid` and `checkOverlapWithGrid` to query the static grid Map directly.
- **Clear & Reuse**: Clear the spatial grid Map at the beginning of each non-fast-path frame, resetting `cellArrayPoolUsed` to 0.

### B. Collision Resolution Loop (OntologyLayout.ts)
- **Avoid Filter/Map Array Instantiations**: Do not instantiate arrays or object wrappers in `computePositions`.
- **Pre-Allocated Layer Groups**: Group active nodes by layer `0..3` into pre-allocated static arrays:
  ```typescript
  private static collisionGroups: [OrbitalNode[], OrbitalNode[], OrbitalNode[], OrbitalNode[]] = [[], [], [], []];
  ```
- **Property Caching on Nodes**: Cache collision-related properties (`_collisionW`, `_collisionH`, `_isCollisionFixed`) directly on the `OrbitalNode` objects during viewport projection.

### C. String Hashing & Dictionary Lookups (OntologyCanvasEngine.ts & OntologyRenderer.ts)
- **Active Layers & Collapsed Nodes Keys**: Re-evaluate the sorted string keys (`collapsedNodesKey`, `activeLayersKey`) in `OntologyCanvasEngine.ts` ONLY when topology or active layers actually change (on click/event triggers), not in the frame loop.
- **Cache Text Widths**: Pre-measure node text widths and store them directly on `OrbitalNode` during initialization/creation rather than doing dictionary lookups inside `renderNodes`.

---

## 2. Trig & Math Optimization (Objective 2)

### A. Taylor-Series Vector Renormalization (OntologyLayout.ts)
- **Normalization Fast-Path**: Approximate the inverse square root during orbit normalization using a first-order Taylor expansion around $x=1$:
  ```typescript
  const d = nextCos * nextCos + nextSin * nextSin;
  const invLen = 1.5 - 0.5 * d; // Taylor series approximation
  node.orbitCos = nextCos * invLen;
  node.orbitSin = nextSin * invLen;
  ```
- **Drift Correction**: Execute a full `Math.sqrt` renormalization only once every 120 frames or if `d` drifts outside `[0.999, 1.001]`.

### B. Animation Clock Cache (OntologyRenderer.ts)
- **Single Sine Evaluation**: Compute the pulse sine and pre-calculate values (`riskPulse`, etc.) once per frame at the top of the render loop instead of inside the node rendering loop.

---

## 3. Frustum Culling (Objective 3)

### A. Background Plates (OntologyRenderer.ts)
- Cull the 4 background plates (`renderBackgroundLayers`) if all 4 corner coordinates lie entirely outside the canvas boundaries plus a margin `CULL_MARGIN` (e.g. 50px).

### B. Orbit Rings (OntologyRenderer.ts)
- Cull orbit rings (`renderOrbitRings`) if the bounding circle is entirely off-screen or if the projected radius is too small (< 2px).

---

## 4. State Change Reduction & Drawing Cache (Objective 4)

### A. 2-Pass Node Drawing (OntologyRenderer.ts)
- Avoid context attribute thrashing (`fillStyle`, `strokeStyle`, `font`).
- **Pass 1**: Set stroke style once, draw all node spheres.
- **Pass 2**: Set label backplate fillStyle, draw all capsules. Sort and draw all text labels.

### B. Color ID Cache
- Parse and cache `_themeColorId` and `_themeColor` strings on nodes and edges during theme assignment instead of dynamically calling `getColorId` or parsing in the frame loop.
