# Worker 3 Task: Performance & Render Isolation (R3) Implementation

## Objective
Implement `React.memo` optimizations, useCallback/useMemo stability, activeNodeOverride props isolation, and staggered preloading/engine loops to prevent frame drops and unnecessary re-renderings.

## Reference Materials
Please read the Explorer's synthesis:
- Synthesis Report: `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\orchestrator\synthesis.md`
- Performance & Render Isolation Details: `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_opt_r3\analysis.md`

## Required Actions

### 1. WeeklyScheduler memoization (`src/components/dashboard/WeeklyScheduler.tsx`)
- Wrap the main `WeeklyScheduler` component with `React.memo`.
- Extract the inline scheduled item card rendering inside the `weekDays` loop (around line 380) into a standalone, memoized `<ScheduleItem>` subcomponent.
  - The `ScheduleItem` component should take `schedule` data, `config` options, and the `onDelete` callback.
  - Ensure all event handlers inside the child components are stable.

### 2. ContactsBox memoization (`src/components/dashboard/ContactsBox.tsx`)
- Identify individual contact card layouts inside the contacts mapping list.
- Extract individual contacts rows/cards into a standalone, memoized `<ContactCard>` subcomponent. This prevents input typing delays when a user types in search filters by isolating contact card updates.

### 3. MindMap3D memoization (`src/components/MindMap3D.tsx`)
- Locate the comparison function `areMindMap3DPropsEqual` inside the file.
- Locate the export `export const MindMap3D = React.memo(...)`.
- Correct the export so that it passes the custom comparison function as the second argument:
  `export const MindMap3D = React.memo(MindMap3DComponent, areMindMap3DPropsEqual);`
- Implement canvas loop delay: Create an `engineActive` state flag (initialized to false) and use a `useEffect` hook to set it to true after a `150ms` delay on mount (when the component is active), and reset to false on deactivate. This separates canvas initialization from tab transition layout animations.

### 4. MindMapInspector props stabilization (`src/components/MindMapInspector.tsx`)
- Instead of passing the entire `overrides` dictionary to the inspector component, modify the prop signature and update parent imports to pass only `activeNodeOverride` (calculated in `MindMap3D.tsx` as `overrides[activeNode.id]`).
- Clean up any unused hooks or variables that re-evaluate inspector panels unnecessarily.

### 5. Staggered Preloading Gates in `src/components/dashboard/PortfolioDashboardView.tsx`
- Implement state flags `renderScheduler` and `renderContacts` (both default to false).
- Use `useEffect` with `setTimeout` to stagger the loading of these two widgets:
  - Mount scheduler (`renderScheduler = true`) after `120ms`.
  - Mount contacts book (`renderContacts = true`) after `280ms`.
- Clean up these timers in the unmount callback.
- Render the custom skeleton loaders (`WeeklySchedulerSkeleton` and the Contacts loading skeleton) while the actual widgets are deferred.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Verification
- Run `npm run lint` and `npm run build` after completing the changes to ensure everything compiles without errors.
- Detail the files changed and validation output.
