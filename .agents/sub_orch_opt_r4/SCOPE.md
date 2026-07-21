# Scope: Milestone 5 - API Data Fetching Delay and Local Caching Optimization (R4)

## Architecture
- **Controller (Hooks)**:
  - `src/hooks/useTasks.ts`: Custom hook for fetching and modifying tasks.
  - `src/hooks/useBudget.ts`: Custom hook for fetching budget items.
  - `src/hooks/useContacts.ts`: Custom hook for fetching and modifying contacts.
  - `src/hooks/useGuidelines.ts`: Custom hook for fetching and modifying guidelines/inventory.
- **Model (Storage)**:
  - `src/app/api/data/route.ts` / local JSON storage.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | react_query_config | Update hooks to configure QueryClient defaultOptions or specific queries with `staleTime: 5 * 60 * 1000` (5 min) and `gcTime: 30 * 60 * 1000` (30 min) to maximize cache hits | None | PLANNED |
| 2 | optimistic_updates | Implement React Query optimistic updates for task/contact mutations to prevent UI lag | react_query_config | PLANNED |
| 3 | verification | Verify that all API cache modifications succeed and build succeeds | optimistic_updates | PLANNED |

## Interface Contracts
- React hooks under `src/hooks/` must use local query cache to prevent network fetches on component mount unless explicitly invalidated.
- All mutations must immediately update the local React Query cache optimistically, rolling back only on server failure.
