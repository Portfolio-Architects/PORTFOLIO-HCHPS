# Requirement 3 (R3) Analysis Report: DB Polling & React Query Refetch Optimization

## Executive Summary
This report provides a comprehensive analysis of Requirement 3 (R3), focusing on database polling loops, React Query cache strategies, debounced invalidations, visibility checks, and side-effect safety across the PORTFOLIO - VITAL codebase.

The verification harness (`node scripts/run-harness.js`) was executed and passed cleanly with **0 TypeScript errors, 0 ESLint warnings, and 0 Zod schema validation errors**.

---

## 1. Inventory of Polling Loops & Data Fetching Hooks

| Hook / Component | Resource / Purpose | Mechanism | Polling / Refetch Interval | Cache Strategy (`staleTime`) | Visibility & Gating |
|---|---|---|---|---|---|
| `useGraphCustomization.ts` | `MAP_CUSTOMIZATION` | Global Singleton `setInterval` | 10,000ms (10s) | Yjs CRDT + `useSyncExternalStore` | `document.visibilityState !== 'hidden'` & `enabled === true` |
| `useTasks.ts` | `TASKS` | React Query (`useQuery` / `useMutation`) | On mutation settlement | 5 minutes (`1000 * 60 * 5`) | `refetchOnWindowFocus: false` |
| `useBudget.ts` | `BUDGET_CATEGORIES`, `BUDGET_ENTRIES` | React Query (`useQuery` / `useMutation`) | On mutation settlement | 5 minutes (`1000 * 60 * 5`) | `refetchOnWindowFocus: false` + `enqueueKvWrite` queue |
| `useInventory.ts` | `INVENTORY`, `STOCK_CHANGES` | `useGoogleSheet` + `useSheetCrud` | On mount + mutation sync | Local cache + Disk API | `cryptoReady` event gated |
| `useGoogleSheet.ts` | Custom disk/KV storage engine | `readSheet` / `addRow` / `updateRow` / `deleteRow` | Initial load + event trigger | `localStorage` fallback + tombstone filter | Gated by `isCryptoReady()` |
| `useAppLogs.ts` | Execution Logs (`/api/app-logs`) | React Query (`useQuery`) | 10,000ms (when `enabled`) | Default query client | Gated by `enabled` (log viewer open) |
| `useClassificationWords.ts` | `CLASSIFICATION_WORDS` | React Query (`useQuery`) | No periodic refetch | `Infinity` | Gated by `isActive && cryptoReady` |
| `useNotificationAlerts.ts` | Schedule alerts notification | Local `setInterval` | 60,000ms (1m) | Local state | Gated by `enabled && permission === 'granted'` |
| `MindMap3D.tsx` | FPS & performance profiler HUD | Local `setInterval` | 1,000ms (1s) | React local state | Gated by `isActive === true` |
| `queryClient.ts` | Global Query Client defaults | TanStack Query | No focus refetch | 5 minutes default (`staleTime`), 30m (`gcTime`) | `refetchOnWindowFocus: false` |

---

## 2. Detailed Verification of `useGraphCustomization.ts`

### Objective Check:
Verify that `setInterval` for `MAP_CUSTOMIZATION` polling checks `document.visibilityState !== 'hidden'` and `enabled === true`.

### Code Evidence:
- **Location**: `src/hooks/useGraphCustomization.ts:702-784`
- **Gating on `enabled` and `isCloudLoaded`**:
  ```ts
  useEffect(() => {
    if (!enabled || !isCloudLoaded) return;
    activePollCount++;
    ...
  ```
- **Visibility check inside interval callback**:
  ```ts
  activePollInterval = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    runPoll();
  }, 10000);
  ```
- **Cleanup and Reference Counting**:
  - `activePollCount` ensures multiple consumers of `useGraphCustomization` share a single global timer.
  - On unmount or when `enabled` becomes `false`, `activePollCount` decrements, clearing `activePollInterval` when count reaches `0`.
- **Phase 3 Batching Optimization**:
  - Store updates use `useSyncExternalStore` combined with a 16ms (60 FPS frame boundary) debounce/batching window (`setTimeout(..., 16)`), preventing CPU overload and unnecessary React render cycles during rapid Yjs CRDT events.

---

## 3. Detailed Verification of `useTasks`, `useBudget`, `useInventory`, and `useGoogleSheet`

### A. `useTasks.ts` (`src/hooks/useTasks.ts`)
1. **Caching (`staleTime`)**:
   - Explicitly configured with `staleTime: 1000 * 60 * 5` (5 minutes).
2. **Mutation & Invalidation**:
   - `addTaskMut`, `updateTaskMut`, and `deleteTaskMut` implement optimistic UI updates (`onMutate` with `cancelQueries`).
   - Rollbacks on mutation failure (`onError`).
   - Clean invalidation on completion via `onSettled: () => queryClient.invalidateQueries({ queryKey: ['TASKS'] })`.
3. **Concurrency Control**:
   - Serialized recurring task duplication (`await addTaskMut.mutateAsync(nextTask)`) prevents race conditions and duplicate entries.

### B. `useBudget.ts` (`src/hooks/useBudget.ts`)
1. **Caching (`staleTime`)**:
   - `BUDGET_CATEGORIES`: `staleTime: 1000 * 60 * 5`.
   - `BUDGET_ENTRIES`: `staleTime: 1000 * 60 * 5`.
2. **File Lock Contention Defense**:
   - Implements `enqueueKvWrite` queue with a 300ms delay between write operations to serialize disk access and avoid disk file-lock contention.
3. **Performance Optimization**:
   - Category stats are pre-calculated in a single `useMemo` map (`categoryStatsMap`) in $O(N + M)$ time instead of repeating $O(N \times M)$ scans during limit checks.

### C. `useInventory.ts` (`src/hooks/useInventory.ts`) & `useGoogleSheet.ts` (`src/hooks/useGoogleSheet.ts`)
1. **Caching & Hydration**:
   - Immediate `localStorage` hydration prevents SSR hydration mismatch.
   - Background fetch (`readSheet`) updates state and syncs to `localStorage` cache.
2. **Zombie Data Protection (Tombstones)**:
   - Uses `hchps-global-tombstones` array to filter out deleted IDs on initial load, preventing deleted records from resurrecting across multi-tab or offline restarts.
3. **Optimistic Updates**:
   - Local state updates immediately, while background asynchronous sync helpers (`syncAdd`, `syncUpdate`, `syncDelete`) persist changes to disk.

---

## 4. TypeScript & Side-Effect Safety Audit

1. **TypeScript Cleanliness**:
   - Harness test (`node scripts/run-harness.js`) executed `npx tsc --noEmit` and passed with **0 errors**.
2. **Side-Effect Safety**:
   - All `setInterval`, `setTimeout`, and event listeners have clean tear-down handlers inside `useEffect` cleanup callbacks.
   - `refetchOnWindowFocus: false` is configured globally in `queryClient.ts`, stopping tab-switch refetch storms.
   - Zero unhandled side effects or uncontrolled background timers.

---

## 5. Conclusion & Recommendations

Requirement 3 (R3) is fully satisfied and compliant with project standards:
- **DB Polling & Visibility**: `useGraphCustomization.ts` properly gates polling on `document.visibilityState !== 'hidden'` and `enabled === true`.
- **React Query & Caching**: Clean 5-minute `staleTime`, debounced invalidations on settlement, and zero redundant refetches.
- **Data Integrity**: Tombstone prevention against zombie data, serialized write queues against file locking.
- **Code Quality**: Passes TypeScript, ESLint, and Zod harness checks with zero errors.
