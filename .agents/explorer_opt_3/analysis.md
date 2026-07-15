# Performance Optimization Diagnostics & Analysis Report

## Executive Summary
This report analyzes and identifies performance bottlenecks in the **VITAL Work & Wealth Architecture** codebase across three core areas: Initial Dashboard Loading (R1), Data API Response Latency (R2), and Tab Transition/Interaction Responsiveness (R3). Specific code paths and optimization proposals are detailed below.

---

## R1: Initial Dashboard Loading Performance Optimization
**Target File**: `src/app/page.tsx`

### 1. Synchronous Component Imports
In `src/app/page.tsx`, the following component is imported synchronously but is not rendered immediately or is conditionally rendered on client-side state:
- **`SecurityLockScreen` (Line 66)**:
  ```typescript
  import { SecurityLockScreen } from '@/components/SecurityLockScreen';
  ```
  * **Observation**: It is only rendered if `isLocked` is `true` (Line 605). When PIN lock is setup and bypass is active, this component is never shown but its code is bundled in the main bundle.
  * **Proposal**: Convert to dynamic import with `ssr: false`:
    ```typescript
    const SecurityLockScreen = dynamic(() => import('@/components/SecurityLockScreen').then(mod => mod.SecurityLockScreen), {
      ssr: false
    });
    ```

- **`Sidebar` (Line 14)**:
  ```typescript
  import { Sidebar } from '@/components/Sidebar';
  ```
  * **Observation**: While this is the layout header/dock and is always visible, it only performs client-side rendering. Keeping it synchronous is generally acceptable to prevent layout shift (CLS), but it could be loaded dynamically if CLS is mitigated with a skeleton fallback.

### 2. Staggered Sequential Preloading & Background Rendering Overhead
* **Observation**: `page.tsx` implements a staggered preloading strategy in `preloadModulesOnIdle` (Lines 155-187):
  ```typescript
  const triggerPreload = (module: ModuleType) => {
    setVisitedModules(prev => {
      if (prev[module]) return prev;
      return { ...prev, [module]: true };
    });
    console.log(`[Watcher Preload] Background caching initialized for: ${module}`);
  };
  ```
  This updates state `visitedModules` after 1.5s (`mindmap`), 3.5s (`workspace`), and 5.5s (`inventory`).
  When `visitedModules.[module]` becomes `true`, the corresponding heavy component (`MindMap3D`, `WorkspaceView`, `InventoryList`) is **mounted in the DOM** with `className={activeModule === '...' ? 'block' : 'hidden'}` (Lines 415-481).
* **Problem**: React mounts and executes the entire component tree, running all initial hook calls, virtual DOM diffing, and library initializations (such as Three.js/Canvas engines in `MindMap3D`) on initial load. This blocks the main thread in the background, increasing Total Blocking Time (TBT) and delaying Time to Interactive (TTI).
* **Proposal**: 
  - Change the preloading mechanism to **JS chunk-only preloading**. Instead of mounting components in the DOM, execute the dynamic loader function on idle to trigger the chunk download and store it in the browser's cache:
    ```typescript
    const preloadMindMap = () => import('@/components/MindMap3D');
    const preloadWorkspace = () => import('@/components/WorkspaceView');
    const preloadInventory = () => import('@/components/inventory/InventoryList');
    ```
  - Only mount the React component in the DOM when the user actually switches to that module (`activeModule === 'mindmap'`). Since the JS chunk was pre-fetched, the tab will mount instantly without blocking the initial loading phase.

---

## R2: Data API Response Speed Optimization
**Target Files**: `src/lib/sheets-api.ts`, `src/app/api/data/route.ts`

### 1. Dual Round-Trip Latency on Stale Cache
* **Observation**: In `src/lib/sheets-api.ts` (Lines 46-95), when the 8-second client-side cache guard expires, it first performs a metadata verification request to check if the database file modified time/size has changed:
  ```typescript
  const metaRes = await fetch(`${API_BASE}?sheet=${encodeURIComponent(sheetName)}&meta=true&_t=${Date.now()}`, ...);
  ```
  If the metadata has changed (or cache is empty), the client makes a **second HTTP request** to fetch the full data:
  ```typescript
  const res = await fetch(`${API_BASE}?sheet=${encodeURIComponent(sheetName)}&_t=${Date.now()}`, ...);
  ```
* **Problem**: Stale or empty caches always suffer from **2 sequential round-trips (RTT)** to fetch the data.
* **Proposal**: Implement standard single-RTT HTTP cache validation using `ETag` and `If-None-Match`.
  - In `src/app/api/data/route.ts` `GET` handler, generate a weak ETag based on file `mtime` and `size`, and check request headers:
    ```typescript
    const etag = `W/"${stats.mtimeMs}-${stats.size}"`;
    if (request.headers.get('if-none-match') === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }
    ```
  - In `src/lib/sheets-api.ts`, send exactly **1 request** requesting the data, carrying the cached `mtime/size` in the `If-None-Match` header. If modified, parse the `200 OK` response; if not, return the cached data immediately upon receiving a `304 Not Modified` status.

### 2. E2EE Wrapping Parse Overhead (Bypass Mode)
* **Observation**: As per Rule 2-A, E2EE encryption is bypassed in local development (`src/lib/crypto.ts` Line 52), storing plaintext strings directly. However, the client client-side API still wraps rows in an `{ id, _enc }` wrapper where `_enc` contains the rest of the row fields stringified (Lines 245-261 in `sheets-api.ts` `writeData`):
  ```typescript
  const { id, ...rest } = row;
  const _enc = await encryptPayload(rest);
  return { id, _enc };
  ```
* **Problem**: On every load, the client must await `Promise.all` decryption promises (Lines 97-139 in `readSheet`) and execute a nested `JSON.parse` on the `_enc` property of every single row. For large configuration files like `data/MAP_CUSTOMIZATION.json` (~871 KB), this double parsing is extremely CPU intensive.
* **Proposal**: In E2EE bypass mode, write and read raw flat JSON arrays directly on the server and client, completely bypassing row-by-row wrapping in `_enc`.

### 3. Blocking LocalStorage Writes for Large Files
* **Observation**: In `readSheet` (Lines 191-197), after fetching data, the client synchronously updates a local storage offline backup:
  ```typescript
  localStorage.setItem(`hchps-fallback-${sheetName}`, JSON.stringify(finalData));
  ```
* **Problem**: For large sheets (e.g. `MAP_CUSTOMIZATION` which is ~871 KB), writing this data synchronously on the main thread freezes the user interface.
* **Proposal**: Wrap `localStorage` backup writes in a deferred macro-task using `setTimeout` or `requestIdleCallback`, and entirely skip local storage backups for files larger than a designated size threshold (e.g. >100 KB) to prevent hitting local storage quota limits and stalling.

---

## R3: Tab Transition and Interaction Responsiveness
**Target Files**: `src/components/MindMap3D.tsx`, `src/hooks/useBudget.ts`, `src/components/budget/ui/PolicyGroupCard.tsx`

### 1. Unnecessary Global State Subscriptions in `MindMap3D`
* **Observation**: `MindMap3D.tsx` invokes `useTasks()` and `useBudget()` at its top-level component scope (Lines 110-111):
  ```typescript
  const { tasks = [] } = useTasks();
  const { categories = [], getCategoryStats } = useBudget();
  ```
  It then derives `matchedCat`, `catStats`, and `matchedTasks` using `useMemo` (Lines 113-127) and passes them as props to the leaf inspector panel `<MindMapInspector />`.
* **Problem**: Even when the MindMap tab is not active (but hidden in the background DOM), any mutation in tasks or budget data in other tabs will cause `useTasks` and `useBudget` to trigger a **full re-render of `MindMap3D`**. This slows down interactions in the active tabs.
* **Proposal**: Decouple the state subscriptions. Remove `useTasks` and `useBudget` from `MindMap3D.tsx` and invoke them inside `MindMapInspector` directly. Since the inspector is the only panel that displays this information when a node is clicked, `MindMap3D` will never render due to task/budget changes.

### 2. Background Graph Polling in Hidden Tab
* **Observation**: `MindMap3D.tsx` invokes the custom hook `useGraphCustomization()` at line 128 without arguments:
  ```typescript
  const { overrides = {}, customNodes = [], customEdges = [], ... } = useGraphCustomization();
  ```
  This defaults the `enabled` parameter to `true`.
* **Problem**: In `useGraphCustomization.ts`, `enabled = true` sets up a 10-second polling interval (Line 490) that reads `MAP_CUSTOMIZATION` from the server. This interval continues to pull and process data in the background even if the mindmap tab is hidden.
* **Proposal**: Pass the tab active state to the hook in `MindMap3D.tsx`:
  ```typescript
  const { overrides = {}, ... } = useGraphCustomization(isActive);
  ```
  This suspends background network polling when the user is working on other tabs.

### 3. $O(N)$ Category Scanning in `getCategoryStats`
* **Observation**: In `src/hooks/useBudget.ts`, the `getCategoryStats` wrapper (Lines 287-302) performs an array search on `uniqueCategories` when `excludePlanned` is `true`:
  ```typescript
  const cat = uniqueCategories.find(c => c.id === categoryId);
  ```
  This hook is passed to the budget table where it is executed for every single rendered category.
* **Problem**: Because `excludePlanned` is set to `true` globally in `WorkspaceView.tsx` (Line 55), the table rendering suffers from an $O(N^2)$ time complexity overhead, searching through arrays repeatedly on render.
* **Proposal**: Eliminate the `.find` call. The pre-calculated `categoryStatsMap` already stores the aggregate `totalBudget` and `locked` values. Read them directly from `cached`:
  ```typescript
  const remaining = cached.totalBudget - cached.spent - cached.locked;
  const usageRate = cached.totalBudget > 0 ? (cached.spent / cached.totalBudget) * 100 : 0;
  ```
  This reduces `getCategoryStats` with `excludePlanned = true` to an $O(1)$ constant time lookup.

### 4. DOM Bloat via CSS-Hidden Accordions
* **Observation**: In `src/components/budget/ui/PolicyGroupCard.tsx`, children (categories and detailed groups) are rendered in the DOM and toggled visually using CSS class animations:
  ```typescript
  className={`px-5 transition-all duration-500 ease-in-out overflow-hidden divide-y divide-gray-100 ${
    hidePolicyHeader 
      ? 'px-1 pt-1 border border-slate-200 rounded-xl bg-white shadow-sm py-3' 
      : (isOpen ? 'max-h-[25000px] opacity-100 py-3' : 'max-h-0 opacity-0 py-0 pointer-events-none')
  }`}
  ```
  The same styling-based collapse pattern is used inside categories to hide calculations (Lines 340-346).
* **Problem**: On initial tab mount, React evaluates and mounts the entire tree of thousands of DOM elements (Policy groups, categories, sub-items, calculations, entries) even though they are all collapsed by default. This causes severe lag and transition freezes when opening the Workspace tab.
* **Proposal**: Implement **Lazy Conditional Rendering**. Do not render children in the DOM unless their parent group/category is expanded:
  ```typescript
  {isOpen && (
    <div className="divide-y divide-gray-100 py-3">
      {groupedByDetail.map(detailGroup => ( ... ))}
    </div>
  )}
  ```
  By only mounting headers initially, the initial DOM element count drops from >10,000 to ~100, making the tab switch instantaneous.
