# Handoff Report — reviewer_opt_r3_2

## 1. Observation
- **Inspected Files**:
  - `src/components/dashboard/PortfolioDashboardView.tsx` (Lines 1–405)
  - `src/app/page.tsx` (Lines 1–897)
  - `src/components/project/ProjectManagementPage.tsx` (Lines 1–815)
  - `src/components/dashboard/WeeklyScheduler.tsx` (Lines 1–1255)
- **Specific Observations**:
  - In `WeeklyScheduler.tsx`, lines 75, 711, 1004, 1084, 1158, 1182:
    `const dayStr = day.toISOString().split('T')[0];` and `new Date().toISOString().split('T')[0]`.
  - In `WeeklyScheduler.tsx`, line 826:
    ```ts
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const data = JSON.parse(raw);
      const { id, durationMins, startTime: origStartTime } = data;
      if (!id) return;
      ...
    } catch (err) {
      console.error('Failed to reschedule item:', err);
    }
    ```
  - In `WeeklyScheduler.tsx`, lines 742–758:
    42-day month grid calculation uses `offset = (dayOfWeek + 6) % 7` for Monday-start calendar grid generation.
  - In `WeeklyScheduler.tsx`, line 896:
    `timetableHours = Array.from({ length: 13 }, (_, i) => String(i + 8).padStart(2, '0'))` (08:00 to 20:00).
  - In `ProjectManagementPage.tsx`, lines 31–34:
    `const WeeklyScheduler = dynamic(() => import('@/components/dashboard/WeeklyScheduler').then(mod => mod.WeeklyScheduler), { ssr: false, loading: () => <WeeklySchedulerSkeleton /> });`
  - In `src/app/page.tsx`:
    `useIsClient` hydration guard, `MindMapErrorBoundary` error boundary, and staggered preloading in `preloadModulesOnIdle`.

## 2. Logic Chain
1. **Observation**: `WeeklyScheduler.tsx` calls `day.toISOString().split('T')[0]` on local `Date` instances created via `new Date(year, month, 1)` or `new Date(monday)`.
2. **Logic**: Local midnight (`00:00:00` local time) in positive timezones (e.g. KST UTC+9) corresponds to `15:00:00` of the previous calendar day in UTC. Calling `.toISOString()` produces a ISO string in UTC, causing `.split('T')[0]` to evaluate to the day BEFORE the intended local date.
3. **Observation**: Schedules are stored in `schedulesByDayMap` keyed by `YYYY-MM-DD` strings.
4. **Logic**: Because `dayStr` evaluated in the UI component is off by -1 day in positive timezones, schedules fail to match their target date or appear shifted under the wrong day column.
5. **Conclusion**: The codebase requires changes to fix date string formatting in `WeeklyScheduler.tsx`.

## 3. Caveats
- Runtime browser UI testing in negative UTC timezones (e.g., US EST UTC-5) would not exhibit the -1 day shift because local midnight is later than UTC midnight; however, for East Asian / European timezones (UTC+1 to UTC+12 including Korea KST UTC+9), the bug reproduces consistently.

## 4. Conclusion
Final Verdict: **REQUEST_CHANGES** (FAIL).
The codebase demonstrates excellent architecture, dynamic import loading fallbacks, and dark mode compliance, but contains a major timezone date calculation bug in `WeeklyScheduler.tsx` that must be addressed by replacing `.toISOString().split('T')[0]` with a local date formatting function.

## 5. Verification Method
1. Inspect `src/components/dashboard/WeeklyScheduler.tsx` at lines 1004, 1084, 1158, and 1182.
2. In Node.js or browser console in UTC+9:
   `d = new Date(2026, 6, 1); d.toISOString().split('T')[0]` -> returns `"2026-06-30"` (1 day off).
3. Confirm invalidation condition: Replacing `.toISOString().split('T')[0]` with a local date formatter (e.g. `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`) restores exact date alignment across all timezones.
