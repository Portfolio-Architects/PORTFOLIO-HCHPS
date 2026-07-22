# Comprehensive Code Review & Edge-Case Verification Report (R1-R5)

**Reviewer**: reviewer_opt_r3_2
**Date**: 2026-07-22
**Verdict**: **REQUEST_CHANGES** (FAIL)

---

## 1. Executive Summary

An independent review was performed on the codebase for R1–R5 changes across key dashboard and project management components:
1. `src/components/dashboard/PortfolioDashboardView.tsx` & `src/app/page.tsx`
2. `src/components/project/ProjectManagementPage.tsx`
3. `src/components/dashboard/WeeklyScheduler.tsx`

While `PortfolioDashboardView.tsx`, `src/app/page.tsx`, and `ProjectManagementPage.tsx` demonstrate clean architecture, robust dynamic import loading skeletons, proper Tailwind dark mode styling, and error boundaries, a **Major Timezone Date Calculation Defect** was identified in `WeeklyScheduler.tsx` where `.toISOString().split('T')[0]` shifts local dates by -1 day in positive UTC timezones (e.g., KST UTC+9).

---

## 2. Detailed Findings

### [Major] Finding 1: Timezone Date Offset Flaw in `WeeklyScheduler.tsx`
- **What**: Usage of `day.toISOString().split('T')[0]` on local `Date` instances (e.g. `new Date(year, month, 1)` or `new Date(monday)`).
- **Where**: `src/components/dashboard/WeeklyScheduler.tsx`, lines 75, 711, 1004, 1084, 1158, 1182.
- **Why**: In timezones ahead of UTC (such as KST UTC+9), constructing a local date at `00:00:00` (e.g. `2026-07-01 00:00:00 KST`) corresponds to `2026-06-30 15:00:00 UTC`. Calling `.toISOString().split('T')[0]` returns `"2026-06-30"`, shifting dates back by 1 day. This causes schedules in month view, week view, and timetable view to map to the wrong day string.
- **Suggestion**: Replace `.toISOString().split('T')[0]` with a local date formatter utility:
  ```ts
  function formatLocalDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  ```

### [Minor] Finding 2: Timetable View Fixed Slot Range Limitation in `WeeklyScheduler.tsx`
- **What**: Timetable view grid is hardcoded to 13 hours (`08:00` to `20:00`), filtering schedules using `.startsWith(hourStr)`.
- **Where**: `src/components/dashboard/WeeklyScheduler.tsx`, lines 896 & 1185.
- **Why**: Schedules starting outside `08:00`–`20:00` (e.g. `07:00` or `21:00`) will not be rendered in the timetable grid. In addition, multi-hour schedules are rendered only in their start-hour slot.
- **Suggestion**: Expand timetable slot bounds or add visual indicator for schedules outside the 08:00–20:00 window.

---

## 3. Scope & Requirement Inspection Results

| Target File | Inspection Criteria | Status | Details / Observations |
| --- | --- | --- | --- |
| `PortfolioDashboardView.tsx` | Layout regressions & unused imports | **PASS** | Responsive 12-col layout, clean imports, memoized props, debounced ResizeObserver for charts. |
| `src/app/page.tsx` | Dynamic imports & skeleton integration | **PASS** | Hydration guards (`useIsClient`), staggered idle preloading, error boundary (`MindMapErrorBoundary`) present. |
| `ProjectManagementPage.tsx` | Tab transition stability & dynamic imports | **PASS** | Stable tab switching between overview & scheduler, safe named dynamic import loading `WeeklyScheduler`. |
| `WeeklyScheduler.tsx` | Safe JSON drag-and-drop parsing | **PASS** | `handleDropCell` safely wraps `JSON.parse` in `try...catch` and validates `raw` & `id`. |
| `WeeklyScheduler.tsx` | Date/time format correctness | **FAIL** | Timezone shift bug using `.toISOString().split('T')[0]` on local Date objects. |
| `WeeklyScheduler.tsx` | Modal state management | **PASS** | `ScheduleModal` pre-fills fields, validates start < end time, handles create/update/delete cleanly. |
| `WeeklyScheduler.tsx` | 42-day month matrix calculation | **PASS** (Logic) / **FAIL** (Render) | 42-day grid index logic is mathematically accurate for Mon-start, but rendered date string shifts in KST. |
| `WeeklyScheduler.tsx` | Timetable slot calculation | **PASS** | 13-hour slot array (08:00-20:00) calculated accurately, filters schedules by start hour. |
| General Code Base | Dark mode & Error Handling | **PASS** | Proper Tailwind `dark:` color tokens applied across cards, modals, tables, and tooltips. |

---

## 4. Verified Claims & Tests

- **Zod Database Schema Verification**: `PASS` (TASKS, BUDGET_CATEGORIES, BUDGET_ENTRIES, PROJECTS all schema-compliant).
- **TypeScript Static Verification**: Code syntax and type structure inspected.
- **Tailwind Dark Mode Conformance**: Verified across all target files.

---

## 5. Adversarial Challenge & Edge Case Stress-Test

1. **Adversarial Scenario A: Non-JSON Drag & Drop Payload**
   - *Attack*: User drags text/file or corrupt string into `WeeklyScheduler` cell.
   - *Result*: `handleDropCell` checks `if (!raw) return;` and catches `JSON.parse` failure in `try-catch`, logging error without crashing UI. -> **PASS**

2. **Adversarial Scenario B: Local Midnight in UTC+9 (KST Timezone)**
   - *Attack*: Render month/week calendar in KST timezone at 08:00 AM local time.
   - *Result*: `day.toISOString().split('T')[0]` evaluates to UTC date of previous day. Date header shows "2026-07-22", but internal `dayStr` key becomes `"2026-07-21"`. Schedules created on 2026-07-22 fail to match or show on 2026-07-21. -> **FAIL** (Caught by critic)

3. **Adversarial Scenario C: Rapid Tab Switching in ProjectManagementPage**
   - *Attack*: Rapidly click between Overview and Integrated Scheduler tabs.
   - *Result*: Dynamic import fallback `<WeeklySchedulerSkeleton />` handles async chunk load gracefully without state corruption. -> **PASS**
