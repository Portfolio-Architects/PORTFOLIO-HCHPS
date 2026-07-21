## 2026-07-16T06:40:34Z
Implement the following changes in `src/lib/engine/OntologyRenderer.ts`:

1. Define class-level static fields in `OntologyRenderer` (around line 113):
   ```typescript
   private static spatialGrid = new Map<number, Array<{x1: number, y1: number, x2: number, y2: number}>>();
   private static cellArrayPool: Array<Array<{x1: number, y1: number, x2: number, y2: number}>> = [];
   private static cellArrayPoolUsed = 0;
   ```

2. In the slow path of `renderNodes` (around line 970), at the start of the `else` branch:
   - Clear `spatialGrid` and reset `cellArrayPoolUsed`:
     ```typescript
     OntologyRenderer.spatialGrid.clear();
     OntologyRenderer.cellArrayPoolUsed = 0;
     const gridCellSize = 120;
     ```
   - Refactor overlap detection and insertion to eliminate `getGridKeys` and `Set` allocations. Implement `addBoxToGrid` and `checkOverlapWithGrid` to calculate cell row/column coordinates directly and loop using bitwise integer keys: `(r << 16) | (c & 0xFFFF)`.
   - Implement `addBoxToGrid` using the `cellArrayPool` to reuse arrays:
     ```typescript
     const addBoxToGrid = (box: {x1: number, y1: number, x2: number, y2: number}) => {
       const colStart = Math.floor(box.x1 / gridCellSize);
       const colEnd = Math.floor(box.x2 / gridCellSize);
       const rowStart = Math.floor(box.y1 / gridCellSize);
       const rowEnd = Math.floor(box.y2 / gridCellSize);

       for (let r = rowStart; r <= rowEnd; r++) {
         for (let c = colStart; c <= colEnd; c++) {
           const key = (r << 16) | (c & 0xFFFF);
           let arr = OntologyRenderer.spatialGrid.get(key);
           if (!arr) {
             if (OntologyRenderer.cellArrayPoolUsed < OntologyRenderer.cellArrayPool.length) {
               arr = OntologyRenderer.cellArrayPool[OntologyRenderer.cellArrayPoolUsed++];
               arr.length = 0;
             } else {
               arr = [];
               OntologyRenderer.cellArrayPool.push(arr);
               OntologyRenderer.cellArrayPoolUsed++;
             }
             OntologyRenderer.spatialGrid.set(key, arr);
           }
           arr.push(box);
         }
       }
     };
     ```
   - Implement `checkOverlapWithGrid`:
     ```typescript
     const checkOverlapWithGrid = (rect: {x1: number, y1: number, x2: number, y2: number}) => {
       const colStart = Math.floor(rect.x1 / gridCellSize);
       const colEnd = Math.floor(rect.x2 / gridCellSize);
       const rowStart = Math.floor(rect.y1 / gridCellSize);
       const rowEnd = Math.floor(rect.y2 / gridCellSize);

       for (let r = rowStart; r <= rowEnd; r++) {
         for (let c = colStart; c <= colEnd; c++) {
           const key = (r << 16) | (c & 0xFFFF);
           const boxes = OntologyRenderer.spatialGrid.get(key);
           if (boxes) {
             for (let i = 0; i < boxes.length; i++) {
               const box = boxes[i];
               if (!(rect.x2 < box.x1 || rect.x1 > box.x2 || rect.y2 < box.y1 || rect.y1 > box.y2)) {
                 return true;
               }
             }
           }
         }
       }
       return false;
     };
     ```

3. In `clearTextBoxPool` method (around line 1393), clean up the newly added static fields to prevent memory leaks:
   ```typescript
   OntologyRenderer.spatialGrid.clear();
   OntologyRenderer.cellArrayPool.length = 0;
   OntologyRenderer.cellArrayPoolUsed = 0;
   ```

4. Run `npm run lint`, `npm run build`, and `node scripts/run-harness.js` to verify everything compiles, passes lints, and fits within the project's strict database rules.
