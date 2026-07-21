# Handoff Report: 3D Mindmap Optimization Analysis (R3)

## 1. Observation
We inspected `src/lib/OntologyCanvasEngine.ts`, `src/lib/engine/OntologyLayout.ts`, `src/lib/engine/OntologyRenderer.ts`, and `src/components/MindMap3D.tsx` and observed the following code sections causing rendering overhead and GC allocations:

* **Observation A (Spatial Grid Allocations)**: In `src/lib/engine/OntologyRenderer.ts` (lines 970-971), a new `Map` is allocated when `isFastPath` is false:
  ```typescript
  const gridCellSize = 120;
  const spatialGrid = new Map<string, Array<{x1: number, y1: number, x2: number, y2: number}>>();
  ```
  And string-based coordinates are allocated inside `getGridKeys` (lines 981-984):
  ```typescript
        for (let r = rowStart; r <= rowEnd; r++) {
          for (let c = colStart; c <= colEnd; c++) {
            keys.add(`${r},${c}`);
          }
        }
  ```

* **Observation B (Collision Resolution Filter & Map)**: In `src/lib/engine/OntologyLayout.ts` (lines 634-640), an array filter runs on every collision iteration:
  ```typescript
      const activeNodes = nodes.filter(n => 
        !n.layoutHidden && 
        n.renderX !== -999999 &&
        n.renderX >= -CULL_MARGIN &&
        n.renderX <= canvasW + CULL_MARGIN &&
        n.renderY >= -CULL_MARGIN &&
        n.renderY <= canvasH + CULL_MARGIN
      );
  ```
  Immediately followed by a `.map` operation allocating object wrappers (`nodeData`) (lines 645-668).

* **Observation C (Renormalization Calculations)**: In `src/lib/engine/OntologyLayout.ts` (lines 527-535), rotation uses `Math.sqrt` and division every frame:
  ```typescript
            // Rotate unit vector
            const nextCos = node.orbitCos * cosS - node.orbitSin * sinS;
            const nextSin = node.orbitCos * sinS + node.orbitSin * cosS;
            
            // Renormalize to completely eliminate rounding error accumulation
            const len = Math.sqrt(nextCos * nextCos + nextSin * nextSin);
            node.orbitCos = nextCos / (len || 0.1);
            node.orbitSin = nextSin / (len || 0.1);
  ```

* **Observation D (Theme Assignment per Frame)**: In `src/lib/engine/OntologyRenderer.ts` (lines 264-265), theme cascading traverses the entire spanning tree recursively:
  ```typescript
  public static render(context: RenderContext): void {
    // ...
    this.assignThemes(nodes, centerNode, nodeMap);
  ```

---

## 2. Logic Chain
1. **GC Lag**: The frequent creation of temporary objects (such as `new Map()`, string keys like `${r},${c}`, arrays of keys, and `nodeData` wrapper objects) inside the render loop triggers garbage collection cycles. Eliminating these allocations will reduce GC frame drop stutters to zero. (Based on Observation A & B)
2. **Trig / Matrix Operations**: Calculating `Math.sqrt` for every node on every frame during orbiting updates consumes significant CPU cycles. Replacing it with a first-order Taylor expansion (which requires only multiplication and subtraction) will optimize CPU utilization. (Based on Observation C)
3. **State Thrashing**: Alternating between fill styles, stroke styles, and font sizes within the same rendering pass slows down the HTML5 Canvas rendering. Splitting rendering into a sphere-drawing pass and a label-drawing pass will minimize state changes.
4. **Theme Assignment**: Recursively reassigning themes for all nodes is only necessary when graph topology changes, not every frame. Bypassing it on static frames saves CPU overhead. (Based on Observation D)

---

## 3. Caveats
* **Inverse Square Root Precision**: The Taylor series approximation for normalization assumes that the vector's length remains extremely close to 1. If it drifts significantly (e.g. over hours of running), coordinates might distort slightly. To mitigate this, a full `Math.sqrt` should be run once every 120 frames or on drift detection.
* **Layout Culling**: Collision culling relies on nodes being within `CULL_MARGIN`. If a node is just off-screen but still interacting with on-screen nodes, its exclusion from collision checks could theoretically cause minor popping, though this is minimized by the `CULL_MARGIN` padding.

---

## 4. Conclusion
We have formulated a detailed strategy to optimize the 3D Mindmap rendering performance and eliminate GC lag:
1. Refactor spatial hash keys to packed 32-bit integers and implement a static Map and Array pool in `OntologyRenderer.ts`.
2. Inline spatial grid loops to eliminate `Set` allocations.
3. Cache node theme colors, crossing edge styles, and text widths to avoid string lookups/dictionary lookups per frame.
4. Reuse a static grouping array for layer categorization and eliminate `.filter()` and `.map()` calls in layout collisions.
5. Use a Taylor series approximation for vector normalization during orbiting.
6. Adopt a 2-pass rendering pipeline (spheres first, then labels) to minimize Canvas state changes.

---

## 5. Verification Method
* **Static Analysis**: After changes are implemented, run the build validation commands (`npm run build` or `next build`) to ensure TypeScript compiles and no layout contracts are broken.
* **Performance Profiler**: Launch the project, open the Performance Profiler HUD at the bottom of the 3D Mindmap, and inspect:
  - **Render Time**: Ensure average rendering time drops below **2ms**.
  - **Lag Spikes**: Verify no lag spikes appear in the monitor log during panning/zooming/orbiting.
  - **Console Spams**: Ensure no validation or runtime warnings are thrown in the developer tools console.
