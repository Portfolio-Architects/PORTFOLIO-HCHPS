# Scope: Milestone 3 - Tab Switching UI Freeze Prevention and Rendering Optimization (R2)

## Architecture
- **View (UI)**:
  - `src/app/page.tsx`: Handles active tab states and module rendering.
  - `src/components/dashboard/PortfolioDashboardView.tsx`: Main dashboard view.
  - `src/components/WorkspaceView.tsx`: Workspace / budget view.
  - `src/components/dashboard/ContactsBox.tsx`: Contacts component running expensive list filters.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | memoization_opt | Wrap `PortfolioDashboardView`, `WorkspaceView`, and `ContactsBox` in `React.memo` | None | DONE |
| 2 | hooks_memoization | Optimize handlers and state dependencies inside views using `useCallback` and `useMemo` | memoization_opt | DONE |
| 3 | verification | Verify that `npm run build` and `npm run lint` succeed | hooks_memoization | DONE |

## Interface Contracts
- Prevent re-rendering of hidden tab views when `activeModule` switches in `ProtectedApp`.
- Ensure React.memo comparison functions accurately block updates if data has not changed.
