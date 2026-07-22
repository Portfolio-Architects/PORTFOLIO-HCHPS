# Handoff Report: R3 (Interactive UX) & R4 (Multi-View Scheduler)

## 1. Observation

- **Target Files Inspected**:
  - `src/components/dashboard/WeeklyScheduler.tsx` (618 lines): Currently renders static 7-day columns and side-by-side creation form `ScheduleForm`. Does not contain cell click modal or drag-and-drop rescheduling handlers.
  - `src/hooks/useSchedules.ts` (55 lines): Exposes `schedules`, `loading`, `addSchedule`, `updateSchedule`, `deleteSchedule`, `getSchedulesForDate`.
  - `src/lib/schemas.ts` (lines 153-167): Defines `ScheduleSchema` and `ScheduleTypeSchema` with `.catch()` error fallbacks on all fields.
  - `src/types/index.ts` (lines 176-191): Defines `Schedule` interface and `ScheduleType` union type (`'security' | 'meeting' | 'education' | 'other'`).
  - `src/components/dashboard/PortfolioDashboardView.tsx` (lines 73-76, 446-450): Dynamic import wrapper for `WeeklyScheduler`.

- **Key Findings**:
  - `useSchedules.ts` already provides `updateSchedule(id, updates)`, which performs optimistic state mutation + CRDT background sync (`syncUpdate`). This is fully ready for drag-and-drop instant persistence.
  - `ScheduleSchema` in `schemas.ts` tolerates partial updates cleanly with zero Zod validation errors due to `.catch()` default fallbacks.
  - Current grid columns do not have `onDragOver` or `onDrop` event handlers.
  - `WeeklyScheduler.tsx` currently only supports single week view.

---

## 2. Logic Chain

1. **Step 1: Cell Click Interaction (R3)**
   - Observation: Clicking a day header currently only sets the start date on the side form. Empty time slots or day cells cannot be clicked directly to create schedules.
   - Deduction: Introducing a unified `ScheduleModal` component and `modalState` allows any cell click (`onClick={() => handleCellClick(dateStr, timeStr)}`) to trigger modal creation with prefilled `date`, `startTime`, `endTime` (+1h duration). Card click triggers edit mode.

2. **Step 2: Drag & Drop Rescheduling (R3)**
   - Observation: `ScheduleItem` is a static element. `useSchedules` has `updateSchedule`.
   - Deduction: Adding `draggable={true}` and `onDragStart` to `ScheduleItem` serializes `{ id, durationMinutes }` into `e.dataTransfer`. Adding `onDragOver`, `onDragLeave`, and `onDrop` to cells extracts target `date` and optional target `startTime`, recalculates `endTime`, and invokes `updateSchedule(id, updates)`. UI updates instantly with zero-stall.

3. **Step 3: Multi-View Support (R4)**
   - Observation: `WeeklySchedulerComponent` calculates `weekDays` for single week layout.
   - Deduction: Adding `viewMode: 'week' | 'month' | 'timetable'` state and header tab switcher allows conditional rendering:
     - `'week'`: 7-day column grid with drag drop & cell click.
     - `'month'`: 42-day calendar matrix (6 weeks × 7 days) displaying compact schedule pills with cell click & date drag drop.
     - `'timetable'`: Hourly timeline matrix (08:00–20:00 × 7 days) displaying positioned schedule blocks with time-slot drag drop & slot click.

---

## 3. Caveats

- **Multi-day schedules (`endDate`)**: When dropping a multi-day schedule on a new start date, `date` should update while preserving the date interval `(endDate - date)` if `endDate` is set.
- **Drag Feedback in Mobile**: Native HTML5 Drag and Drop is optimized for mouse desktop interactions. For touch devices, cell-click modal popup serves as the primary accessible interaction path.
- **Time Slot Clamping**: When dragging to late evening slots (e.g. 23:00), `endTime` must clamp to `23:59` to prevent invalid hour wrapping.

---

## 4. Conclusion

The design for R3 and R4 is completely mapped out and ready for implementation.
- All required state hooks, event handlers, and view modes have been designed with full compatibility with existing `useSchedules` hook and Zod `ScheduleSchema`.
- Implementation requires updating `WeeklyScheduler.tsx` to include `ScheduleModal`, DND handlers, and view components (`WeekView`, `MonthView`, `TimetableMode`).

---

## 5. Verification Method

To verify the implementation once written by implementer:

1. **Cell Click Verification**:
   - In Week view: Click any day column empty space → expect `ScheduleModal` to open with date prefilled.
   - In Timetable view: Click 14:00 slot on Wednesday → expect modal with `date: "YYYY-MM-DD"`, `startTime: "14:00"`, `endTime: "15:00"`.
   - Click an existing card → expect edit modal to open with schedule details.

2. **Drag & Drop Rescheduling Verification**:
   - Drag a schedule card from Monday to Wednesday → observe card move immediately and persist date update.
   - Drag a schedule card from 09:00 slot to 14:00 slot in Timetable view → observe card start time update to 14:00.

3. **Multi-View Tab Switcher Verification**:
   - Click "월간 보기" tab → expect 42-cell calendar grid with schedule pills.
   - Click "타임테이블" tab → expect hour-by-hour matrix.
   - Click "주간 보기" tab → return to 7-day column view.

4. **Zero-Stall Harness Verification**:
   - Run `node scripts/run-harness.js` and `npx tsc --noEmit` to verify 0 errors, 0 warnings, and zero Zod schema errors.
