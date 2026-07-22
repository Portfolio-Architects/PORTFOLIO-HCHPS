# Handoff Report — explorer_opt_r2

## 1. Observation

- **Target Component**: `src/components/project/ProjectManagementPage.tsx` (Total lines: 745).
- **Source Schedule Component**: `src/components/dashboard/WeeklyScheduler.tsx` (Total lines: 618, exported as `WeeklyScheduler = React.memo(...)`).
- **Hook & Storage**: `src/hooks/useSchedules.ts` (manages `Schedule` objects with fields: `id`, `date`, `endDate`, `startTime`, `endTime`, `title`, `type`, `person`, `notes`).
- **Current `ProjectManagementPage.tsx` Layout**:
  - Left column: Project list sidebar (`w-[360px]`, lines 211–299).
  - Right column: Project details panel (lines 302–531).
  - Currently lacks top tab bar or section switcher; directly renders attribute grid, checklist, achievements, future plans, and associated tasks.
- **Rules Compliance Check (AGENTS.md)**:
  - Rule 2-I (Server Hydration & Staggered Chunk): Requires dynamic imports (`ssr: false`) and custom Skeleton fallbacks for major component additions.
  - Rule 2-J (Zero-Stall): Tab state and data lookups must maintain $O(1)$ complexity without unnecessary re-fetching on tab switch.

---

## 2. Logic Chain

1. **Problem**: R2 milestone requires migrating the Schedule Planner (`WeeklyScheduler`) into the Project Management module (`ProjectManagementPage.tsx`) and seamlessly integrating project schedule data.
2. **Tab Architecture Selection**:
   - `ProjectManagementPage.tsx` contains right panel detail view when `selectedProject` is set. Adding a header tab selector (`activeTab: 'overview' | 'schedule'`) inside the right panel header (lines 306–321) allows users to toggle seamlessly between:
     a. **`사업 개요 및 실무` (Overview)**: Attribute grid, checklist, achievements, future plans, associated tasks.
     b. **`일정 플래너` (Schedule Planner)**: Weekly scheduler view displaying interactive 7-day schedule grid with registration form.
3. **Data Integration**:
   - Integrating project context into `WeeklyScheduler`: display project timeline banner (`selectedProject.timeline`) and pre-populate schedule form fields (person: `selectedProject.staff`, notes: `[사업: selectedProject.name]`).
4. **Hydration & Performance Guard**:
   - `WeeklyScheduler` must be imported via `dynamic(() => import('../dashboard/WeeklyScheduler').then(m => m.WeeklyScheduler), { ssr: false, loading: () => <WeeklySchedulerSkeleton /> })`.
   - Creating `WeeklySchedulerSkeleton` (600px height placeholder with pulse animation) prevents layout shifts.

---

## 3. Caveats

- `WeeklyScheduler` is currently also rendered in `PortfolioDashboardView.tsx`. When migrating/integrating it into `ProjectManagementPage.tsx`, we maintain `WeeklyScheduler.tsx` as a re-usable component in `src/components/dashboard/` or re-export it in `src/components/project/`.
- No direct source code changes were committed to `src/components/project/ProjectManagementPage.tsx` during this exploration turn (read-only constraint). Proposed implementation patch is fully documented in `analysis.md` and this report for implementer agent execution.

---

## 4. Conclusion

- Added tab navigation concept (`activeTab: 'overview' | 'schedule'`) in `ProjectManagementPage.tsx`.
- Defined dynamic import and skeleton strategy for `WeeklyScheduler`.
- Documented full proposed patch in `.agents/explorer_opt_r2/analysis.md`.

---

## 5. Verification Method

To verify the proposed implementation:
1. Check file existence: `.agents/explorer_opt_r2/analysis.md` and `.agents/explorer_opt_r2/handoff.md`.
2. Execute build & type check: `npx tsc --noEmit`
3. Execute harness check: `node scripts/run-harness.js`
4. In browser, verify tab switching between "사업 개요 및 실무" and "일정 플래너" on project selection with zero CLS or hydration errors.
