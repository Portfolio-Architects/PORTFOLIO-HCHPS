# Handoff Report: Performance Optimization Exploration (R1, R2, R3)

This report summarizes the results of the performance investigation and diagnostics conducted on the VITAL Work & Wealth platform codebase, focusing on initial loading times (R1), API responsiveness (R2), and tab transition/interaction responsiveness (R3).

---

## 1. Observation

### R1: Initial Dashboard Loading Performance
* **Synchronous Imports in `src/app/page.tsx`**:
  * Line 14: `import { Sidebar } from '@/components/Sidebar';`
  * Line 66: `import { SecurityLockScreen } from '@/components/SecurityLockScreen';`
* **Staggered Loading in `src/app/page.tsx`**:
  * Lines 155–187: The function `preloadModulesOnIdle` mounts heavy background components dynamically via `visitedModules[module] = true`.
    * Line 170: `timers.push(window.setTimeout(() => triggerPreload('mindmap'), 1500));`
    * Line 172: `timers.push(window.setTimeout(() => triggerPreload('workspace'), 3500));`
    * Line 174: `timers.push(window.setTimeout(() => triggerPreload('inventory'), 5500));`
  * This causes the components `MindMap3D`, `WorkspaceView`, and `InventoryList` to be rendered in the DOM inside `div` elements with Tailwind's `hidden` class.

### R2: Data API Response Speed
* **Metadata Check Request in `src/lib/sheets-api.ts`**:
  * Lines 58–64: `readSheet` queries metadata before fetching actual data:
    ```typescript
    const metaRes = await fetch(`${API_BASE}?sheet=${encodeURIComponent(sheetName)}&meta=true&_t=${Date.now()}`, {
      headers: { ...getAuthHeaders(), 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      cache: 'no-store'
    });
    ```
* **Full Data Request in `src/lib/sheets-api.ts`**:
  * Lines 81–87: A separate request retrieves the sheet data if modified:
    ```typescript
    const res = await fetch(`${API_BASE}?sheet=${encodeURIComponent(sheetName)}&_t=${Date.now()}`, {
      headers: { ...getAuthHeaders(), 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      cache: 'no-store'
    });
    ```
* **E2EE Decryption Async Overhead in `src/lib/sheets-api.ts`**:
  * Lines 97–139: Every row is mapped to an `async` handler awaiting `decryptPayload` via `Promise.all`.
* **API GET Route in `src/app/api/data/route.ts`**:
  * Lines 306–337: The serverGET method is split between serving `metaOnly` data or returning the full sheet payload.

### R3: Tab Transition & Interaction Responsiveness
* **React.memo Missing Comparator in `src/components/MindMap3D.tsx`**:
  * Lines 43–68: `areMindMap3DPropsEqual` is defined but omitted in the `React.memo` invocation on Line 72:
    ```typescript
    export const MindMap3D = React.memo(function MindMap3D({ signalKeywords, signalEntries, onRenameCategory, onDeleteCategory, isActive = true }: MindMap3DProps) {
    ```
  * In `src/app/page.tsx` (Lines 427–436), parent passes dynamic object/array references `signalKeywords={mergedKeywordMap}` and `signalEntries={mergedEntries}` which change on every parent render.
* **Top-Level Subscriptions in `src/components/MindMap3D.tsx`**:
  * Lines 110–111: Subscriptions to global tasks and budget hooks exist at the top level:
    ```typescript
    const { tasks = [] } = useTasks();
    const { categories = [], getCategoryStats } = useBudget();
    ```
* **Inline Arrow Functions & Filters in `src/app/page.tsx`**:
  * Line 443–466: Dynamic props are created inline inside the rendering return block of `ProtectedApp`:
    * `budgetEntries={budgetEntries.filter(e => !e.isPlanned)}`
    * `getCategoryStats={(id) => getCategoryStats(id, true)}`
* **Un-cancelled Animation Frame Loop in `src/components/MindMap3D.tsx`**:
  * Lines 641–683: The rendering loop is repeatedly called at 60 FPS using `requestAnimationFrame(loop)` even if `engine.tick()` is idle.

---

## 2. Logic Chain

1. **R1 (Initial Chunk Weight)**: Since `SecurityLockScreen` and `Sidebar` are imported synchronously, the initial JS bundle contains code that is either conditionally mounted or only required post-splashscreen. Converting them to Next.js dynamic imports with `ssr: false` will trim the initial critical bundle size.
2. **R1 (Main Thread Occupancy)**: Mounting heavy components like `MindMap3D` in the background (even if hidden in the DOM) executes their React lifecycles and initializes WebGL contexts. Decoupling preloading (downloading the JS chunk via dynamic `import()`) from mounting (instantiating in the DOM) prevents this idle main thread occupancy.
3. **R2 (Double Fetches)**: Performing a metadata check request followed by a full data request doubles the RTT (Round Trip Time). Merging these into a single request carrying client cache timestamps and sizes allows the server to return a `304 Not Modified` or a lightweight `notModified` flag, reducing RTT to 1.
4. **R2 (E2EE microtasks)**: Because E2EE is bypassed on development environments (returning plain strings), executing it inside an async loop incurs microtask scheduling overhead. Using synchronous parsing for plaintext payloads avoids this overhead.
5. **R3 (MindMap Re-renders)**: Omitting `areMindMap3DPropsEqual` in `React.memo` forces the 3D MindMap to re-render on every parent change. Passing the comparator resolves this.
6. **R3 (State decoupling)**: `MindMap3D` subscribes to tasks and budgets, causing it to re-render on any task/budget edit, even when in the background. Moving these subscriptions to the conditionally mounted `MindMapInspector` isolates rendering boundaries.
7. **R3 (Inline Props)**: Instantiating filters and callbacks inline inside `ProtectedApp` invalidates React Query / `useMemo` cache dependencies in child components. Wrapping them in `useMemo`/`useCallback` stabilizes the references.
8. **R3 (Zero-Occupancy Loop)**: Constantly running `requestAnimationFrame` at 60 FPS consumes CPU power during idle. Cancelling the frame loop when the physics simulation sleeps and waking it up upon mouse/touch interactions reduces idle CPU usage to 0%.

---

## 3. Caveats

* **E2EE Backward Compatibility**: Any optimization bypassing E2EE decryption async microtasks must gracefully fall back to the async crypto path if older encrypted data is encountered on disk.
* **Three.js WebGL Startup Cost**: WebGL context creation cannot be threaded and must happen on the main thread. Postponing WebGL setup until the MindMap tab is clicked will make the first transition into the MindMap tab take slightly longer (around 200–400ms), but it keeps the initial dashboard load completely smooth.

---

## 4. Conclusion

* **R1**: Initial loading times can be optimized by dynamically importing `Sidebar` and `SecurityLockScreen`, and prefetching JS bundles without background DOM mounting.
* **R2**: Network latency can be halved by introducing conditional requests using client-side `mtime`/`size` parameters and serving a fast `304 Not Modified` response from `/api/data`.
* **R3**: Tab freezes and render stutters can be mitigated by passing the missing comparator to `React.memo` on `MindMap3D`, moving task/budget subscriptions down into the inspector sub-component, caching inline props in `page.tsx`, and implementing a wake/sleep loop control for the 3D physics rendering cycle.

---

## 5. Verification Method

* **Build & Bundle Analysis**:
  * Run `npm run build` or `next build` to verify that chunk sizes for the main page decrease.
* **Network & Performance Testing**:
  * Open browser developer tools and check the Network tab.
  * Verify that `/api/data` requests return `304 Not Modified` on cache hits.
  * Verify that the separate `meta=true` queries are eliminated.
* **React Profiler**:
  * Use React Developer Tools to profile parent updates (e.g. adding a task).
  * Confirm that `MindMap3D` does not re-render when global tasks/budgets change or when it is running in the background.
