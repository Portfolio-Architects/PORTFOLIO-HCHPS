## 2026-07-16T08:11:04Z

You are a teamwork worker.
Your working directory is d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_opt_r4.
Please create and update your progress.md periodically.

Your task is to implement Requirement 4 (R4): API Data Fetching Delay and Local Caching Optimization.

Task checklist:
1. Edit `src/lib/query-client.ts` to configure QueryClient defaultOptions:
   - `staleTime: 5 * 60 * 1000` (5 minutes)
   - `gcTime: 30 * 60 * 1000` (30 minutes)
   - Keep or set other configuration options.
2. Refactor `src/hooks/useGoogleSheet.ts` to use TanStack React Query (`useQuery` and `useMutation`) internally.
   - Maintain the exact same export signatures:
     - `useGoogleSheet<T extends { id: string }>(sheetName: string, localStorageKey: string, initialValue: T[] = [])` -> returns `[data, setData, loading]`
     - `useSheetCrud<T extends { id: string }>(sheetName: string)` -> returns `{ syncAdd, syncUpdate, syncDelete }`
   - Data querying should use `useQuery` under the hood with the global query cache settings or explicit ones.
   - For mutations (such as adding, updating, or deleting items), implement Optimistic Updates in `useSheetCrud` mutations to immediately update the React Query cache before sending API requests.
   - Implement proper callback functions (`onMutate`, `onError`, `onSettled`) in mutations to rollback the cache and localStorage on API errors.
3. Validate that other React Query hooks (like `src/hooks/useTasks.ts`, `src/hooks/useBudget.ts`) are aligned with the new cache configurations.
4. Execute `npm run lint` and `npm run build` to verify there are no TypeScript, ESLint, or Next.js build errors.
5. Write your handoff report at `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_opt_r4\handoff.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Always follow the rules in AGENTS.md, including bypassing E2EE, loud failures, and live status reporting.

## 2026-07-23T14:13:22Z

You are worker_opt_r4. Your task is to execute Milestone M4 (R4: Gatekeeper Verification & Sync Rules) for PORTFOLIO - VITAL.

Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_opt_r4\

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Context & Requirements:
1. Log all patches and milestone details into `PORTFOLIO VITAL - Engineering Report.md`.
2. Run `node scripts/sync-rules.js` to update `AGENTS.md` milestone log.
3. Run `npx tsc --noEmit` to verify 0 TypeScript compilation errors.
4. Run `node scripts/run-harness.js` to verify 0 Zod database schema errors, 0 ESLint warnings, 0 MVC violations, 0 architectural defects.
5. Create a detailed handoff report in `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_opt_r4\handoff.md` with verification outputs and manifest sync status.

Send a message back to parent when completed with your handoff path and summary.
