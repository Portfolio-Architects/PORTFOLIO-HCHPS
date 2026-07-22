# Handoff Report — Timezone Date Formatting Defect Fix

## 1. Observation
- Audit of `src/components/dashboard/WeeklyScheduler.tsx` revealed 8 occurrences of `.toISOString().split('T')[0]`:
  - Line 75: `const today = new Date().toISOString().split('T')[0];` in `ScheduleModal` pre-fill
  - Lines 714 & 716: `const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);` and `const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);` in sidebar schedule form
  - Line 807: `const dStr = cur.toISOString().split('T')[0];` in `schedulesByDayMap` date range loop
  - Line 1004: `const dayStr = day.toISOString().split('T')[0];` in Week View day iteration
  - Line 1084: `const dayStr = day.toISOString().split('T')[0];` in Month View 42-day grid
  - Line 1158: `const dayStr = d.toISOString().split('T')[0];` in Timetable View day header row
  - Line 1182: `const dayStr = day.toISOString().split('T')[0];` in Timetable View 7-day slot cells
- When executed in positive timezones such as Korea Standard Time (KST, UTC+9) before 09:00 AM local time, `new Date().toISOString()` converts local time to UTC (e.g. 08:00 AM KST July 22 -> 11:00 PM UTC July 21), causing `.split('T')[0]` to return `'2026-07-21'` instead of `'2026-07-22'`.

## 2. Logic Chain
- Standard JavaScript `Date` objects maintain local date fields (`getFullYear()`, `getMonth()`, `getDate()`).
- `Date.prototype.toISOString()` converts the timestamp to UTC before producing the ISO string representation.
- In any positive timezone (e.g. UTC+9), local midnight occurs at 15:00 UTC on the previous calendar day. Converting a local `Date` representing local midnight (00:00:00) to ISO string yields a date string shifted by -1 day.
- Introducing a local date formatter helper function:
  ```ts
  const formatDateStr = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  ```
  guarantees that formatting a local `Date` object extracts local year, month, and day without UTC conversion, completely eliminating the -1 day shift across all timezones.

## 3. Caveats
- `formatDateStr` formats dates according to the runtime system's local timezone. When dates are transmitted to external APIs or stored, ISO strings or date-only strings (`YYYY-MM-DD`) should be handled consistently.
- `startDate` strings in `schedulesByDayMap` parsed via `new Date(startDate.includes('T') ? startDate : `${startDate}T00:00:00`)` enforce local midnight interpretation.

## 4. Conclusion
- All 8 occurrences of `.toISOString().split('T')[0]` in `src/components/dashboard/WeeklyScheduler.tsx` have been replaced with `formatDateStr`.
- Zero occurrences of `.toISOString()` remain in `WeeklyScheduler.tsx`.
- Automated harness checks (`node scripts/run-harness.js`) passed with 0 errors and 0 warnings.
- Production build (`npm run build`) compiled successfully with zero errors.
- `PORTFOLIO VITAL - Engineering Report.md` and `AGENTS.md` (via `node scripts/sync-rules.js`) have been updated.

## 5. Verification Method
- Execute harness check: `node scripts/run-harness.js` (Verify 0 Zod errors, 0 ESLint errors/warnings).
- Execute build verification: `npm run build` (Verify successful compilation and static page generation).
- Code inspection: `grep_search` for `toISOString` in `src/components/dashboard/WeeklyScheduler.tsx` returns 0 results.
