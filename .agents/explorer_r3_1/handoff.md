# Handoff Report — DB Polling & React Query Refetch Optimization (Requirement 3)

## 1. Observation
Direct evidence gathered from codebase inspection:

- **`src/hooks/useGraphCustomization.ts` (lines 64-65, 702-784)**:
  - Global singletons:
    ```ts
    let activePollInterval: ReturnType<typeof setInterval> | null = null;
    let activePollCount = 0;
    ```
  - Polling setup:
    ```ts
    useEffect(() => {
      if (!enabled || !isCloudLoaded) return;
      activePollCount++;
      if (!activePollInterval) {
        ...
        runPoll(); // Direct execution on mount
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
          clearInterval(activePollInterval);
          activePollInterval = null;
        }
      };
    }, [enabled, isCloudLoaded]);
    ```
  - Observation: `runPoll()` runs immediately on mount regardless of tab visibility (`document.visibilityState === 'hidden'`). `setInterval` continues firing every 10 seconds while tab is hidden. When tab becomes visible, no immediate fetch is triggered.

- **`src/lib/query-client.ts` (lines 1-22)**:
  - Default options set `staleTime: 5 * 60 * 1000`, `gcTime: 30 * 60 * 1000`, and `refetchOnWindowFocus: false`.
  - Observation: `refetchOnWindowFocus: false` is active globally. However, `refetchOnReconnect` is not explicitly disabled.

- **`src/hooks/useTasks.ts` (lines 79-83) & `src/hooks/useBudget.ts` (lines 36-46)**:
  - `useTasks`: `staleTime: 1000 * 60 * 5` re-declared explicitly on `useQuery({ queryKey: ['TASKS'], queryFn: () => readSheet<Task>('TASKS') })`.
  - `useBudget`: `staleTime: 1000 * 60 * 5` re-declared explicitly for `BUDGET_CATEGORIES` and `BUDGET_ENTRIES`.

- **`src/hooks/useAppLogs.ts` (lines 19-30)**:
  - Configured with `refetchInterval: enabled ? 10000 : false`, but missing `refetchIntervalInBackground: false`.

- **`src/hooks/useInventory.ts` & `src/hooks/useGoogleSheet.ts`**:
  - `useInventory` wraps `useGoogleSheet` which hydrates once from `localStorage` and fetches from KV/`readSheet` on mount, caching back to `localStorage`.

---

## 2. Logic Chain
1. *Premise*: Continuous background polling on hidden browser tabs wastes system resources (CPU/battery) and generates unnecessary network requests. Delayed state updates when switching back to a tab degrade user experience.
2. *Step 1*: `useGraphCustomization.ts` currently runs `setInterval` every 10 seconds even when `document.visibilityState === 'hidden'`. Suspending the interval timer when `document.visibilityState === 'hidden'` or `!enabled` and immediately resuming via `visibilitychange` listener ensures 0 background timer ticks and 0 delay when returning to the tab.
3. *Step 2*: TanStack React Query in `src/lib/query-client.ts` already sets `refetchOnWindowFocus: false`, preventing auto-refetch during tab switching. Explicitly adding `refetchOnReconnect: false` prevents edge-case network reconnect storms.
4. *Step 3*: `useAppLogs.ts` needs `refetchIntervalInBackground: false` to align with the tab suspension strategy.
5. *Step 4*: `useTasks.ts` and `useBudget.ts` benefit from consistent 5-minute `staleTime` and optimistic updates during mutations, preventing redundant network requests after user actions.

---

## 3. Caveats
- **Multi-Tab Sync**: In local offline/E2EE mode, tab switching relies on Yjs CRDT and window focus events. Suspending polling while hidden relies on `visibilitychange` events, which are supported in all modern browsers.
- **App Logs Polling**: When `useAppLogs` tab is active, polling at 10s is desired for real-time daemon logs. When backgrounded, `refetchIntervalInBackground: false` pauses it, which is the expected behavior.

---

## 4. Conclusion
Requirement 3 optimization can be achieved cleanly with 3 targeted edits:
1. Refactor `useGraphCustomization.ts` polling loop to pause/clear `setInterval` when `document.visibilityState === 'hidden'` or `!enabled`, and attach a `visibilitychange` event listener to run `runPoll()` instantly on tab focus.
2. Update `src/lib/query-client.ts` to explicitly include `refetchOnReconnect: false`.
3. Update `useAppLogs.ts` to include `refetchIntervalInBackground: false`.

---

## 5. Verification Method

1. **Static Analysis & Type Checking**:
   - Run `node scripts/run-harness.js`
   - Target files: `src/hooks/useGraphCustomization.ts`, `src/lib/query-client.ts`, `src/hooks/useTasks.ts`, `src/hooks/useBudget.ts`, `src/hooks/useAppLogs.ts`.

2. **Runtime Tab Switching Verification**:
   - Open Chrome DevTools > Network tab.
   - Load MindMap dashboard (`useGraphCustomization` enabled).
   - Switch to another browser tab for 30 seconds.
   - Confirm 0 network calls for `MAP_CUSTOMIZATION` or `/api/app-logs` while hidden.
   - Switch back to dashboard tab: confirm 1 immediate network request occurs to sync watcher candidates.
