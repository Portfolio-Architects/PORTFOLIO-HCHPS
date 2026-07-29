# Project: Localhost UX Optimization

## Architecture
- **Model (Storage)**: `src/app/api/data/route.ts` & local JSON files in `data/*.json`.
- **Controller (Hooks)**: `src/hooks/useTasks.ts`, `src/hooks/useBudget.ts`, `src/hooks/useInventory.ts`, `src/hooks/useContacts.ts`, `src/hooks/useLocalhostHealth.ts`.
- **View (UI)**: React 19 / Next.js app components (`src/components/dashboard/`, `src/components/layout/`, `src/components/modals/`).
- **HUD & Command Palette**: `LocalhostStatusHUD` widget in layout sticky header (`Sidebar.tsx`); `CommandPalette` modal for `Ctrl+K`/`Cmd+K`.
- **Verification Harness**: `scripts/run-harness.js`, `scripts/sync-rules.js`.

## Code Layout
- `src/hooks/`: Custom React Query hooks with optimistic UI updates and zero-stall status polling (`useTasks.ts`, `useBudget.ts`, `useInventory.ts`, `useContacts.ts`, `useLocalhostHealth.ts`).
- `src/components/layout/`: Top navigation/sidebar layout components including `LocalhostStatusHUD.tsx`.
- `src/components/modals/`: `CommandPalette.tsx` component.
- `src/app/api/data/route.ts` & `src/app/api/app-logs/route.ts`: Local data fetcher / I/O handling and API endpoints.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | R1_R2_R3_Exploration | Explore codebase structure for R1, R2, R3 requirements | None | DONE |
| 2 | R1_Optimistic_Updates | Implement optimistic updates across hooks (`useTasks`, `useBudget`, `useInventory`, `useContacts`), remove 300ms delays, update server `apiCache` directly | M1 | DONE |
| 3 | R2_Localhost_Status_HUD | Implement `useLocalhostHealth.ts` hook & `LocalhostStatusHUD.tsx` widget in top sticky header (`Sidebar.tsx`) showing Port 3001, Heap MB, Auto-Backups, File Watcher, and Offline Sync | M1 | DONE |
| 4 | R3_Command_Palette | Implement `CommandPalette.tsx` modal with `Ctrl+K`/`Cmd+K` global keyboard handler, instant module navigation & multi-category item search | M1 | DONE |
| 5 | R4_Verification_Integrity | Verify 0ms thread stall, 100% offline operation, MVC ontology adherence, run `scripts/run-harness.js` (0 tsc, 0 zod, 0 eslint errors) & `scripts/sync-rules.js` | M2, M3, M4 | DONE |

## Interface Contracts
- **React Query Hooks**:
  - `useTasks()`, `useBudget()`, `useInventory()`, `useContacts()` return mutation methods with instant optimistic UI updates (`onMutate`, `onError`, `onSettled` without refetch delays).
- **useLocalhostHealth**:
  - Returns real-time metrics: `{ port: 3001, heapUsedMb: number, backupCount: number, watcherActive: boolean, offlineSync: boolean }`.
- **LocalhostStatusHUD**:
  - Compact Badge Pill in sticky header (`Sidebar.tsx`) + Expanded High-Contrast Dark Theme HUD Modal.
- **CommandPalette**:
  - Global `Ctrl+K` / `Cmd+K` listener, instant multi-token search across modules and items, keyboard navigation (`ArrowUp`/`ArrowDown`/`Enter`/`Esc`), ARIA accessibility.
- **Verification Harness**:
  - `node scripts/run-harness.js`: Returns exit code 0 on clean verification.
  - `node scripts/sync-rules.js`: Synchronizes milestone log to `AGENTS.md`.
