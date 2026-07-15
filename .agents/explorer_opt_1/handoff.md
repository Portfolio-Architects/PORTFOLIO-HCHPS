# Handoff Report: Optimization Diagnostics (R1, R2, R3)

This report details the diagnostics and recommendations for initial dashboard loading performance (R1), Data API response speed (R2), and tab transition responsiveness (R3).

---

## 1. Observation

### R1: Initial Loading
* **SecurityLockScreen Static Import:**
  - File: `src/app/page.tsx:66`
  - Quote: `import { SecurityLockScreen } from '@/components/SecurityLockScreen';`
  - Context: Loaded statically despite being conditionally rendered (line 605) based on client-side state.
* **Immediate Dashboard Mounting:**
  - File: `src/app/page.tsx:125`
  - Quote: `dashboard: true,` (within `visitedModules` initial state).
  - Context: Mounts `PortfolioDashboardView` (with Recharts, WeeklyScheduler, and ContactsBox) immediately on initial page load, competing with the premium splash screen loading animation.

### R2: Data API Latency
* **Double RTT Fetch Request:**
  - File: `src/lib/sheets-api.ts:58-94`
  - Quotes:
    ```typescript
    58:       const metaRes = await fetch(`${API_BASE}?sheet=${encodeURIComponent(sheetName)}&meta=true&_t=${Date.now()}`, { ... });
    ...
    81:     const res = await fetch(`${API_BASE}?sheet=${encodeURIComponent(sheetName)}&_t=${Date.now()}`, { ... });
    ```
  - Context: The client makes two consecutive requests for a single read sheet operation (one metadata check, followed by the actual data request).
* **Destructive Cache Clears on Mutation:**
  - File: `src/lib/sheets-api.ts:283`
  - Quote: `clientCache.delete(sheetName);`
  - Context: Modifying data (`add`, `update`, `delete`) invalidates the entire client cache, triggering full download RTTs on post-write refetches.
* **Async Loop overhead in Plain Text Bypass Mode:**
  - File: `src/lib/sheets-api.ts:97-100` and `src/lib/crypto.ts:56-65`
  - Quote: `const decryptedPromises = json.data.map(async (row) => { ... await decryptPayload(...) })`
  - Context: Each row creates an async microtask promise wrapper even though E2EE is bypassed and plain JSON is parsed synchronously.

### R3: Tab Transitions
* **MindMap3D React.memo Missing Comparator:**
  - File: `src/components/MindMap3D.tsx:72`
  - Quote: `export const MindMap3D = React.memo(function MindMap3D(...)`
  - Context: The comparison function `areMindMap3DPropsEqual` (defined at line 43) is never passed as the second argument to `React.memo()`. Shallow reference checks fail on the recreated props `signalKeywords` and `signalEntries`, triggering redundant canvas re-renders on parent updates.
* **Lack of Memoization in Budget Views:**
  - Files: `src/components/WorkspaceView.tsx:36` and `src/components/budget/BudgetDashboard.tsx:38`
  - Quote: `export function WorkspaceView(...)` and `export function BudgetDashboard(...)`
  - Context: Neither component is wrapped in `React.memo`. Inline callback handlers inside `BudgetDashboard` are recreated on every render, invalidating the memoization of subcomponents like `PolicyGroupCard` and forcing full DOM reconstructions on tab transitions.
* **Direct Background Hook Subscriptions:**
  - File: `src/components/MindMap3D.tsx:110-111`
  - Quote: `const { tasks = [] } = useTasks();`
  - Context: Inactive components hidden by CSS remain subscribed to active data hooks, forcing them to re-render in the background.

---

## 2. Logic Chain

### R1: Initial Loading
1. **SecurityLockScreen Static Import:** The static import loads the bundle code immediately on the main thread, increasing the initial script footprint even when the app is unlocked.
2. **Immediate Dashboard Mounting:** Because `visitedModules.dashboard` is `true`, `PortfolioDashboardView` starts mounting immediately on page load. The heavy script parsing (Recharts) and canvas initialization occur concurrently with the splash animation, causing CPU contention and drop frames.

### R2: Data API Latency
1. **Double RTT Fetch:** Checking metadata separately from data forces the browser to run two sequential HTTP requests. The local server is forced to run duplicate `fs.stat` queries on the disk, slowing down the read RTT.
2. **Destructive Cache Clears:** Erasing the client cache on write mutations forces React Query to do a full download check. Since the API returns the updated file metadata anyway, invalidating the cache is redundant.
3. **Async Loop Overhead:** Mapping `Promise.all` over hundreds of bypassed rows queues hundreds of useless microtask promises, adding execution delay.

### R3: Tab Transitions
1. **Broken MindMap3D Memo:** Since `React.memo` defaults to shallow checks, and the parent `useMergedSignals` returns new object references when any global state changes, `MindMap3D` re-renders constantly.
2. **Unmemoized Budget Views:** Tab switching toggles CSS classes (`block` / `hidden`) but still triggers a React reconciliation pass. Because `WorkspaceView` and `BudgetDashboard` are not memoized, they re-evaluate the full filter logic and lists. Recreated inline callback functions change references, forcing all memoized child `PolicyGroupCard`s to reconstruct their DOM, causing the freeze.
3. **Background Subscriptions:** Background query subscriptions force hidden components to evaluate updates in the background, consuming CPU resources.

---

## 3. Caveats

* **Static Analysis Scope:** Analysis was performed using static code investigation. Precise frame-rate (FPS) profiling and HTTP trace timings must be verified directly in the browser's developer tools under simulated CPU/network throttling.
* **Legacy Encrypted Payload Compatibility:** When optimizing the async loop in `decryptPayload`, we must verify that backward compatibility with legacy AES-GCM encrypted data remains intact for users who have not migrated to the plain-text bypass route.

---

## 4. Conclusion

The performance stutters in PORTFOLIO - VITAL stem from redundant script loading (R1), sequential client-server checks (R2), and React rendering cascades due to missing memoization and unstable props (R3). Implementing dynamic imports, single-RTT query parameter state validation, write-through cache persistence, and proper memoization gates will resolve these bottlenecks without changing the application's functionality.

---

## 5. Verification Method

### Test Verification
Run the TypeScript compiler and lint checks to ensure any proposed optimization complies with codebase standards:
* **Linting Check:** Run `npm run lint` or `npx eslint src/`
* **Type-Checking:** Run `npx tsc --noEmit`
* **Test Suite:** Run `npm run test`

### Inspection Verification
1. **R1 Bundle Inspection:** Check the generated chunks after a build (`npm run build`) to confirm that `SecurityLockScreen` is separated into a lazy-loaded chunk.
2. **R2 Network Inspection:** In browser DevTools, confirm that fetching data now takes exactly **1 HTTP request** instead of 2, and that mutations do not trigger a subsequent network query download.
3. **R3 React Profiler Inspection:** In the React DevTools Profiler, verify that:
   - Switching tabs to/from "예산관리" shows "Did not render" for memoized views.
   - Panning the MindMap 3D canvas does not trigger re-renders in `MindMapInspector` unless `activeNode.id` changes.
