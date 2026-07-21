# 3D Mindmap Rendering Performance and GC Lag Analysis

This document details the performance and garbage collection (GC) bottlenecks found in the 3D Mindmap rendering engine, and proposes a comprehensive optimization strategy to maintain a stable 60 FPS (under 16ms per frame) without GC lag spikes.

---

## 1. GC Allocations (Zero-Allocation & Pooling)

### Direct Observations & Bottlenecks
In `src/lib/engine/OntologyRenderer.ts` (lines 970–1011), when the canvas is not in a fast-path state (`isFastPath` is false), the label collision grid runs spatial grid partitioning on every frame to prevent text overlapping. This introduces major garbage collection overhead:
1. **Map Allocations**:
   ```typescript
   const spatialGrid = new Map<string, Array<{x1: number, y1: number, x2: number, y2: number}>>();
   ```
   A new `Map` is instantiated on every single frame rendering tick.
2. **Set and String Allocations in `getGridKeys`**:
   ```typescript
   const getGridKeys = (x1: number, y1: number, x2: number, y2: number) => {
     const keys = new Set<string>();
     ...
     keys.add(`${r},${c}`);
     ...
     return keys;
   };
   ```
   For every node analyzed, a new `Set` is allocated, and coordinates are formatted as template strings (`${r},${c}`). This creates thousands of temporary string and set allocations per second.
3. **Array Allocations**:
   When inserting boxes, new cell arrays are instantiated on-the-fly (`spatialGrid.set(key, [])`), which are then thrown away at the end of the frame.

### Optimization Plan
* **Bitwise Integer Hashing**:
  Replace string keys with a packed 32-bit integer representing coordinate coordinates:
  ```typescript
  const key = ((r + 32768) << 16) | (c + 32768);
  ```
  Since grid cell indices are small, offsetting by 32768 maps negative coordinates to positive 16-bit integers, packing both row and column into a single numeric value without string formatting.
* **Inline Range Querying**:
  Completely eliminate `getGridKeys` and the intermediate `Set` allocation. Instead, calculate range coordinates (`colStart` to `colEnd`, `rowStart` to `rowEnd`) and loop directly:
  ```typescript
  const colStart = Math.floor(rect.x1 / gridCellSize);
  const colEnd = Math.floor(rect.x2 / gridCellSize);
  const rowStart = Math.floor(rect.y1 / gridCellSize);
  const rowEnd = Math.floor(rect.y2 / gridCellSize);
  for (let r = rowStart; r <= rowEnd; r++) {
    for (let c = colStart; c <= colEnd; c++) {
      const key = ((r + 32768) << 16) | (c + 32768);
      // Process directly...
    }
  }
  ```
* **Map and Array Pooling**:
  Change `spatialGrid` to a class-level static Map:
  ```typescript
  private static spatialGrid = new Map<number, Array<{x1: number, y1: number, x2: number, y2: number}>>();
  ```
  Maintain a static pool of reusable arrays:
  ```typescript
  private static gridArrayPool: Array<Array<{x1: number, y1: number, x2: number, y2: number}>> = [];
  private static gridArrayPoolUsed = 0;
  ```
  Clear the map and reset the pool pointer at the start of each frame tick:
  ```typescript
  OntologyRenderer.spatialGrid.clear();
  OntologyRenderer.gridArrayPoolUsed = 0;
  ```
  Obtain grid cell arrays from the pool:
  ```typescript
  let cell = OntologyRenderer.spatialGrid.get(key);
  if (!cell) {
    if (OntologyRenderer.gridArrayPoolUsed < OntologyRenderer.gridArrayPool.length) {
      cell = OntologyRenderer.gridArrayPool[OntologyRenderer.gridArrayPoolUsed++];
      cell.length = 0;
    } else {
      cell = [];
      OntologyRenderer.gridArrayPool.push(cell);
      OntologyRenderer.gridArrayPoolUsed++;
    }
    OntologyRenderer.spatialGrid.set(key, cell);
  }
  ```

---

## 2. Trig / Matrix Operations in Physics and Orbiting Updates

### Direct Observations & Bottlenecks
In `src/lib/engine/OntologyLayout.ts` (lines 527–535), during the fast-path orbiting animation loop, the node unit vector is updated and normalized on every frame:
```typescript
const nextCos = node.orbitCos * cosS - node.orbitSin * sinS;
const nextSin = node.orbitCos * sinS + node.orbitSin * cosS;
const len = Math.sqrt(nextCos * nextCos + nextSin * nextSin);
node.orbitCos = nextCos / (len || 0.1);
node.orbitSin = nextSin / (len || 0.1);
```
Although it avoids full `Math.cos`/`Math.sin` evaluation, running `Math.sqrt` and division operations for every single orbiting node on every frame wastes valuable CPU cycles.

Additionally, in `src/lib/engine/OntologyLayout.ts` (lines 756–776), identical `Math.sqrt` normalization is repeated inside the nested $O(N^2)$ screen-space collision resolution loops.

### Optimization Plan
* **Taylor-Series / Newton-Raphson Fast Normalization**:
  Since `nextCos` and `nextSin` represent a rotated unit vector, their magnitude squared $x = nextCos^2 + nextSin^2$ is extremely close to $1.0$.
  We can approximate the reciprocal square root $1/\sqrt{x}$ using first-order Taylor expansion around $1.0$:
  $$f(x) = x^{-1/2} \approx 1 - \frac{1}{2}(x - 1) = 1.5 - 0.5x$$
  This allows us to replace `Math.sqrt` and division with simple multiplication and subtraction:
  ```typescript
  const sqLen = nextCos * nextCos + nextSin * nextSin;
  const factor = 1.5 - 0.5 * sqLen; // Taylor expansion approximation
  node.orbitCos = nextCos * factor;
  node.orbitSin = nextSin * factor;
  ```
  This reduces unit vector normalization to $O(1)$ scalar math with zero square roots or divisions, maintaining mathematical stability at micro-scale.
* Apply this same fast normalization approximation to the Taylor-series unit vector calculations in screen-space collision iterations (lines 756–758, 773–775 in `OntologyLayout.ts`), which is another nested $O(N^2)$ loop where speed gains are critical.

---

## 3. Frustum Culling Implementation for Nodes/Edges

### Direct Observations & Bottlenecks
* Frustum culling is currently implemented in `OntologyRenderer.ts` using coordinate checks:
  * **Edges**: Culled if both endpoints fall beyond `CULL_MARGIN` (80px) boundaries.
  * **Nodes**: Culled from render and text measurements if they are positioned off-screen.
  * **Hit Testing**: `hitTest` in `OntologyCanvasEngine.ts` filters out off-screen nodes to avoid cursor checking overhead.
* **Overhead**: Although nodes are skipped from rendering, the text metrics (`getTextWidth`) and canvas styles are sometimes evaluated before culling checks.

### Optimization Plan
* Ensure culling occurs at the absolute entry point of loops:
  * For nodes: Skip calculations (text width fetch, glow evaluations, template canvas selection) immediately if the node is off-screen.
  * Synchronize boundaries between Layout and Renderer engines using a unified constant `CULL_MARGIN = 80`.

---

## 4. Keeping Rendering Ticks Under 16ms (60 FPS)

### Direct Observations & Bottlenecks
1. **Slow Text Measuring (`measureText`)**:
   In `OntologyRenderer.ts`, the text width is evaluated via:
   ```typescript
   this.getTextWidth(ctx, labelText, `${weightStyle} 12px 'Pretendard', sans-serif`);
   ```
   Even though `baseTextWidthCache` is used, creating the string keys (`${weightStyle}_${labelText}`) on every tick introduces massive GC overhead. Furthermore, `ctx.measureText` remains a slow native canvas invocation.
2. **Interactive Friction**:
   During active user interaction (drag/pan), the 2D screen-space collision resolution loop runs up to 5 iterations. On graphs with $100+$ nodes, this nested loop strains the frame budget, dropping FPS below 60.

### Optimization Plan
* **Precomputed Text Dimensions**:
  To avoid any dynamic measuring or cache lookup string keys in the animation loop:
  1. Pre-calculate the text width of all node labels once when nodes are loaded/added or renamed on an offscreen canvas.
  2. Cache the computed values directly onto the node objects as primitive numbers (e.g., `node._textWidth500` and `node._textWidth600`).
  3. In `renderNodes`, retrieve the width immediately without map lookups or canvas measurements:
     ```typescript
     const textWidth = (isActive || isTreeActive) ? node._textWidth600 : node._textWidth500;
     ```
* **Dynamic Collision Damping**:
  Reduce screen-space collision iterations when interactive and FPS drops:
  ```typescript
  if (isInteractive) {
    maxIterations = fps < 45 ? 1 : fps < 55 ? 2 : 3;
  }
  ```
  This dynamically reduces computational complexity during fast pans/drags to guarantee the frame tick stays under 16ms.
