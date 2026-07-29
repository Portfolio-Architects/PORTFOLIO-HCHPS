# R1 Exploration Analysis: Local Data Hydration & Instant UI Feedback

## Executive Summary
This analysis evaluates data fetching, caching, and mutation logic across `useTasks`, `useBudget`, `useInventory`, and `useContacts`, as well as disk I/O operations in `/api/data` and `sheets-api.ts`. While `useTasks` and `useBudget` leverage React Query optimistic updates, artificial delays (300ms queue delays in `useBudget`), immediate query invalidations (`onSettled`), and architectural divergence in `useInventory`/`useContacts` (custom state without rollback) create latency bottlenecks and cold-start loading flickers.

---

## 1. Analysis of Target Hooks

### A. `src/hooks/useTasks.ts`
- **Data Engine**: TanStack React Query (`useQuery`, `useMutation`).
- **Hydration & Caching**:
  - `queryKey: ['TASKS']`, `staleTime: 5 min`, `refetchOnWindowFocus: false`.
  - **Cold Start Deficit**: Lacks initial fallback hydration from `localStorage` on mount. Shows loading state/empty UI until `readSheet` resolves.
- **Mutation & Optimistic Updates**:
  - `addTaskMut`, `updateTaskMut`, `deleteTaskMut` implement `onMutate` (cancels queries, snapshots previous state, optimistically updates cache), `onError` (reverts to snapshot), and `onSettled`.
- **Latency & Overhead**:
  - `onSettled: () => queryClient.invalidateQueries({ queryKey: ['TASKS'] })` fires an immediate `GET /api/data?sheet=TASKS` fetch over HTTP upon every single mutation.
  - `updateTask` contains serialized async logic (`await addTaskMut.mutateAsync(nextTask)`) for recurring task auto-duplication before running `updateTaskMut`, creating a sequential blocking chain.

### B. `src/hooks/useBudget.ts`
- **Data Engine**: TanStack React Query (`useQuery`, `useMutation`) for `BUDGET_CATEGORIES` and `BUDGET_ENTRIES`.
- **Hydration & Caching**:
  - Dual queries (`['BUDGET_CATEGORIES']` & `['BUDGET_ENTRIES']`), `staleTime: 5 min`.
  - **Cold Start Deficit**: No initial sync with `localStorage` before query resolution.
- **Mutation & Optimistic Updates**:
  - `addCategoryMut`, `updateCategoryMut`, `deleteCategoryMut`, `addEntryMut`, `updateEntryMut`, `deleteEntryMut` implement `onMutate`, `onError`, `onSettled`.
- **Critical Latency Bottlenecks**:
  1. **Artificial 300ms Queue Delay (`enqueueKvWrite`)**:
     - Lines 21–31 wrap `updateCategoryMut` and `updateEntryMut` in `enqueueKvWrite`, which hardcodes `setTimeout(() => resolve(res), 300)`.
     - This artificially delays mutation resolution by 300ms on EVERY category or entry update.
  2. **Double Mutation Settle Cascades**:
     - `deleteCategory` invokes `deleteCategoryMut.mutate(id)` AND `replaceEntriesMut.mutate(remainingEntries)`, causing double network HTTP POST calls and double query invalidations.

### C. `src/hooks/useInventory.ts`
- **Data Engine**: Custom `useGoogleSheet` hook (`useState` + `useEffect`). Does NOT use React Query.
- **Hydration & Caching**:
  - **Hydration**: Reads `localStorage` (`hchps-inventory`, `hchps-stock-changes`) synchronously on mount (0ms cold start, no loading flicker).
  - Afterwards calls `readSheet<InventoryItem>('INVENTORY')` in `useEffect`.
- **Mutation & Optimistic Updates**:
  - Uses `setItems` / `setStockChanges` functional updates for instant local UI reflection.
  - Passes async operations to `itemCrud` / `scCrud` (`syncAdd`, `syncUpdate`, `syncDelete`).
- **Deficits**:
  - **No Error Rollback**: `syncAdd`, `syncUpdate`, `syncDelete` are unhandled fire-and-forget promises. If the network or disk save fails, local React state and `localStorage` remain mutated without rollback.
  - **Isolated State**: Changes made in one component using `useInventory` do not automatically synchronize with other components unless re-mounted.

### D. `src/hooks/useContacts.ts`
- **Data Engine**: Custom `useGoogleSheet` hook (`useState` + `useEffect`).
- **Hydration & Caching**:
  - Hydrates from `localStorage` (`hchps-contacts`) immediately on mount.
  - Automatically seeds 17 initial contacts via `replaceAll('CONTACTS', seeded)` if empty.
- **Mutation & Optimistic Updates**:
  - Local `setContacts` updates UI instantly.
  - Asynchronous `syncAdd`, `syncUpdate`, `syncDelete` sent to backend.
- **Deficits**:
  - **No Error Rollback**: Lacks error boundaries/revert logic on write failures.
  - **Architectural Disconnect**: Does not share cache with React Query.

---

## 2. Target Hooks Comparison Matrix

| Hook Name | Data Engine | Initial Hydration | Optimistic Update (`onMutate`) | Error Rollback (`onError`) | Settled Action (`onSettled`) | Latency Issues Identified |
|---|---|---|---|---|---|---|
| `useTasks` | React Query | Network first (No `localStorage`) | ✅ Full | ✅ Reverts snapshot | `invalidateQueries` (Network GET) | Network refetch on settle; serialized recurring task duplication |
| `useBudget` | React Query | Network first (No `localStorage`) | ✅ Full | ✅ Reverts snapshot | `invalidateQueries` (Network GET) | **300ms artificial delay in `enqueueKvWrite`**; double mutation on deleteCategory |
| `useInventory` | Custom `useState` | LocalStorage first (0ms) | ✅ Local state | ❌ Missing | None | No rollback on failure; state non-centralized |
| `useContacts` | Custom `useState` | LocalStorage first (0ms) | ✅ Local state | ❌ Missing | None | No rollback on failure; state non-centralized |

---

## 3. Backend Disk I/O & API Latency Analysis

### A. `src/app/api/data/route.ts`
1. **Writing Flow (`writeDataToFile`)**:
   - Validates data payload with Zod schema gatekeeper.
   - Writes to a unique `.tmp` file (`safeWriteFile`) and renames it to `.json` (prevents Windows file lock collisions).
   - Deletes `apiCache` entry for the sheet (`apiCache.delete(sheet)`).
   - Triggers `backupDataFile` asynchronously in the background (`.catch(...)`). Disk backups (Son/Father/Grandfather) do NOT block HTTP response.
2. **Reading Flow (`readData`)**:
   - Checks `apiCache` using `mtimeMs`.
   - If `apiCache` misses or was invalidated by write, performs `fs.readFile` and `JSON.parse`.
3. **Bottleneck in POST Handler**:
   - When a POST write occurs, `apiCache.delete(sheet)` forces the next GET or POST request to read from disk (`fs.readFile`).
   - If `apiCache` was updated in-memory directly instead of deleted, disk reads on subsequent writes would be avoided.

### B. `src/lib/sheets-api.ts`
1. **`readSheet` Client Cache**:
   - Implements `clientCache` with a 5-minute guard (`lastMetaCheck`).
   - Uses HTTP conditional check (`clientMtime` & `clientSize`). Returns `notModified: true` when unchanged.
2. **`writeData` Cache Update**:
   - `writeData` ALREADY updates local `clientCache` in-memory upon successful POST (`action === 'add' / 'update' / 'delete' / 'replace'`).
   - Therefore, the client ALREADY has the correct, updated data in memory after a mutation succeeds!
   - Calling `invalidateQueries` in React Query `onSettled` forces an unnecessary HTTP request even though `clientCache` and React Query cache are already accurate.

---

## 4. Concrete Recommendations for 0ms Optimistic UI Updates

### Recommendation 1: Unified React Query Architecture with Instant LocalStorage Hydration
Unify all 4 hooks under TanStack React Query (`useTasks`, `useBudget`, `useInventory`, `useContacts`) and equip all queries with `initialData` loaded synchronously from `localStorage`:

```ts
// Example for useTasks, useBudget, useInventory, useContacts
const { data = [] } = useQuery({
  queryKey: ['INVENTORY'],
  queryFn: () => readSheet<InventoryItem>('INVENTORY'),
  initialData: () => {
    if (typeof window === 'undefined') return undefined;
    try {
      const stored = localStorage.getItem('hchps-fallback-INVENTORY');
      return stored ? JSON.parse(stored) : undefined;
    } catch { return undefined; }
  },
  staleTime: 1000 * 60 * 5,
  refetchOnWindowFocus: false,
});
```
- **Outcome**: 0ms cold-start hydration across all tabs; zero loading spinners on mount.

### Recommendation 2: Eliminate Artificial Delays in `useBudget.ts`
Remove `enqueueKvWrite` and its hardcoded 300ms `setTimeout` delay from `useBudget.ts`. Allow `updateRow` to resolve natively:

```ts
// REMOVE 300ms artificial delay loop:
// const enqueueKvWrite = ...
// REPLACE updateCategoryMut / updateEntryMut mutationFn directly with updateRow:
mutationFn: ({ id, updates }) => updateRow('BUDGET_CATEGORIES', id, updates)
```

### Recommendation 3: Smart Mutation Settlement without Network Refetch
Replace `onSettled: () => queryClient.invalidateQueries(...)` with direct cache verification:
- `onMutate`: Optimistically update React Query cache and return context snapshot.
- `onSuccess`: Confirm cache data or update with server-returned metadata.
- `onError`: Revert to context snapshot (`queryClient.setQueryData(key, context.previousData)`).
- `onSettled`: Do NOT invalidate queries unless an explicit error occurred or manual refresh is triggered.

### Recommendation 4: Optimize API Route Server Cache (`/api/data/route.ts`)
Instead of `apiCache.delete(sheet)` in `writeDataToFile`, update `apiCache` directly with the newly written `rows` array and updated `mtimeMs`:

```ts
// In writeDataToFile:
apiCache.set(sheet, { data, mtimeMs: Date.now() });
```
- **Outcome**: Prevents subsequent read operations from hitting disk I/O.

### Recommendation 5: Consolidate Cascading Mutations
In `useBudget.ts` `deleteCategory`, combine the category deletion and entry filtering into a single operation or run mutations concurrently without double invalidations.
