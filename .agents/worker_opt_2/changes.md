# Changes Record - Timezone Date Formatting Defect Fix

## Modified Files
- `src/components/dashboard/WeeklyScheduler.tsx`

## Details of Changes

1. **Added Local Date Formatter Helper (`formatDateStr`)**:
   - Defined `formatDateStr(d: Date): string` helper in the Time Helper Utilities section of `WeeklyScheduler.tsx`:
     ```ts
     const formatDateStr = (d: Date): string => {
       const year = d.getFullYear();
       const month = String(d.getMonth() + 1).padStart(2, '0');
       const day = String(d.getDate()).padStart(2, '0');
       return `${year}-${month}-${day}`;
     };
     ```
   - This formats local `Date` objects using local year, month, and day without UTC conversion shifts (-1 day shift in positive timezones like KST UTC+9).

2. **Replaced All `.toISOString().split('T')[0]` Occurrences**:
   - **ScheduleModal pre-fill (Line 75)**: Updated `today` initialization to `formatDateStr(new Date())`.
   - **Sidebar schedule form state (Lines 714 & 716)**: Updated `date` and `endDate` state initializers to `formatDateStr(new Date())`.
   - **`schedulesByDayMap` date range loop (Line 807)**: Updated `cur` date initialization to check for time component (`startDate.includes('T') ? startDate : `${startDate}T00:00:00``) and `dStr` formatting to `formatDateStr(cur)`.
   - **Week View day calculation (Line 1004)**: Updated `dayStr` to `formatDateStr(day)`.
   - **Month View 42-cell calendar grid (Line 1084)**: Updated `dayStr` to `formatDateStr(day)`.
   - **Timetable View header row (Line 1158)**: Updated `dayStr` to `formatDateStr(d)`.
   - **Timetable View 7-day slot cells (Line 1182)**: Updated `dayStr` to `formatDateStr(day)`.

3. **Verification**:
   - Confirmed zero occurrences of `.toISOString().split('T')[0]` remaining in `WeeklyScheduler.tsx`.
