## 2026-07-21T02:12:38Z
You are worker_opt_r3_gen1.
Your working directory is d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_opt_r3_gen1.

Your task is to implement Requirement 3 (R3): DB Polling & React Query Refetch Optimization.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Key Implementation Specifications:
1. `src/hooks/useGraphCustomization.ts`:
   - In the global polling loop / watcher effect (lines 700-784):
     - Ensure polling suspends completely when `!enabled` OR `document.visibilityState === 'hidden'`.
     - Register a `visibilitychange` listener on `document` within the polling effect:
       - When `document.visibilityState` transitions to `'visible'` and `enabled` is `true`, invoke `runPoll()` immediately (instant 0ms update) and reset/restart the 10-second polling interval timer.
       - Clean up the `visibilitychange` listener in effect cleanup.

2. `src/lib/query-client.ts`:
   - Ensure `defaultOptions.queries` includes:
     - `staleTime: 5 * 60 * 1000` (5 min)
     - `gcTime: 30 * 60 * 1000` (30 min)
     - `refetchOnWindowFocus: false`
     - `refetchOnReconnect: false`

3. Query Hooks (`useTasks.ts`, `useBudget.ts`, `useAppLogs.ts`):
   - Verify query hooks use clean caching, optimistic mutations, and `refetchIntervalInBackground: false` for any polling queries (e.g. `useAppLogs.ts`).

4. Verification:
   - Run `npx tsc --noEmit` and `node scripts/run-harness.js` to ensure 0 type errors, 0 lint errors, 0 schema violations.
   - Update `PORTFOLIO VITAL - Engineering Report.md` and run `node scripts/sync-rules.js`.
   - Document changes in `handoff.md` and send a message back to parent with test results.
