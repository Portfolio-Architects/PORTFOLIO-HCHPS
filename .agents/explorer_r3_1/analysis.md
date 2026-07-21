# Requirement 3 (R3) Technical Analysis Report: DB Polling & React Query Refetch Optimization

## Executive Summary
This report analyzes Requirement 3 (R3), focusing on eliminating redundant network requests, optimizing polling loops during tab switching, and establishing clean caching and debouncing defaults for React Query hooks. 

Key discoveries:
1. `useGraphCustomization.ts` runs a 10-second polling loop (`readSheet('MAP_CUSTOMIZATION')`) using global singletons. Currently, it fires an immediate fetch on mount even when `document.visibilityState === 'hidden'`, keeps interval timers alive while hidden (returning early inside ticks), and forces up to a 10-second delay before updating state when returning to the tab.
2. `src/lib/query-client.ts` sets `staleTime` to 5 minutes and `refetchOnWindowFocus` to `false`. However, hooks like `useTasks.ts` and `useBudget.ts` re-declare `staleTime`, while `useAppLogs.ts` polls every 10s without explicit `refetchIntervalInBackground: false`.
3. A comprehensive refactoring plan suspended polling when `!enabled || document.visibilityState === 'hidden'` and eliminates redundant background timer ticks and tab-switch refetches across the entire system.

---

## 1. Deep Dive: `useGraphCustomization.ts` Polling Loop (Objective 1)

### Line Inspection (Lines 64-65, 700-784)
- **Global singletons** (lines 64-65):
  ```ts
  let activePollInterval: ReturnType<typeof setInterval> | null = null;
  let activePollCount = 0;
  ```
- **Polling Effect** (lines 702-784):
  ```ts
  useEffect(() => {
    if (!enabled || !isCloudLoaded) return;

    activePollCount++;
    
    if (!activePollInterval) {
      console.info('[Watcher Poll] Starting global singleton polling loop.');

      const runPoll = async () => { ... };

      runPoll(); // ISSUE 1: Immediate fetch executed even if tab is hidden!
      activePollInterval = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          return; // ISSUE 2: Interval fires every 10s while hidden, burning background CPU cycles.
        }
        runPoll();
      }, 10000);
    }

    return () => {
      activePollCount--;
      if (activePollCount <= 0 && activePollInterval) {
        console.info('[Watcher Poll] Stopping global singleton polling loop.');
        clearInterval(activePollInterval);
        activePollInterval = null;
      }
    };
  }, [enabled, isCloudLoaded]);
  ```

### Identified Flaws & Behavior Analysis
1. **Hidden Mount Issue**: `runPoll()` is invoked unconditionally before `setInterval`. If the tab was loaded in the background or hidden immediately, an unwanted initial HTTP/KV request is made.
2. **Wasted Background Timers**: Setting a recurring `setInterval(..., 10000)` while hidden continues waking up JavaScript timers every 10 seconds.
3. **Latency Upon Tab Re-activation**: When the user switches back to the tab (`visibilityState` changes to `'visible'`), polling does NOT run immediately. The user must wait between 0 to 10 seconds for the next interval tick to occur.
4. **Lack of Central Visibility Event Listener**: There is no window `visibilitychange` listener controlling timer creation and destruction.

### Proposed Solution for `useGraphCustomization.ts`
Implement a visibility-aware interval management pattern:
- When tab is `'hidden'` OR `activePollCount <= 0` OR `!enabled`: `stopPolling()` completely destroys `activePollInterval`.
- When tab transitions to `'visible'` AND `activePollCount > 0`: `startPolling()` triggers `runPoll()` **immediately** and starts the 10-second `setInterval`.
- Register a global `visibilitychange` event listener while `activePollCount > 0`.

#### Proposed Code Structure for `useGraphCustomization.ts`:
```ts
// Global singletons
let activePollInterval: ReturnType<typeof setInterval> | null = null;
let activePollCount = 0;
let visibilityListenerAttached = false;

function stopPolling() {
  if (activePollInterval) {
    console.info('[Watcher Poll] Pausing/stopping global singleton polling loop.');
    clearInterval(activePollInterval);
    activePollInterval = null;
  }
}

function startPolling(runPollFn: () => void) {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  if (!activePollInterval) {
    console.info('[Watcher Poll] Starting/resuming global singleton polling loop.');
    runPollFn();
    activePollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        stopPolling();
        return;
      }
      runPollFn();
    }, 10000);
  }
}
```

---

## 2. Deep Dive: `QueryClient` Defaults & React Query Hooks (Objective 2)

### Inspection of `src/lib/query-client.ts`
```ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000,   // 30 minutes
      retry: (failureCount, error: unknown) => {
        const errStatus = (error as { status?: number })?.status;
        if (errStatus === 401 || errStatus === 403) return false;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false, // Prevents main thread block & background burst on focus
    },
    mutations: {
      retry: 1,
    }
  },
});
```

### Inspection of Existing Query Hooks
1. **`useTasks.ts`**:
   - `queryKey: ['TASKS']`, `staleTime: 1000 * 60 * 5`.
   - Uses optimistic updates for `addTaskMut`, `updateTaskMut`, `deleteTaskMut`.
   - Inherits `refetchOnWindowFocus: false` from global defaults.
2. **`useBudget.ts`**:
   - `queryKey: ['BUDGET_CATEGORIES']`, `queryKey: ['BUDGET_ENTRIES']`, `staleTime: 1000 * 60 * 5`.
   - Uses `enqueueKvWrite` queue to serialize writes.
   - Optimistic cache mutations via `onMutate`.
3. **`useAppLogs.ts`**:
   - `queryKey: ['app-logs']`, `refetchInterval: enabled ? 10000 : false`.
   - Needs explicit `refetchIntervalInBackground: false` to ensure background tabs do not poll app logs.
4. **`useClassificationWords.ts`**:
   - `staleTime: Infinity` — excellent for static word dictionary lookup.
5. **`useGoogleSheet.ts` (`useInventory`, `useContacts`, `useMeetings`, `useProjects`, `useSchedules`)**:
   - Custom `useState` + `useEffect` hook with `localStorage` hydration and Cloudflare KV sync.
   - Ensures data is only loaded from KV on mount (`initialLoadDone.current`), avoiding polling overhead.

---

## 3. Comprehensive Refetch & Polling Optimization Plan (Objective 3)

### Goal: Zero Redundant Requests During Tab Switching & Debounced/Cached Refetching

| Component / Hook | Problem | Formulated Solution |
| --- | --- | --- |
| `useGraphCustomization.ts` | Polling continues on hidden tabs; delay on tab focus | Suspend polling completely when hidden or disabled. Instantly trigger `runPoll()` when tab becomes visible. |
| `src/lib/query-client.ts` | Default options lack `refetchOnReconnect: false` and `refetchOnMount: false` | Add `refetchOnReconnect: false` to prevent network reconnect request bursts. |
| `useTasks.ts` & `useBudget.ts` | Manual duplication of `staleTime: 5 * 60 * 1000` | Rely on global `queryClient` default options. Set `refetchOnWindowFocus: false` (already active). Ensure mutations perform clean optimistic updates. |
| `useAppLogs.ts` | Log polling interval might fire in background | Add `refetchIntervalInBackground: false` to `useQuery`. |
| `useGoogleSheet.ts` | Potential duplicate loads if `crypto-ready` fires multiple times | Guard load attempts with strict boolean locks and tombstone checking. |

---

## 4. Verification Method

1. **Harness Integrity Check**:
   Run `node scripts/run-harness.js` to ensure ESLint, TypeScript compilation, and Zod schema validations pass without errors.
2. **Tab Switching & Polling Suspension Verification**:
   - Open browser developer tools Network tab and console.
   - Navigate to 3D MindMap / Dashboard.
   - Switch away to a different browser tab for 30 seconds.
   - Verify zero HTTP calls (`readSheet` or `/api/app-logs`) are initiated while hidden.
   - Switch back to the tab: verify `[Watcher Poll]` instantly resumes and fires 1 immediate poll.
