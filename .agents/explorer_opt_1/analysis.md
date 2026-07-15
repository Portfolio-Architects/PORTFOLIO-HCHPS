# Optimization Analysis Report

This report documents the exploration and diagnostics of performance bottleneck areas in the PORTFOLIO - VITAL application, categorized under R1 (Initial Loading), R2 (Data API Latency), and R3 (Tab Transitions).

---

## R1: Initial Dashboard Loading Performance Optimization

### 1. Synchronously Imported Conditional Components
* **Location:** `src/app/page.tsx:66`
* **Observation:** 
  ```typescript
  66: import { SecurityLockScreen } from '@/components/SecurityLockScreen';
  ```
  `SecurityLockScreen` is conditionally rendered based on the client state `isLocked` (line 605):
  ```typescript
  605:   if (isLocked) {
  606:     return (
  607:       <SecurityLockScreen 
  ...
  ```
  Even when the user has unlocked the app or disabled the PIN lock, this component is imported synchronously and bundled into the entry chunk.
* **Recommendation:** Load `SecurityLockScreen` dynamically using Next.js `dynamic()` with `{ ssr: false }` to reduce the initial JavaScript bundle size.

### 2. Immediate Dashboard Mounting During Splash Screen
* **Location:** `src/app/page.tsx:124-129` and `src/app/page.tsx:416-420`
* **Observation:**
  `visitedModules` initializes `dashboard` to `true` on load:
  ```typescript
  124:   const [visitedModules, setVisitedModules] = useState<Record<ModuleType, boolean>>({
  125:     dashboard: true,
  126:     mindmap: false,
  127:     workspace: false,
  128:     inventory: false,
  129:   });
  ```
  This causes `PortfolioDashboardView` (which contains Recharts, `WeeklyScheduler`, and `ContactsBox`) to mount and render immediately during the client initialization:
  ```typescript
  416:             {/* Dashboard */}
  417:             {visitedModules.dashboard && (
  418:               <div className={activeModule === 'dashboard' ? 'block' : 'hidden'}>
  419:                 <PortfolioDashboardView ... />
  ```
  Because Recharts is a heavy library (over 300KB) and rendering charts blocks the UI thread, this causes visible frame drops during the premium loading splash animation (which runs for 2.5s).
* **Recommendation:**
  Initialize `visitedModules.dashboard` to `false`. Inside `useEffect` on mount, stagger its initialization using `setTimeout` (e.g. after 500ms - 1000ms) or `requestIdleCallback`. This deferral allows the initial splash screen and layout shell to render smoothly without CPU contention, loading the heavy dashboard only when the initial thread load settles.

---

## R2: Data API Response Speed Optimization

### 1. Double HTTP Round-Trip Time (RTT) on Data Fetch
* **Location:** `src/lib/sheets-api.ts:58-94`
* **Observation:**
  To read a sheet, the client first performs a metadata check request:
  ```typescript
  58:       const metaRes = await fetch(`${API_BASE}?sheet=${encodeURIComponent(sheetName)}&meta=true&_t=${Date.now()}`, { ... });
  ```
  If the metadata check indicates that the file size or modification time (`mtime`) has changed, it executes a second HTTP request to load the full data:
  ```typescript
  81:     const res = await fetch(`${API_BASE}?sheet=${encodeURIComponent(sheetName)}&_t=${Date.now()}`, { ... });
  ```
  This creates 2 network round-trips for data loading. Additionally, on the server-side (`src/app/api/data/route.ts`), it triggers `fs.stat` twice and `fs.readFile` once.
* **Recommendation:**
  Pass the client's cached `mtime` and `size` directly as parameters or headers in the main `GET /api/data?sheet=...` request:
  `GET /api/data?sheet=XYZ&mtime=12345&size=6789`
  The backend route checks if the file matches these stats. If yes, it returns `304 Not Modified` or `{ success: true, notModified: true }`. If no, it returns the fresh data along with its metadata in a single response payload. This reduces RTT and server I/O calls by 50%.

### 2. Cache Invalidation and Post-Write Redundant Reads
* **Location:** `src/lib/sheets-api.ts:281-285`
* **Observation:**
  Write mutations (`addRow`, `updateRow`, `deleteRow`) call `writeData` on the API:
  ```typescript
  283:         clientCache.delete(sheetName);
  ```
  This completely deletes the client cache for the sheet. When React Query immediately triggers a query refetch after a mutation, it is forced to run a full RTT check and download the entire file again.
* **Recommendation:**
  Implement write-through caching. Since the backend `POST` response returns the updated file `mtime` and `size` (see `route.ts:555`):
  `return NextResponse.json({ success: true, mtime, size });`
  We can merge the mutation data locally on the client cache (`clientCache.set`) and update the cache metadata to match `mtime` and `size`. This makes subsequent query fetches hit the memory cache immediately, eliminating unnecessary download requests after writes.

### 3. Asynchronous Microtask Queue Bloat (E2EE Bypass Path)
* **Location:** `src/lib/sheets-api.ts:97-139` and `src/lib/crypto.ts:56-65`
* **Observation:**
  In `sheets-api.ts`, data rows are parsed sequentially using an async mapping:
  ```typescript
  97:     const decryptedPromises = json.data.map(async (row: Record<string, unknown>) => {
  98:       if (row._enc) {
  99:         try {
  100:           const dec = await decryptPayload(row._enc as string) as Record<string, any>;
  ```
  Because E2EE is bypassed for performance (meaning `_enc` contains plain-text JSON), `decryptPayload` is called on every row. Although it runs a fast-path synchronous `JSON.parse` (crypto.ts:60), the fact that it is an `async` function means a new Promise is allocated and queued on the microtask queue for **every single row** (e.g. 500 rows = 500+ Promises queued).
* **Recommendation:**
  Implement a synchronous bypass check in `decryptPayload`. If the string starts with `{` or `[`, parse it synchronously on the client side directly within `sheets-api.ts`, avoiding promise mapping and microtask allocation unless it is indeed a legacy legacy encrypted format.

---

## R3: Tab Transition and Interaction Responsiveness

### 1. Broken React.memo and Re-rendering Loop in MindMap3D
* **Location:** `src/components/MindMap3D.tsx:72`
* **Observation:**
  `MindMap3D` is wrapped in `React.memo` without passing its custom comparison function `areMindMap3DPropsEqual` (defined at line 43):
  ```typescript
  72: export const MindMap3D = React.memo(function MindMap3D({ signalKeywords, signalEntries, ... }) {
  ```
  React defaults to shallow prop reference checks. Since `signalKeywords` (`mergedKeywordMap`) and `signalEntries` (`mergedEntries`) are computed in `ProtectedApp` via the `useMergedSignals` hook, any global application state update (e.g. scroll offsets, timers, notifications) changes these references. This causes `MindMap3D` to fully re-render even if the actual content is unchanged.
* **Recommendation:**
  Pass the comparison function `areMindMap3DPropsEqual` as the second parameter to `React.memo` at line 72:
  ```typescript
  export const MindMap3D = React.memo(function MindMap3D(...) { ... }, areMindMap3DPropsEqual);
  ```

### 2. Tab Switch UI Freezes due to Lack of Memoization in Budget Views
* **Location:** `src/components/WorkspaceView.tsx:36` and `src/components/budget/BudgetDashboard.tsx:38`
* **Observation:**
  Neither `WorkspaceView` nor `BudgetDashboard` is wrapped in `React.memo`. When switching tabs, `activeModule` in `ProtectedApp` updates, prompting a re-render. Since `WorkspaceView` and `BudgetDashboard` are not memoized, they re-render.
  `BudgetDashboard` triggers `useBudgetFilters`, recalculating the filter logic and statistics tree:
  ```typescript
  67:     groupedByPolicy,
  68:     filteredStats
  69:   } = useBudgetFilters(categories, entries, getCategoryStats);
  ```
  Furthermore, `BudgetDashboard` defines inline callback handlers like:
  ```typescript
  70:   const handleSaveCategory = (isEdit: boolean, editCatId: string | null, updates: Partial<BudgetCategory>) => { ... }
  ```
  These inline functions are recreated on every render, changing their reference. As a result, the memoization of subcomponents like `PolicyGroupCard` is broken:
  ```typescript
  18: export const PolicyGroupCard = React.memo(({ ... }) => { ... })
  ```
  React compares the callback props, sees they have changed, and forces all `PolicyGroupCard` instances to re-render, compute stats, and rebuild their DOM elements, causing a transition delay of 100-300ms.
* **Recommendation:**
  1. Wrap `WorkspaceView` and `BudgetDashboard` in `React.memo`.
  2. Wrap inline callbacks inside `BudgetDashboard` (like `handleSaveCategory`, `handleSaveEntry`, `handleSettleEntry`, etc.) using `useCallback` to maintain stable reference identities.

### 3. Background Data Hook Subscriptions in MindMap3D
* **Location:** `src/components/MindMap3D.tsx:110-111`
* **Observation:**
  `MindMap3D` hooks directly into tasks and budget queries:
  ```typescript
  110:   const { tasks = [] } = useTasks();
  ```
  This couples `MindMap3D` to active data changes even when the tab is inactive (hidden via CSS). If tasks are modified in other tabs, the inactive `MindMap3D` is forced to re-run layout queries and trigger rendering computations in the background.
* **Recommendation:**
  Only subscribe to query streams or perform computations inside `MindMap3D` if `isActive` is `true`. Alternatively, lift these query bindings out to the parent view (`ProtectedApp`) and pass memoized selections down.
