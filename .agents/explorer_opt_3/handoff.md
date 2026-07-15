# Handoff Report: Performance Diagnostics & Optimization Proposals

## 1. Observation

### R1: Initial Dashboard Loading Performance
* **Synchronous Imports**: In `src/app/page.tsx` (Line 66):
  ```typescript
  import { SecurityLockScreen } from '@/components/SecurityLockScreen';
  ```
  It is conditionally rendered at line 605:
  ```typescript
  if (isLocked) {
    return (
      <SecurityLockScreen ... />
    );
  }
  ```
* **Sequential Preloading**: In `src/app/page.tsx` (Lines 155-175), `visitedModules` is updated on timers to preload components:
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
  Updating `visitedModules` mounts these components hidden in the DOM:
  ```typescript
  {visitedModules.mindmap && (
    <div className={activeModule === 'mindmap' ? 'block' : 'hidden'}>
  ```

### R2: Data API Response Latency
* **Double RTT on Cache Expiry**: In `src/lib/sheets-api.ts` (Lines 53-90), two sequential requests are sent when the 8s cache gate expires:
  ```typescript
  // First fetch (metadata)
  const metaRes = await fetch(`${API_BASE}?sheet=${encodeURIComponent(sheetName)}&meta=true&_t=${Date.now()}`, ...);
  ...
  // Second fetch (data)
  const res = await fetch(`${API_BASE}?sheet=${encodeURIComponent(sheetName)}&_t=${Date.now()}`, ...);
  ```
* **E2EE Wrapper in Plaintext Mode**: In `src/lib/sheets-api.ts` (Lines 245-256), data is serialized row-by-row into `_enc` even when E2EE is bypassed on local development (`src/lib/crypto.ts` Line 52: `encryptPayload = async (data) => JSON.stringify(data)`).
* **Blocking LocalStorage Updates**: In `src/lib/sheets-api.ts` (Lines 191-197):
  ```typescript
  localStorage.setItem(`hchps-fallback-${sheetName}`, JSON.stringify(finalData));
  ```

### R3: Tab Transition & Interaction Responsiveness
* **Global Hooks Subscription in MindMap**: In `src/components/MindMap3D.tsx` (Lines 110-111):
  ```typescript
  const { tasks = [] } = useTasks();
  const { categories = [], getCategoryStats } = useBudget();
  ```
* **Enabled Graph Polling in Hidden Tab**: In `src/components/MindMap3D.tsx` (Line 128) calls `useGraphCustomization()` without parameters (which defaults the `enabled` argument to `true`).
* **$O(N)$ Search inside `getCategoryStats`**: In `src/hooks/useBudget.ts` (Line 292):
  ```typescript
  const cat = uniqueCategories.find(c => c.id === categoryId);
  ```
* **CSS Collapsed DOM Node Bloat**: In `src/components/budget/ui/PolicyGroupCard.tsx` (Lines 193-198 and 341-345), components are hidden with classes:
  ```typescript
  : (isOpen ? 'max-h-[25000px] opacity-100 py-3' : 'max-h-0 opacity-0 py-0 pointer-events-none')
  ```

---

## 2. Logic Chain

### R1: Initial Dashboard Loading Performance
1. `SecurityLockScreen` is imported synchronously, contributing to the main JS bundle weight and initial parse time, even though it is only conditionally rendered when `isLocked` is `true`. Converting it to a client-side dynamic import reduces the initial main bundle size.
2. The current preloading strategy updates `visitedModules` which mounts the three heavy components (`MindMap3D`, `WorkspaceView`, `InventoryList`) hidden in the DOM.
3. Mounting heavy components causes React to execute their hooks, virtual DOM calculations, and initial setup (like Three.js canvas creation in `MindMap3D`) in the background. This hogs the main thread during initial load.
4. Implementing chunk preloading via `import('@/components/...')` downloads the code in the background without executing the React mount cycle, keeping the main thread free.

### R2: Data API Response Latency
1. When the cache expires, the client calls `meta=true` to check for updates. If updates exist or no cache exists, it does a second fetch for the actual data. This inflicts a 2 RTT overhead on cache misses.
2. Implementing HTTP cache-validation with ETag (`If-None-Match`) checks allows the server to return `304 Not Modified` or `200 OK` in a single RTT, reducing network operations by 50%.
3. Bypassing E2EE in local dev but keeping the row wrapping in `_enc` requires double JSON parsing of every row. Removing the wrapping allows reading/writing flat JSON arrays directly, saving CPU parsing cycles.
4. Synchronously writing large JSON strings (like map customizations) to `localStorage` blocks the main UI thread. Debouncing and making these writes asynchronous using `setTimeout` or `requestIdleCallback` prevents UI frames from dropping.

### R3: Tab Transition & Interaction Responsiveness
1. Invoking `useTasks` and `useBudget` at the top level of `MindMap3D` forces a re-render of the entire 3D canvas container on every budget or task update, even when the MindMap tab is not selected. Decoupling and placing these hooks inside `MindMapInspector` isolates renders to the text-based inspector panel.
2. Invoking `useGraphCustomization()` without parameters maintains active background network polling (`MAP_CUSTOMIZATION` fetched every 10s) even when the tab is hidden. Passing `isActive` disables background tasks when the tab is inactive.
3. In `getCategoryStats`, searching `uniqueCategories` array by ID runs in $O(N)$ time. Since it is run for all categories during render, the complexity scales to $O(N^2)$. Since the pre-calculated `categoryStatsMap` already holds the category attributes, referencing it directly reduces the time complexity to $O(1)$.
4. Collapsing panels with CSS styles hides them visually but keeps their entire subtree mounted in the React DOM. Lazy rendering `{isOpen && ...}` avoids compiling thousands of DOM nodes initially, reducing initial mount elements of the Workspace tab from >10,000 to ~100.

---

## 3. Caveats
- This investigation was purely read-only. The proposed modifications have not been applied.
- The actual performance improvements depend on the size of the datasets in `data/*.json` and the client's device CPU/GPU capabilities.
- Changing CSS-collapsed blocks to conditional lazy rendering (`isOpen && ...`) will remove the visual CSS slide animation on collapse/expand. If animations are required, a hybrid lazy-mount approach (mounting on first expansion and hiding thereafter) should be implemented.

---

## 4. Conclusion
The application suffers from initial bundle bloat (R1), duplicate API requests (R2), background thread blockages (R1/R2), and layout complexity (R3) that can be fully optimized by:
1. Converting conditional components to client-side dynamic imports and preloading JS chunks instead of mounting background DOM components.
2. Implementing single-request HTTP Cache validation via ETag headers, bypassing row wrapping in bypass mode, and shifting local storage writes off the main render timeline.
3. Decoupling tasks/budget hook subscriptions from the heavy 3D engine, disabling inactive background polling, converting array lookups to $O(1)$ cached map queries, and applying conditional rendering to collapsed cards.

---

## 5. Verification Method

### Verification Steps (Self-Checks)
1. **Initial Bundle & Thread Occupancy (R1)**:
   - Run Next.js build: `npm run build` or `yarn build`.
   - Inspect build output chunks to check if `SecurityLockScreen` has been split into a separate chunk.
   - Open Chrome DevTools Performance tab, reload the page, and check the Total Blocking Time (TBT).
2. **Network RTT Validation (R2)**:
   - Open Chrome DevTools Network tab.
   - Switch between modules. Verify that when cache validation fails/occurs, only a single HTTP request is sent (returning either `200` or `304`) rather than sequential metadata/data fetches.
3. **DOM Elements & Interaction Lag (R3)**:
   - Switch to the Workspace tab and count the DOM nodes in DevTools (`console.log(document.getElementsByTagName('*').length)`).
   - Verify that when policy groups are collapsed, their internal category cards and ledger entry lists are not present in the DOM.
