# Performance Optimization Diagnostics & Analysis Report

This report presents the diagnostic findings and proposed optimization strategies for the VITAL Work & Wealth platform. The analysis is divided into three key areas corresponding to the requirements R1, R2, and R3.

---

## R1: Initial Dashboard Loading Performance Optimization

### 1. Synchronously Imported Components in `src/app/page.tsx`
The following components are imported synchronously at the top level of `src/app/page.tsx`:
* **`Sidebar`** (Line 14):
  ```typescript
  import { Sidebar } from '@/components/Sidebar';
  ```
* **`SecurityLockScreen`** (Line 66):
  ```typescript
  import { SecurityLockScreen } from '@/components/SecurityLockScreen';
  ```

#### Diagnostic Assessment:
* **`SecurityLockScreen`** is only rendered conditionally when `isLocked` is true (representing a lock state). If the session is unlocked, loading this component synchronously adds unnecessary bundle weight to the initial critical chunk.
* **`Sidebar`** is not needed until the application completes its initial loading animation (the 1.8-second premium splash screen).
* **Recommendation**: Replace these synchronous imports with dynamic imports (`dynamic(() => import(...), { ssr: false })`) to defer script loading and reduce the initial main bundle size.

---

### 2. Staggered Sequential Preloading & Background Rendering Bottleneck
In `src/app/page.tsx` (Lines 155–187), the preloading of background modules is implemented using `preloadModulesOnIdle` with staggered timers inside a `requestIdleCallback`:
```typescript
const startStaggeredSequence = () => {
  // 1.5초 후 마인드맵 로드
  timers.push(window.setTimeout(() => triggerPreload('mindmap'), 1500));
  // 3.5초 후 예산 대조보드 로드
  timers.push(window.setTimeout(() => triggerPreload('workspace'), 3500));
  // 5.5초 후 홍보자재 대장 로드
  timers.push(window.setTimeout(() => triggerPreload('inventory'), 5500));
};
```
When `triggerPreload` is invoked, it sets `visitedModules[module] = true`.

#### Diagnostic Assessment:
* Setting `visitedModules[module] = true` forces Next.js to **render and mount** the component tree to the DOM (hidden via Tailwind's `hidden` utility class).
* Rendering heavy components like `MindMap3D` forces script parsing, component initialization, WebGL/Three.js context initialization, and event listener bindings to execute on the main thread in the background.
* This background execution causes severe CPU/GPU spikes and frame drops (micro-stuttering) while the user is actively interacting with the initial `dashboard` view.
* **Recommendation**: Decouple **script prefetching** from **DOM mounting**. Modify the preloading logic to call the dynamic import dynamically (e.g., `import('@/components/MindMap3D')`) during idle time to download and cache the JavaScript bundle, but defer actual rendering in the React tree until the user explicitly navigates to the tab (`activeModule === module`).

---

## R2: Data API Response Speed Optimization

### 1. Double-Fetch / Latency Bottleneck in `src/lib/sheets-api.ts`
The data fetching logic in `readSheet` (Lines 46–235) uses an 8-second client-side cache guard. On cache misses or stale data (older than 8s), it implements a two-step query sequence:
1. **First HTTP Request** (Metadata Verification):
   ```typescript
   const metaRes = await fetch(`${API_BASE}?sheet=${encodeURIComponent(sheetName)}&meta=true&_t=${Date.now()}`, ...);
   ```
2. **Second HTTP Request** (Full Data Retrieval - triggered if `mtime` or `size` differs from cache):
   ```typescript
   const res = await fetch(`${API_BASE}?sheet=${encodeURIComponent(sheetName)}&_t=${Date.now()}`, ...);
   ```

#### Diagnostic Assessment:
* Every stale cache access incurs a latency penalty of at least **1 RTT** (for metadata check) and **2 RTTs** if the data has changed.
* The Next.js API GET handler (`src/app/api/data/route.ts`, Lines 292–337) serves the `metaOnly` request and the full data request separately.
* **Recommendation**: Eliminate the metadata fetch request. Modify `readSheet` to pass the client's current cached `mtime` and `size` as query parameters or headers (e.g., `If-Modified-Since` or `X-Client-Mtime`) in a single GET request.
  * If the file has not been modified on disk, the server GET handler (using fast `fs.stat` without file read/parsing) should return `304 Not Modified` or `{ success: true, notModified: true }`.
  * If the file has changed, the server returns the updated data and new `mtime`/`size` in the same response.
  * This reduces the RTT to **1 RTT** in all scenarios, and saves substantial server I/O and network transmission bandwidth.

---

### 2. E2EE Microtask Overheads
In `src/lib/sheets-api.ts` (Lines 97–139), decryption is performed asynchronously for all rows:
```typescript
const decryptedPromises = json.data.map(async (row: Record<string, unknown>) => {
  if (row._enc) {
    try {
      const dec = await decryptPayload(row._enc as string) as Record<string, any>;
      ...
```

#### Diagnostic Assessment:
* Since the E2EE bypass is active (`encryptPayload` simply returns a JSON string, and `decryptPayload` performs a fast `JSON.parse` check), the actual cryptography is bypassed.
* However, calling an `async` function inside `map` and using `Promise.all` schedules thousands of microtasks in the JavaScript event loop.
* **Recommendation**: Perform a synchronous type check on the payload. If the string is plain JSON, parse it synchronously to avoid promise scheduling overhead.

---

## R3: Tab Transition and Interaction Responsiveness

### 1. Broken Prop Comparison Memoization in `src/components/MindMap3D.tsx`
`MindMap3D.tsx` defines a comprehensive prop comparison function `areMindMap3DPropsEqual` (Lines 43–68). However, at Line 72, the component is exported with default shallow comparison:
```typescript
export const MindMap3D = React.memo(function MindMap3D({ signalKeywords, signalEntries, onRenameCategory, onDeleteCategory, isActive = true }: MindMap3DProps) {
```
The custom comparison function is **completely omitted** in the `React.memo` invocation.

#### Diagnostic Assessment:
* React falls back to default shallow comparison.
* In `src/app/page.tsx` (Lines 427–436), the parent passes `signalKeywords={mergedKeywordMap}` and `signalEntries={mergedEntries}` which are computed dynamically via `useMergedSignals` on every render.
* Because these prop references change on every parent update, `MindMap3D` **always re-renders** whenever `ProtectedApp` re-renders.
* **Recommendation**: Correct the export of `MindMap3D` to pass the comparison function:
  ```typescript
  export const MindMap3D = React.memo(MindMap3DComponent, areMindMap3DPropsEqual);
  ```

---

### 2. High-Frequency State Subscriptions at Top Level of `MindMap3D.tsx`
`MindMap3D` subscribes to global hooks at its top-level (Lines 110–111):
```typescript
const { tasks = [] } = useTasks();
const { categories = [], getCategoryStats } = useBudget();
```

#### Diagnostic Assessment:
* These subscriptions force the entire 3D MindMap component to re-render whenever any task or budget category is added, updated, or deleted, even if the MindMap tab is currently in the background (`isActive = false`).
* These data arrays are only needed for the `MindMapInspector` side panel, which is only rendered when a node is actively selected (`activeNode !== null`).
* **Recommendation**: Move `useTasks()` and `useBudget()` inside `MindMapInspector` to isolate rendering boundaries.

---

### 3. Inline Arrow Functions & Fresh References in `src/app/page.tsx`
In `src/app/page.tsx` (Lines 443–466), several prop references are instantiated inline:
```typescript
budgetEntries={budgetEntries.filter(e => !e.isPlanned)}
getCategoryStats={(id) => getCategoryStats(id, true)}
```

#### Diagnostic Assessment:
* The inline `.filter` and inline arrow function create new references on every single render.
* This breaks memoization on `WorkspaceView` and `BudgetDashboard` and forces child `useMemo` hooks inside `useBudgetFilters` to invalidate and re-evaluate.
* **Recommendation**: Wrap these filtered data arrays and callback wrappers in `useMemo` and `useCallback` inside `ProtectedApp` before passing them down.

---

### 4. Continuous Idle Animation Frame Loop in `MindMap3D.tsx`
The animation loop in `MindMap3D.tsx` (Lines 641–683) runs `requestAnimationFrame(loop)` continuously at 60 FPS, calling `engine.tick()` on every frame.

#### Diagnostic Assessment:
* Although `engine.tick()` implements an idle threshold to skip rendering (`idleFramesCount > 90`), the `requestAnimationFrame` loop itself is never canceled.
* The browser still wakes up 60 times a second to execute Javascript checks, causing unnecessary CPU cycles (and battery drain on laptop devices).
* **Recommendation**: Implement a **Zero-Occupancy Sleep** mechanism. When `engine.tick()` indicates the physics simulation is fully cooled down and no camera movement is active, cancel the animation loop. Re-register and wake it up only when user interactions (mousedown, wheel, touch, hover) or state changes occur.
