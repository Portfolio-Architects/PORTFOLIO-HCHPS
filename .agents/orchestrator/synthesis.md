# Synthesized Optimization Findings and Proposals

This document synthesizes the findings of Explorer 1, Explorer 2, and Explorer 3.

## R1: Initial Dashboard Loading Performance Optimization
1. **Dynamic Import of Conditionally Rendered Components**:
   - `SecurityLockScreen` in `src/app/page.tsx` is imported statically but conditionally rendered when `isLocked` is true. Convert to a dynamic import with `ssr: false`.
   - `Sidebar` can also be dynamically imported if needed.
2. **Decouple Preloading from DOM Mounting**:
   - The staggered sequence in `page.tsx` mounts heavy modules (`MindMap3D`, `WorkspaceView`, `InventoryList`) hidden in the DOM using `visitedModules` timers.
   - This executes React rendering cycles, custom hooks, and WebGL (Three.js) canvas initialization during the splash screen, causing CPU contention.
   - **Optimization**: Change the preloader to download the JS chunks without DOM mounting (e.g. via dynamic import prefetch call or simply dynamically import them but delay DOM mounting until the active module is selected).

## R2: Data API Response Speed Optimization
1. **Merge Metadata Check & Data Fetch (1 RTT Read)**:
   - In `src/lib/sheets-api.ts`, `readSheet` makes a metadata request followed by a data request if changed. This is 2 RTTs.
   - **Optimization**: Combine this. The client should send the cached version (timestamp `mtime` and `size`) in a single GET request (e.g., as query parameters or headers like `If-None-Match`/`If-Modified-Since`). The server in `src/app/api/data/route.ts` will check the file metadata on disk and return either `304 Not Modified` (a simple `{ notModified: true }` JSON block) or the full updated data payload in a single HTTP round-trip.
2. **Bypass E2EE Row-by-Row Async Overhead**:
   - In `src/lib/sheets-api.ts`, the E2EE bypass is active in development but the code still maps every row to an async task `decryptPayload` via `Promise.all`.
   - **Optimization**: Check if E2EE is bypassed (plain-text payload) and parse it synchronously, skipping the promise microtask overhead.
3. **Asynchronous LocalStorage Writes**:
   - Synchronous `localStorage.setItem` blocks the main thread.
   - **Optimization**: Wrap non-critical `localStorage` writes (fallback cache writing) in `setTimeout` or `requestIdleCallback`.

## R3: Tab Transition and Interaction Responsiveness
1. **Fix MindMap3D Memoization**:
   - `MindMap3D` has `areMindMap3DPropsEqual` defined but is never passed to `React.memo()`. Change `React.memo(MindMap3D)` to `React.memo(MindMap3D, areMindMap3DPropsEqual)`.
2. **Decouple Global Hook Subscriptions from MindMap3D**:
   - `MindMap3D` subscribes to `useTasks` and `useBudget` at the top level. Since they change frequently, they trigger full re-renders of the heavy 3D engine even when the MindMap is inactive.
   - **Optimization**: Move these subscriptions down to the conditional `MindMapInspector` or similar child components that actually render the text.
3. **Decouple useGraphCustomization Polling**:
   - `useGraphCustomization()` is called in `MindMap3D` without parameters, keeping background polling active even when the tab is hidden. Pass the `isActive` state to disable polling when inactive.
4. **Cache Inline Props & Callbacks**:
   - In `page.tsx`, inline props/callbacks are recreated every render, invalidating child memoization. Cache them using `useCallback` or `useMemo`.
5. **Optimize getCategoryStats to $O(1)$**:
   - In `src/hooks/useBudget.ts`, `uniqueCategories.find` runs in $O(N)$ inside a render loop. Replace it with a direct lookup on the pre-calculated `categoryStatsMap`.
6. **Lazy Render Collapsed Panels**:
   - In `src/components/budget/ui/PolicyGroupCard.tsx`, collapsed cards are hidden via CSS `max-h-0`. This leaves thousands of DOM nodes mounted.
   - **Optimization**: Implement lazy conditional rendering `{isOpen && ...}` to decrease the initial DOM element count significantly.
7. **Pause 3D Physics Loop When Idle**:
   - In `src/components/MindMap3D.tsx`, `requestAnimationFrame(loop)` runs constantly at 60 FPS even when physics is idle.
   - **Optimization**: Cancel the animation frame when physics sleeps, and resume it on user interaction.
