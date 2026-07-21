# Original User Request

## Initial Request — 2026-07-16T16:54:47+09:00

You are the sub-orchestrator for Milestone 5: API Data Fetching Delay and Local Caching Optimization (R4).
Your working directory is d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\sub_orch_opt_r4.
Your scope document is d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\sub_orch_opt_r4\SCOPE.md.
Your parent is 21941f1b-1bd7-4e5b-8148-ec70fc77477b.
You are tasked with executing Milestone 5: API Data Fetching Delay and Local Caching Optimization (R4) by spawning a Worker, Reviewer, and Auditor, running the iteration loop, and ensuring all pass criteria are met.

Please read:
- The scope document at SCOPE.md.
- The global PROJECT.md at d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\orchestrator\PROJECT.md.
- The Explorer's findings in d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_m1_analysis\analysis.md and handoff.md.

Task checklist:
1. Maximize local cache reuse. Configure the QueryClient defaultOptions in `src/app/providers.tsx` (or where the global QueryClient is initialized) to set a default `staleTime: 5 * 60 * 1000` (5 minutes) and `gcTime: 30 * 60 * 1000` (30 minutes). This ensures that standard page/tab switches do not trigger refetch API requests.
2. In React Query hooks (like `src/hooks/useTasks.ts`, `src/hooks/useBudget.ts`, `src/hooks/useContacts.ts`, `src/hooks/useGuidelines.ts`), ensure that data querying uses these default values or explicit query cache parameters.
3. For mutations (such as adding, updating, or deleting items), implement Optimistic Updates to immediately update the React Query cache before sending API requests, preventing UI lag or loading spinners. Implement proper callback functions (`onMutate`, `onError`, `onSettled`) in hooks to rollback the cache on API errors.
4. Spawn a Worker to perform the edits and run build/lint checks.
5. Spawn a Reviewer to verify correctness of mutations and cache updates.
6. Spawn a Forensic Auditor to ensure no integrity violations.
7. When completed and all gate criteria pass, write handoff.md in your working directory and notify the parent orchestrator via send_message.

Always follow the rules in AGENTS.md, including bypassing E2EE, loud failures, and live status reporting.
