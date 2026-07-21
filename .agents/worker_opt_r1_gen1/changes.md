# Code Changes - Milestone 2 Optimization (R1)

## Files Modified
- `src/app/page.tsx`

## Details of Changes
1. **Splash Screen Timer Shortened**:
   - The outer `setTimeout` delay in the `useEffect` handling the initial splash screen initialization has been changed from `1800` to `1000` (shortening from 1.8s to 1s).
   - This reduces the artificial initial wait time, accelerating user access to the app's contents.

2. **High-Fidelity Loading Skeletons Added**:
   - Defined three loading skeleton components in `src/app/page.tsx`:
     - `PortfolioDashboardViewSkeleton`: Matches the dual-column layout of the actual `PortfolioDashboardView` component, rendering skeletons for the budget allocation pie chart, breakdown list, KPI mini cards, monthly execution compositions chart, and weekly scheduler.
     - `WorkspaceViewSkeleton`: Matches the tabbed structure and layout of the `WorkspaceView` and `BudgetDashboard` components, rendering skeletons for the tab switcher, multi-filter dropdown system, summary stats cards, and budget list panels.
     - `LawSystemPageSkeleton`: Matches the tabbed structure of `LawSystemPage` and the live national laws & municipal ordinances API search integration of `LawSearchPanel`.
   - Updated the dynamic loaders for `PortfolioDashboardView`, `WorkspaceView`, and `LawSystemPage` to use these high-fidelity skeletons rather than generic spinner loaders.
   - These additions significantly prevent CLS (Cumulative Layout Shift) by matching the page layout and shapes beforehand.
