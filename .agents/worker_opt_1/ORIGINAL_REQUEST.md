## 2026-07-15T02:14:30Z

You are a teamwork_preview_worker. Your working directory is d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_opt_1.
Your mission is to implement all optimization proposals for initial loading (R1), API speed (R2), and tab transition/interaction responsiveness (R3), and verify that all tests and harnesses pass.

Here are the specific implementation details:

1. **src/app/page.tsx**:
   - Convert `SecurityLockScreen` to a dynamic import with `ssr: false` and `loading: () => null`.
   - In `preloadModulesOnIdle`'s `triggerPreload`, instead of setting `visitedModules` to `true`, trigger the dynamic imports directly in the background:
     ```typescript
     if (module === 'mindmap') import('@/components/MindMap3D');
     else if (module === 'workspace') import('@/components/WorkspaceView');
     else if (module === 'inventory') import('@/components/inventory/InventoryList');
     ```
   - In `handleModuleChange` and `handleOpenWiki` (and any other place where the active module transitions), set the visited module to `true` (e.g. `setVisitedModules(prev => prev[module] ? prev : { ...prev, [module]: true })`).
   - Memoize functions/callbacks passed to child components. Wrap them in `useCallback` or `useMemo` where they are inline inside rendering.

2. **src/app/api/data/route.ts**:
   - In the GET method, read `clientMtime` and `clientSize` query parameters (as numbers).
   - Fetch the stats of the sheet file using `await fs.stat(filePath)`.
   - If `clientMtime` and `clientSize` match the file's stats (`stats.mtimeMs` and `stats.size`), return a JSON block `{ success: true, notModified: true, mtime: stats.mtimeMs, size: stats.size }`.
   - Otherwise, fetch the data and return it along with `mtime: stats.mtimeMs` and `size: stats.size` in the JSON response: `{ success: true, data, mtime: stats.mtimeMs, size: stats.size }`.

3. **src/lib/sheets-api.ts**:
   - In `readSheet`, send `clientMtime` and `clientSize` query parameters in the fetch URL if `cached` exists:
     ```typescript
     let url = `${API_BASE}?sheet=${encodeURIComponent(sheetName)}&_t=${Date.now()}`;
     if (cached && cached.mtime && cached.size) {
       url += `&clientMtime=${cached.mtime}&clientSize=${cached.size}`;
     }
     ```
   - If the API returns `notModified: true`, update `cached.lastMetaCheck = Date.now()` and return the cached data immediately.
   - If E2EE bypass is active (e.g., E2EE plain text mode), parse rows synchronously, bypassing the `async/Promise.all` decryption mapping.
   - Update `clientCache.set` when new data is returned using the server's `mtime` and `size`.
   - In `writeData`, instead of calling `clientCache.delete`, implement a write-through cache by updating the cache in-place (updating `cached.data` and metadata `mtime` and `size` returned by the server) to avoid refetches.
   - Wrap `localStorage.setItem` for fallback in `setTimeout` to run it asynchronously.

4. **src/components/MindMap3D.tsx**:
   - Export the component with `areMindMap3DPropsEqual` memo comparator passed to `React.memo`:
     `export const MindMap3D = React.memo(function MindMap3D(...) { ... }, areMindMap3DPropsEqual);`
   - Remove top-level subscriptions to `useTasks` and `useBudget`.
   - Remove props `matchedCat`, `catStats`, `matchedTasks` from `MindMap3D` rendering `MindMapInspector`.
   - Pass `isActive` to `useGraphCustomization`: `useGraphCustomization(isActive)`.
   - Implement idle physics loop sleep: pause/cancel animation frame `requestAnimationFrame` when the layout settles (physics is not dirty), and resume it on interaction events (mouse, touch, wheel, drag, zoom).

5. **src/components/MindMapInspector.tsx**:
   - Import `useTasks` from `@/hooks/useTasks` and `useBudget` from `@/hooks/useBudget`.
   - Declare `useTasks` and `useBudget` inside `MindMapInspector`.
   - Calculate `matchedCat`, `catStats`, and `matchedTasks` using `useMemo` inside `MindMapInspector` (based on the same logic previously in `MindMap3D`).
   - Remove `matchedCat`, `catStats`, `matchedTasks` from `MindMapInspectorProps` and from the props destructured at the top of the component.

6. **src/hooks/useBudget.ts**:
   - Optimize `getCategoryStats` by looking up the total budget directly from the cached category stats:
     ```typescript
     const remaining = cached.totalBudget - cached.spent - cached.locked; 
     const usageRate = cached.totalBudget > 0 ? (cached.spent / cached.totalBudget) * 100 : 0;
     ```
     This completely removes the `uniqueCategories.find` array lookup.

7. **src/components/budget/ui/PolicyGroupCard.tsx**:
   - Implement lazy conditional rendering for collapsed policy groups: `{ (hidePolicyHeader || isOpen) && groupedByDetail.map(...) }` so children are not mounted when closed.
   - Implement lazy conditional rendering for category details: `{ expandedCats[cat.id] && ( ... ) }` so category details are not mounted when collapsed.

8. **Verification**:
   - Run the static analysis harness: `node scripts/run-harness.js` and verify it reports 0 warnings, 0 violations, and 0 bottlenecks.
   - Run the compiler build: `npm run build` and ensure Next.js build compiles successfully.
   - Update `PORTFOLIO VITAL - Engineering Report.md` and run `node scripts/sync-rules.js` to update `AGENTS.md`.
