# Requirement 3 (R3) Analysis Report: DB Polling & React Query Refetch Optimization

## 1. Executive Summary

This report provides a thorough read-only analysis of **Requirement 3 (R3): DB Polling & React Query Refetch Optimization** across the VITAL codebase.

The primary goal of R3 is to ensure local PC performance is optimized by eliminating redundant database polling, disabling intrusive window-focus refetches, and maintaining clean memory caching strategies for local data operations.

---

## 2. Objective 1: `useGraphCustomization.ts` Polling Loop & Tab Visibility Audit

### Location
`src/hooks/useGraphCustomization.ts` (lines 63–66, 702–784)

### Technical Analysis
```typescript
// Singleton global state for watcher polling
let activePollInterval: ReturnType<typeof setInterval> | null = null;
let activePollCount = 0;

export function useGraphCustomization(enabled = true) {
  // ...
  useEffect(() => {
    if (!enabled || !isCloudLoaded) return;

    activePollCount++;
    
    if (!activePollInterval) {
      console.info('[Watcher Poll] Starting global singleton polling loop.');

      const runPoll = async () => { /* readSheet & pending buffer state update */ };

      runPoll();
      activePollInterval = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          return;
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
}
```

### Key Findings
1. **`enabled` Parameter Control**:
   - When `enabled === false`, `useEffect` returns immediately before incrementing `activePollCount` or starting `setInterval`.
   - When all mounted components using `useGraphCustomization` unmount or set `enabled = false`, `activePollCount` drops to `0`. The cleanup handler executes `clearInterval(activePollInterval)` and resets `activePollInterval = null`.
2. **`document.visibilityState === 'hidden'` Pause**:
   - Inside the 10,000 ms `setInterval` callback, the handler evaluates `if (document.visibilityState === 'hidden') return;`.
   - If the user minimizes the browser window or switches tabs, the polling tick returns immediately without executing `runPoll()`, avoiding disk/cloud reads (`readSheet`) or Yjs CRDT diffing operations while inactive.
3. **Singleton Pattern**:
   - Even if multiple components call `useGraphCustomization(true)`, only one global `setInterval` is created (`activePollInterval`), reference-counted by `activePollCount`.

---

## 3. Objective 2: `src/lib/query-client.ts` Configuration Audit

### Location
`src/lib/query-client.ts` (lines 1–21)

### Technical Analysis
```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000,   // 30 minutes garbage collection
      retry: (failureCount, error: unknown) => {
        const errStatus = (error as { status?: number })?.status;
        if (errStatus === 401 || errStatus === 403) return false;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false, // Prevents main thread block on window focus
    },
    mutations: {
      retry: 1,
    }
  },
});
```

### Key Findings
1. **`staleTime: 5 * 60 * 1000` (5 Minutes)**:
   - Data remains fresh in memory for 5 minutes. Sub-navigation between dashboard tabs within 5 minutes serves data directly from React Query cache without triggering disk or network IO.
2. **`gcTime: 30 * 60 * 1000` (30 Minutes)**:
   - Unused query data is retained in memory for 30 minutes before garbage collection.
3. **`refetchOnWindowFocus: false`**:
   - Explicitly disables automatic query refetching when the browser window regains focus. This prevents heavy UI lag, unexpected background re-renders, and disk contention on tab switches.
4. **Retry Strategy**:
   - Retries up to 2 times with exponential backoff (`1s`, `2s`, etc.) but immediately fails on auth errors (`401`/`403`).

---

## 4. Objective 3: React Query & Custom Hooks Audit

### A. React Query Hooks (`useQuery` / `useMutation`)

| Hook | Query Key(s) | `staleTime` | Optimistic Updates | Notes |
|---|---|---|---|---|
| `useTasks` (`src/hooks/useTasks.ts`) | `['TASKS']` | `5 min` (300,000 ms) | Yes (Add/Update/Delete) | Includes recurring task auto-duplication logic. |
| `useBudget` (`src/hooks/useBudget.ts`) | `['BUDGET_CATEGORIES']`, `['BUDGET_ENTRIES']` | `5 min` (300,000 ms) | Yes (Add/Update/Delete) | Uses `enqueueKvWrite` serialization queue for safe disk/KV persistence. |
| `useClassificationWords` (`src/hooks/useClassificationWords.ts`) | `['classification-words']` | `Infinity` | N/A | Cached indefinitely per session. |
| `useAppLogs` (`src/hooks/useAppLogs.ts`) | `['app-logs']` | Default (5 min) | N/A | Controlled polling: `refetchInterval: enabled ? 10000 : false`. |

### B. Custom Storage Hooks (`useGoogleSheet` / `useSheetCrud`)

Used by `useInventory`, `useProjects`, `useContacts`, `useSchedules`, `useMeetings`:
- **Hydration**: Reads synchronously from `localStorage` on initial mount to prevent SSR hydration mismatches.
- **Initial Fetch**: Performs a single background read from disk/KV (guarded by `initialLoadDone` ref).
- **Mutations**: Employs optimistic state updates + immediate local storage cache write + background disk/KV write via `useSheetCrud`.
- **No Unnecessary Polling**: Does not perform periodic interval fetching or refetching on window focus.

---

## 5. Synthesis & Recommendations

### Overall System Assessment
- **DB Polling & Refetch Efficiency**: **HIGH / OPTIMAL**.
  - `useGraphCustomization` singleton polling loop correctly stops when `enabled = false` and pauses execution when `document.visibilityState === 'hidden'`.
  - `queryClient` configuration (`refetchOnWindowFocus: false`, `staleTime: 5m`, `gcTime: 30m`) guarantees clean caching without rapid re-fetches when switching browser tabs.
  - Data hooks utilize optimistic UI updates and serialized background persistence.

### Minor Quality-of-Life Recommendation (Optional)
- In `useGraphCustomization.ts`, when returning from a hidden tab (`document.visibilityState` changes from `'hidden'` to `'visible'`), the hook currently waits up to 10 seconds for the next interval tick. An optional enhancement is adding a `visibilitychange` listener that triggers `runPoll()` immediately upon tab re-activation.
