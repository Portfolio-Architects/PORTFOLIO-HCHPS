# Handoff Report - Explorer Milestone 1 Performance Analysis

## 1. Observation
We observed the following exact paths, lines, and behaviors in the codebase:
* **Splash Screen & Preloading (R1):**
  * `src/app/page.tsx:593-611` implements the splash timer:
    ```typescript
    if (isClient && !isLocked) {
      timerId = setTimeout(() => {
        setIsInitializing(false);
        removeTimerId = setTimeout(() => {
          setShowSplash(false);
        }, 700);
      }, 1800);
    }
    ```
    This shows a hardcoded 1.8s (+ 0.7s fade-out) splash window during background preloading.
  * `src/app/page.tsx:213-244` implements preloading via `requestIdleCallback` (or fallback) with staggered timeouts: `1500` ms for `mindmap`, `3500` ms for `workspace`, and `5500` ms for `law`.
  * Dynamic imports with custom loader screens are configured in `src/app/page.tsx:25-33` for `PortfolioDashboardView`, `80-83` for `MindMap3D`, `85-93` for `WorkspaceView`, and `95-103` for `LawSystemPage`.
* **Tab Switch Rendering (R2):**
  * `src/app/page.tsx:470-529` lazy-mounts visited tabs but keeps them in the DOM under hidden style (`div` with `hidden` display) when not active. Because views like `PortfolioDashboardView` (`src/components/dashboard/PortfolioDashboardView.tsx:123`) and `WorkspaceView` (`src/components/WorkspaceView.tsx:49`) are not memoized, any parent state changes in `ProtectedApp` trigger full render passes on all visited, hidden tabs.
  * `src/components/dashboard/ContactsBox.tsx:75` defines `ContactsBox` as a standard React component without memoization, running a `useMemo` filter array query on every re-render.
* **3D Mindmap Canvas Loop & Culling (R3):**
  * `src/lib/OntologyCanvasEngine.ts:490` bypasses force-directed physics computation immediately by returning false:
    ```typescript
    private runPhysicsTick(): boolean {
      return false; // 2D 평면 상대적 방사형 배치에서는 겹침이 기하학적으로 방지되어 척력이 필요 없음 (물리 비활성화)
    ```
  * Frustum culling is confirmed in `src/lib/engine/OntologyRenderer.ts`:
    * Edges: lines `475-478` check if edge render coords are within `CULL_MARGIN` of viewport boundaries.
    * Node Labels / boxes: lines `953-956` and `1015-1018` cull label computations.
    * Nodes: lines `1106-1107` skip rendering if outside view bounds.
  * Spatial partitioning GC pressure in `src/lib/engine/OntologyRenderer.ts:970-986` instantiates a new `Map` and multiple `Set` objects every single frame, along with string interpolation coordinate keys (`${r},${c}`), producing garbage collection lag during idle transitions.
* **React Query & Local API Cache (R4):**
  * `src/lib/query-client.ts:3-21` configures query cache defaults:
    ```typescript
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 15,   // 15 minutes
      // ...
      refetchOnWindowFocus: true,
    }
    ```
  * `src/lib/sheets-api.ts:52-78` implements a custom metadata checker that queries `GET /api/data?sheet=<NAME>&meta=true` to compare modification times (`mtime`) and size every 8 seconds if cache is stale.
  * Hooks like `useSchedules.ts:8`, `useContacts.ts:29`, `useInventory.ts:8-9`, `useMeetings.ts:8`, and `useSignal.ts:129` perform independent fetching using `useState` and `useEffect` on mount, bypassing React Query's deduplicated caching layers.

## 2. Logic Chain
1. **R1:** Reducing the hardcoded `1800` ms timer in `page.tsx` will directly speed up the splash loading speed for the user. Because components are loaded via dynamic code splitting skeletons, standardizing loading skeletons improves visual stability (anti-layout-shift).
2. **R2:** When changing tabs, parent state is updated. Unmemoized views in the DOM tree, even when hidden, run their render functions, leading to UI thread freezes during transition. Applying `React.memo` to `PortfolioDashboardView`, `WorkspaceView`, and `ContactsBox` blocks hidden component tree re-evaluation completely, saving CPU ticks.
3. **R3:** The physics engine is already bypassed in the canvas. Frustum culling is verified as fully active. However, rendering nodes allocates new `Map`, `Set`, and coordinate string keys (`${r},${c}`) inside the draw loop every single frame. Converting coordinate keys to bitwise integers (`(r << 16) | (c & 0xFFFF)`) and reusing a static cleared Map (`spatialGrid.clear()`) will eliminate GC allocations entirely, removing micro-stutters during idle navigation.
4. **R4:** Since VITAL runs locally, concurrent edits by other users are impossible. React Query mutations utilize query invalidations that force re-fetches immediately upon write. Thus, polling metadata every 8 seconds via `staleTime: 5 mins` and window refocusing is redundant. Increasing `staleTime` to `Infinity` and disabling `refetchOnWindowFocus` eliminates background file reads and HTTP requests entirely. Unifying custom hooks to run under `useQuery` enables deduplication and session-wide caching.

## 3. Caveats
* **Offline Storage:** We assumed `localStorage` is used solely as a volatile offline fallback/cache. If a user depends heavily on offline edits before Yjs/server sync, sudden cache clears could affect offline state (though this is mitigated by server backup sync routines).
* **Multi-tab Sync:** If a user opens the application in multiple browser tabs concurrently, setting `refetchOnWindowFocus: false` and `staleTime: Infinity` might result in stale data on the inactive tab. However, the application uses WebSocket / Yjs CRDT synchronization for real-time whiteboards, making focus refetching less critical.

## 4. Conclusion
1. **Splash Optimization:** Reduce splash duration to `1000ms` and standardise SVG skeletons.
2. **UI Freeze Prevention:** Apply `React.memo` to `PortfolioDashboardView` and `WorkspaceView` to block hidden re-renders. Memoize `ContactsBox`.
3. **Canvas GC Optimization:** Refactor spatial grid keys to integer bitwise hash keys, reuse static spatial grid, and pool grid cell arrays to zero-out GC frames.
4. **Local Cache Reinforcement:** Adjust `staleTime` to `Infinity` and `refetchOnWindowFocus: false` in `queryClient` default query options. Unify sheet hooks (`useGoogleSheet`) to React Query.

## 5. Verification Method
* **Lints and Builds:**
  Run `npm run lint` and `npm run build` to confirm there are no syntax or type errors in the engine and dashboard component modules.
* **Performance Profiling:**
  Navigate to the 3D Mindmap tab, open Chrome DevTools Performance tab, record and check GC timelines for heap allocations. Verify that frame-level allocations drop to zero during idle orbital animation.
* **Network Tab Monitoring:**
  Open Chrome Network tab. Switch between tabs and refocus the browser window. Verify that no background metadata checks (`/api/data?meta=true`) are fired when navigating pages or alt-tabbing.
