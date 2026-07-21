# BRIEFING — 2026-07-16T17:12:00+09:00

## Mission
Implement Requirement 4 (R4) to configure React Query and optimize useGoogleSheet/useSheetCrud with caching and optimistic updates.

## 🔒 My Identity
- Archetype: implementer/qa/specialist
- Roles: implementer, qa, specialist
- Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_opt_r4
- Original parent: 9efe1334-dd4c-4f67-9c69-706edf7a7129
- Milestone: API Data Fetching Delay and Local Caching Optimization

## 🔒 Key Constraints
- Keep exact export signatures of `useGoogleSheet` and `useSheetCrud` in `src/hooks/useGoogleSheet.ts`.
- Edit `src/lib/query-client.ts` for QueryClient defaultOptions: `staleTime: 5 * 60 * 1000`, `gcTime: 30 * 60 * 1000`.
- Optimistic updates in `useSheetCrud` mutations with proper callback rollbacks (`onMutate`, `onError`, `onSettled`).
- Validate that other React Query hooks like `useTasks.ts`, `useBudget.ts` align with the new cache configurations.
- Verify typescript/eslint/build.

## Current Parent
- Conversation ID: 9efe1334-dd4c-4f67-9c69-706edf7a7129
- Updated: 2026-07-16T17:11:04+09:00

## Task Summary
- **What to build**: React Query configuration and hooks refactor.
- **Success criteria**: Successful caching, state synchrony, optimistic updates, and clean compile/lint.
- **Interface contracts**: `src/hooks/useGoogleSheet.ts` signatures.
- **Code layout**: `src/hooks/`, `src/lib/query-client.ts`.

## Key Decisions Made
- [TBD]

## Artifact Index
- [TBD]

## Change Tracker
- **Files modified**: None yet
- **Build status**: Untested
- **Pending issues**: None

## Quality Status
- **Build/test result**: Untested
- **Lint status**: Untested
- **Tests added/modified**: None

## Loaded Skills
- None
