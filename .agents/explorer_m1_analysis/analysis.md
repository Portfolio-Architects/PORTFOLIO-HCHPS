# VITAL Web Application Performance Optimization - Milestone 1 Analysis Report

## Core Summary
This read-only investigation maps performance bottlenecks in initial loading, tab transitions, canvas rendering, and data caching. By optimizing React rendering scope (using `React.memo`), eliminating Garbage Collection (GC) allocations inside the 60 FPS animation loop, and aligning React Query's cache invalidation, the application can achieve near-zero idle CPU usage and seamless transitions.

---

## Requirement 1 (R1): Initial Page Loading Speed & Splash Optimization

### 1. Splash Screen Timer and Lifecycle
The splash screen is governed by state variables `showSplash` and `isInitializing` within the main entry point `src/app/page.tsx`.

* **Code Block:** `src/app/page.tsx` (Lines 593-611)
  ```typescript
  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    let removeTimerId: NodeJS.Timeout | undefined;

    // 클라이언트 마운트 및 PIN 락이 해제되어 활성화된 순간부터 1.8초 동안만 스플래시 가동
    if (isClient && !isLocked) {
      timerId = setTimeout(() => {
        setIsInitializing(false);
        removeTimerId = setTimeout(() => {
          setShowSplash(false);
        }, 700);
      }, 1800);
    }

    return () => {
      if (timerId) clearTimeout(timerId);
      if (removeTimerId) clearTimeout(removeTimerId);
    };
  }, [isClient, isLocked]);
  ```
* **Analysis:**
  * Once the PIN lock screen is unlocked, the splash screen remains active for `1800ms` (1.8s) of core initialization, followed by a `700ms` fade-out transition (governed by CSS `transition-opacity duration-700 ease-out`).
  * Total splash display duration is `2500ms` (2.5 seconds).
  * During this time, the underlying layout and the default tab (`PortfolioDashboardView`) are mounted in the background.

### 2. Dynamic Lazy Loading & Skeletons
Major components are dynamically imported with loader skeletons using Next.js `dynamic()` to minimize the initial JS bundle size.

| Component | Target File | Import Location | Loader Skeleton Component |
|---|---|---|---|
| `PortfolioDashboardView` | `src/components/dashboard/PortfolioDashboardView.tsx` | `src/app/page.tsx:25-33` | Simple spinner loader spinner |
| `MindMap3D` | `src/components/MindMap3D.tsx` | `src/app/page.tsx:80-83` | `MindMap3DSkeleton` (HUD, orbital rings) |
| `WorkspaceView` | `src/components/WorkspaceView.tsx` | `src/app/page.tsx:85-93` | Simple spinner loader spinner |
| `LawSystemPage` | `src/components/law/LawSystemPage.tsx` | `src/app/page.tsx:95-103` | Simple spinner loader spinner |

* **Dynamic Preloading:**
  In `src/app/page.tsx` (Lines 213-244), a staggered preloading mechanism loads heavy module JS bundles during idle periods (using `requestIdleCallback` or staggered timeouts):
  * **1.5s post-initialization:** Preloads `MindMap3D`
  * **3.5s post-initialization:** Preloads `WorkspaceView` (Budget)
  * **5.5s post-initialization:** Preloads `LawSystemPage`

### 3. Recommended Optimization Strategies for R1
1. **Reduce Hardcoded Splash Screen Time:**
   Since bundle preloading and hydration occur rapidly, the hardcoded `1800ms` delay can be shortened to `1000ms` (or tied dynamically to the loading status of the default `PortfolioDashboardView` query fetches), reducing the user's wait time by up to 800ms.
2. **Standardize Skeletons:**
   Standardize basic loading indicators to use custom SVG Tailwind-pulse skeleton screens matching the exact layout dimensions of the component to prevent layout shifts.

---

## Requirement 2 (R2): Tab Switching UI Freeze Prevention & Rendering Optimization

### 1. Rendering Lifecycle During Tab Switches
The VITAL dashboard renders tabs in a persistent "lazy mount and hide" model:
* **Code Block:** `src/app/page.tsx` (Lines 470-529)
  ```typescript
  {/* Dashboard */}
  {visitedModules.dashboard && (
    <div className={activeModule === 'dashboard' ? 'block' : 'hidden'}>
      <PortfolioDashboardView ... />
    </div>
  )}
  {/* MindMap3D */}
  {visitedModules.mindmap && (
    <div className={activeModule === 'mindmap' ? 'block' : 'hidden'}>
      <MindMapErrorBoundary>
        <MindMap3D ... isActive={activeModule === 'mindmap'} />
      </MindMapErrorBoundary>
    </div>
  )}
  ```
* **Analysis:**
  * When switching tabs, `activeModule` state changes in the parent `ProtectedApp` component.
  * This causes a full re-render of `ProtectedApp`. Since `PortfolioDashboardView` and `WorkspaceView` are **not memoized**, they execute their entire render bodies, recalculate stats via hooks, and recreate internal layouts, even when their container `div` is set to `display: none` (`hidden`).
  * While `MindMap3D` is wrapped in `React.memo` (with `areMindMap3DPropsEqual`), it receives `isActive` as a prop. A transition from active to inactive changes `isActive` and triggers a full render update cycle.

### 2. Heavy Subcomponents
* **`PortfolioDashboardView`:** Calls `usePortfolioAnalytics` which aggregates budget categories and entries. Inside the view, `<WeeklyScheduler />` (memoized) and `<ContactsBox />` (not memoized) are mounted.
* **`ContactsBox`:** Line 75 in `src/components/dashboard/ContactsBox.tsx` defines it without memoization. Re-rendering `ContactsBox` runs complex filtering logic on the contacts array.

### 3. Recommended Optimization Strategies for R2
1. **Wrap Views in `React.memo`:**
   Wrap `PortfolioDashboardView` and `WorkspaceView` in `React.memo` to prevent re-renders when parent states (other than their direct data props) change.
   * `PortfolioDashboardView` only receives `tasks`, `budgetCategories`, `budgetEntries`, `appMode`. It does not depend on `activeModule`.
   * `WorkspaceView` only receives budget data.
2. **Memoize `ContactsBox`:**
   Wrap `ContactsBox` in `React.memo` to eliminate unnecessary rendering within the dashboard view.
3. **Staggered Render on First Activation:**
   `PortfolioDashboardView` already uses `renderScheduler` and `renderContacts` state timers (120ms and 280ms) to mount widgets after the container mounts, which is correct. Implement similar staggered rendering for budget breakdown tables in `WorkspaceView` to prevent initial page freeze.

---

## Requirement 3 (R3): 3D Mindmap Rendering Speed & GC Lag Removal

### 1. Canvas Animation & Physics Loops
The 3D Mindmap is powered by `OntologyCanvasEngine` and drawn using `OntologyRenderer`.
* **Physics Simulation Bypass:**
  In `src/lib/OntologyCanvasEngine.ts` (Lines 489-490), the force layout physics loop is hardcoded to return false:
  ```typescript
  private runPhysicsTick(): boolean {
    return false; // 2D 평면 상대적 방사형 배치에서는 겹침이 기하학적으로 방지되어 척력이 필요 없음 (물리 비활성화)
  ```
  This saves massive CPU calculations since force-directed algorithms are bypassed, and positions are computed geometrically in `OntologyLayout.ts`.
* **Animation Sleep Cycle:**
  If the screen is idle for over 1.5 seconds (90 frames), `tick()` returns `false` and cancels the `requestAnimationFrame` loop, reducing background CPU load to nearly 0%.

### 2. Frustum Culling Verification
Frustum culling is **verified** as fully implemented:
* **Edges:** `src/lib/engine/OntologyRenderer.ts` (Lines 474-478)
  ```typescript
  // Frustum cull
  if (src.renderX < -CULL_MARGIN && tgt.renderX < -CULL_MARGIN) continue;
  if (src.renderX > canvasW + CULL_MARGIN && tgt.renderX > canvasW + CULL_MARGIN) continue;
  if (src.renderY < -CULL_MARGIN && tgt.renderY < -CULL_MARGIN) continue;
  if (src.renderY > canvasH + CULL_MARGIN && tgt.renderY > canvasH + CULL_MARGIN) continue;
  ```
* **Node Labels / textAllowedSet:** `src/lib/engine/OntologyRenderer.ts` (Lines 953-956 and 1015-1018)
* **Nodes Rendering:** `src/lib/engine/OntologyRenderer.ts` (Lines 1104-1107)

### 3. Garbage Collection (GC) Pressure Analysis
While `OntologyRenderer` implements object pooling for `textBoxPool`, `edgePool`, `flowParticlesPool`, and `labelsToDrawPool`, a significant GC bottleneck exists inside `renderNodes` when `isFastPath` is false (during idle/slow path):
* **Code Block:** `src/lib/engine/OntologyRenderer.ts` (Lines 970-986)
  ```typescript
  const gridCellSize = 120;
  const spatialGrid = new Map<string, Array<{x1: number, y1: number, x2: number, y2: number}>>();

  const getGridKeys = (x1: number, y1: number, x2: number, y2: number) => {
    const keys = new Set<string>();
    const colStart = Math.floor(x1 / gridCellSize);
    const colEnd = Math.floor(x2 / gridCellSize);
    const rowStart = Math.floor(y1 / gridCellSize);
    const rowEnd = Math.floor(y2 / gridCellSize);

    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = colStart; c <= colEnd; c++) {
        keys.add(`${r},${c}`);
      }
    }
    return keys;
  };
  ```
* **GC Bottleneck:**
  * A new `Map` is allocated every single frame in the slow path: `new Map()`.
  * `getGridKeys` is called once for every text label candidate, allocating a `new Set<string>()` on every call.
  * Constructing grid coordinate string keys (`${r},${c}`) allocates thousands of temporary strings, causing significant GC overhead.
  * Spatial grid cell arrays (`[]`) are newly instantiated, leading to array allocation overhead.

### 4. Recommended Optimization Strategies for R3
1. **Integer Key Mapping (Eliminate String Allocations):**
   Convert `Map<string, Array>` to `Map<number, Array>` using bitwise operations:
   `const key = (r << 16) | (c & 0xFFFF);`
   This maps row/column coordinate pairs to a single integer key, completely eliminating string allocation overhead.
2. **Re-use Spatial Grid Map:**
   Define `spatialGrid` as a static class property and clear it at the beginning of `renderNodes` (`spatialGrid.clear()`) instead of instantiating it per frame.
3. **Pool Grid Arrays:**
   Integrate a grid array pool (similar to `cellArrayPool` in `OntologyCanvasEngine`) to store cell boxes, avoiding `[]` allocations.
4. **Remove Set Allocations in `getGridKeys`:**
   Refactor overlap detection to inspect columns and rows via direct loops over coordinate offsets, eliminating the need to return a `Set` of keys.

---

## Requirement 4 (R4): API Data Fetching Delay & Local Caching Reinforcement

### 1. Server-Side Data & File Caching
In `src/app/api/data/route.ts`, the backend reads and writes flat JSON files from disk.
* **Server-side Cache:** A static `apiCache` Map caches parsed JSON data by checking file modification time `mtimeMs`.
* **Not-Modified Check (HTTP 304 Style):**
  ```typescript
  if (clientMtime && clientSize && clientMtime === stats.mtimeMs && clientSize === stats.size) {
    return NextResponse.json({ success: true, notModified: true, mtime: stats.mtimeMs, size: stats.size });
  }
  ```

### 2. Client-Side sheets-api Custom Cache
In `src/lib/sheets-api.ts`, `readSheet` implements an 8-second client-side check guard:
* **8s Cache Guard:** If a client metadata check was performed within 8 seconds, it returns cached data instantly.
* **Metadata Check Fallback:** Otherwise, it queries `GET /api/data?meta=true` to compare `mtime` and `size`. If they match, it returns cached data.

### 3. TanStack React Query Caching
VITAL configures TanStack React Query in `src/lib/query-client.ts` with:
* `staleTime: 5 minutes`
* `gcTime: 15 minutes`
* `refetchOnWindowFocus: true` (refetches every time window focus is gained)

### 4. GC & Query Cache Mismatch
* Because the app is a local-only workflow running on a single PC, data changes only occur when the user performs writes.
* A 5-minute `staleTime` causes frequent invalidations. When stale, any window refocus triggers a `readSheet` call. This triggers the client-side metadata check (`GET /api/data?meta=true`), invoking `fs.stat` on disk files.
* **Non-React Query Hooks:** Hooks like `useSchedules.ts`, `useContacts.ts`, `useInventory.ts`, `useMeetings.ts`, and `useSignal.ts` bypass TanStack React Query and implement custom fetching using `useState` and `useEffect`. They fetch from the server on every component mount, bypassing React Query's deduplication.

### 5. Recommended Optimization Strategies for R4
1. **Increase `staleTime` and Disable Window Focus Refetching:**
   In `src/lib/query-client.ts`, configure:
   ```typescript
   queries: {
     staleTime: Infinity, // Or 1000 * 60 * 30 (30 minutes)
     gcTime: 1000 * 60 * 60, // 1 hour
     refetchOnWindowFocus: false, // Prevent query refetching on Alt-Tab refocus
   }
   ```
   * **Why this is safe:** All data writes (`useTasks`, `useBudget`) are wrapped in TanStack Mutations that call `onSettled: () => queryClient.invalidateQueries(...)`. Invalidation marks the cache as stale immediately and triggers an on-demand reload. Setting `staleTime: Infinity` guarantees zero network requests during browsing, and updates remain instantaneous.
2. **Consolidate State Hooks under React Query:**
   Refactor `useGoogleSheet` and `useSignal` to fetch data via React Query (`useQuery`) instead of local `useEffect` fetching. This centralizes the caching policy, ensures data deduplication, and avoids multi-mount fetch requests.
