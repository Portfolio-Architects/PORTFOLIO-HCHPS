# Handoff Report — M4 3D Mindmap Optimization Strategy

## 1. Observation
- **File Paths and Lines Inspecting GC Allocations**:
  - `src/lib/engine/OntologyRenderer.ts` (lines 970-1011):
    ```typescript
    const spatialGrid = new Map<string, Array<{x1: number, y1: number, x2: number, y2: number}>>();
    const getGridKeys = (x1: number, y1: number, x2: number, y2: number) => {
      const keys = new Set<string>();
      ...
      keys.add(`${r},${c}`);
      ...
      return keys;
    };
    ```
    This allocates a `Map`, multiple `Set` objects, and template string keys on every frame when `isFastPath` is false.
- **Trig/Normalization Bottlenecks**:
  - `src/lib/engine/OntologyLayout.ts` (lines 527-535):
    ```typescript
    const nextCos = node.orbitCos * cosS - node.orbitSin * sinS;
    const nextSin = node.orbitCos * sinS + node.orbitSin * cosS;
    const len = Math.sqrt(nextCos * nextCos + nextSin * nextSin);
    node.orbitCos = nextCos / (len || 0.1);
    node.orbitSin = nextSin / (len || 0.1);
    ```
    It performs `Math.sqrt` and division operations on each node on every frame during orbiting.
  - `src/lib/engine/OntologyLayout.ts` (lines 756-776):
    Identical trigonometry operations and vector renormalizations occur in the nested $O(N^2)$ screen-space collision loops.
- **Frustum Culling**:
  - `src/lib/engine/OntologyRenderer.ts` (lines 474-479):
    ```typescript
    if (src.renderX < -CULL_MARGIN && tgt.renderX < -CULL_MARGIN) continue;
    if (src.renderX > canvasW + CULL_MARGIN && tgt.renderX > canvasW + CULL_MARGIN) continue;
    if (src.renderY < -CULL_MARGIN && tgt.renderY < -CULL_MARGIN) continue;
    if (src.renderY > canvasH + CULL_MARGIN && tgt.renderY > canvasH + CULL_MARGIN) continue;
    ```
    Frustum culling is present for edges, labels, and nodes, but some label size calculation still runs prior to coordinate filtering.
- **Slow Text Measurements**:
  - `src/lib/engine/OntologyRenderer.ts` (line 1176):
    ```typescript
    const textWidth = node._cachedTextWidth[cacheKey] * localZoom;
    ```
    `cacheKey` is constructed via dynamic string interpolation which triggers GC overhead.

---

## 2. Logic Chain
1. **Observation**: A new `Map` and multiple `Set` collections are instantiated, and coordinate strings are constructed on every animation loop frame in `OntologyRenderer.ts`.
   **Inference**: This generates high memory pressure, triggering browser garbage collection passes that block the main thread and produce lag spikes.
   **Conclusion**: Refactoring the spatial grid to use static map pooling and bitwise integer keys will eliminate these heap allocations.
2. **Observation**: Vector rotations in `OntologyLayout.ts` normalize unit vectors using `Math.sqrt` and division inside the orbiting animation loop and nested collision iterations.
   **Inference**: Square roots and floating-point divisions are computationally heavy and scale poorly on larger graphs.
   **Conclusion**: Approximating reciprocal square roots with a first-order Taylor expansion ($1.5 - 0.5 \cdot \text{length}^2$) removes square roots and division entirely from the inner loop.
3. **Observation**: Label text measurements require string concatenation and map lookups at 60 FPS in `OntologyRenderer.ts`.
   **Inference**: Dynamic text measurements and key hashing slow down rendering ticks.
   **Conclusion**: Precomputing and caching font width values directly on the node object during initialization removes measuring overhead.

---

## 3. Caveats
- The fast Taylor-series normalization assumes that the vector's magnitude squared is very close to `1.0`. If a node's magnitude is severely distorted (e.g., due to custom mouse drags pinning a node to extreme coordinates), the approximation might lose accuracy, but this is automatically corrected once the node is unpinned or re-normalized.
- Precomputing text widths assumes the font family and styling remain constant. If the font family changes dynamically at runtime, the cached widths will need to be re-evaluated.

---

## 4. Conclusion
We have formulated an actionable optimization plan to:
1. Eliminate all heap allocations in spatial label collision logic by implementing static map pooling and bitwise packed integer keys.
2. Remove expensive `Math.sqrt` and division operations from vector normalization using a fast first-order Taylor-series approximation.
3. Eliminate dynamic text measurements from the render loop by caching labels' dimensions directly on node objects during initialization.

---

## 5. Verification Method
- **Inspection**:
  - Verify that no heap allocations (Map, Set, Array, or formatted strings) occur inside the rendering ticks in `src/lib/engine/OntologyRenderer.ts`.
  - Inspect `analysis.md` in the working directory `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_opt_r3_3` for implementation details.
- **Build Verification**:
  - The project can be built using: `npm run build` or `npm run dev` to ensure no typescript errors are introduced.
