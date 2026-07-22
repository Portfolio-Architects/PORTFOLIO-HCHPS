# Detailed Technical Analysis: R3 (Interactive UX) & R4 (Multi-View Scheduler)

## 1. Executive Summary & Objective

This report details the architectural investigation and implementation specification for **R3 (Interactive UX: Cell Direct Click Modal & Drag-and-Drop Rescheduling)** and **R4 (Multi-View Support: Week / Month / Timetable Views)** in `WeeklyScheduler.tsx`, `useSchedules.ts`, and `schemas.ts`.

The goal is to transform `WeeklyScheduler.tsx` from a single static week column layout into an interactive, multi-view scheduler with instant cell-click modal creation, full HTML5 Drag & Drop rescheduling with live state persistence, and seamless view mode switching (Week, Month, Timetable).

---

## 2. Existing System Architecture & Data Flow

### 2.1 File Map & Responsibilities

| File Path | Role & Responsibilities |
|---|---|
| `src/lib/schemas.ts` | Zod validation schemas (`ScheduleSchema`, `ScheduleTypeSchema`). Ensures strict type safety and disk persistence sanitization with `.catch()` fallbacks. |
| `src/types/index.ts` | TypeScript interfaces (`Schedule`, `ScheduleType`). |
| `src/hooks/useSchedules.ts` | React custom hook providing CRUD methods (`addSchedule`, `updateSchedule`, `deleteSchedule`, `getSchedulesForDate`) backed by `useGoogleSheet` & CRDT sync (`useSheetCrud`). |
| `src/components/dashboard/WeeklyScheduler.tsx` | Main scheduler component. Contains `ScheduleForm`, `ScheduleItem`, and `WeeklySchedulerComponent`. |
| `src/components/dashboard/PortfolioDashboardView.tsx` | Parent view rendering `WeeklyScheduler` via Next.js `dynamic()` import with skeleton UI. |

### 2.2 `Schedule` Schema & Type Definition

```ts
// src/lib/schemas.ts (lines 153-167)
export const ScheduleTypeSchema = z.enum(['security', 'meeting', 'education', 'other']);

export const ScheduleSchema = z.object({
  id: z.string().catch(() => Math.random().toString(36).substring(2, 9)),
  date: z.string().catch(new Date().toISOString().split('T')[0]),
  endDate: z.string().optional().catch(undefined),
  startTime: z.string().catch('09:00'),
  endTime: z.string().catch('18:00'),
  title: z.string().catch('새로운 일정'),
  type: ScheduleTypeSchema.catch('other'),
  person: z.string().catch(''),
  notes: z.string().optional().catch(''),
  createdAt: z.string().catch(new Date().toISOString()),
  updatedAt: z.string().catch(new Date().toISOString()),
});

export type ScheduleDto = z.infer<typeof ScheduleSchema>;
```

#### Field Specifications:
- `id`: Unique schedule identifier (`string`). Generated via `generateId()`.
- `date`: Primary date string in `YYYY-MM-DD` ISO format.
- `endDate`: Optional end date for multi-day events in `YYYY-MM-DD` ISO format.
- `startTime`: Start time string in `HH:mm` (24-hour format, e.g. `'09:00'`).
- `endTime`: End time string in `HH:mm` (24-hour format, e.g. `'18:00'`).
- `title`: Schedule title string (e.g. `'4층 보안'`, `'주간 업무 회의'`).
- `type`: Enum `'security' | 'meeting' | 'education' | 'other'`.
- `person`: Assigned person or meeting host.
- `notes`: Optional memo / detailed notes.
- `createdAt`, `updatedAt`: ISO 8601 timestamps.

### 2.3 `useSchedules` Hook Analysis

```ts
// src/hooks/useSchedules.ts (lines 7-54)
export function useSchedules() {
  const [schedules, setSchedules, loading] = useGoogleSheet<Schedule>(
    'SCHEDULES',
    'hchps-schedules',
    []
  );
  const { syncAdd, syncUpdate, syncDelete } = useSheetCrud<Schedule>('SCHEDULES');

  const addSchedule = useCallback((schedule: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newSchedule: Schedule = {
      ...schedule,
      id: generateId(),
      createdAt: now,
      updatedAt: now
    };
    setSchedules(prev => [newSchedule, ...prev]);
    syncAdd(newSchedule);
    return newSchedule;
  }, [setSchedules, syncAdd]);

  const updateSchedule = useCallback((id: string, updates: Partial<Schedule>) => {
    const updatedFields = { ...updates, updatedAt: new Date().toISOString() };
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...updatedFields } : s));
    syncUpdate(id, updatedFields);
  }, [setSchedules, syncUpdate]);

  const deleteSchedule = useCallback((id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
    syncDelete(id);
  }, [setSchedules, syncDelete]);

  const getSchedulesForDate = useCallback((dateStr: string) => {
    return schedules
      .filter(s => s.date === dateStr)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [schedules]);

  return { schedules, loading, addSchedule, updateSchedule, deleteSchedule, getSchedulesForDate };
}
```

---

## 3. R3 Implementation Design: Interactive UX

### 3.1 Direct Cell Click Modal Interaction

#### Requirement
Clicking any date cell or time slot across all view modes (Week, Month, Timetable) opens a schedule modal prefilled with:
- `date`: target cell date (`YYYY-MM-DD`)
- `startTime`: clicked slot time (e.g. `'14:00'`)
- `endTime`: 1 hour after `startTime` (e.g. `'15:00'`)

Clicking an existing schedule card opens the modal in **Edit Mode** allowing editing or deleting the schedule.

#### Modal State Model
```ts
export interface ScheduleModalState {
  isOpen: boolean;
  mode: 'create' | 'edit';
  scheduleId?: string;
  date: string;
  endDate?: string;
  isRange?: boolean;
  startTime: string;
  endTime: string;
  title: string;
  type: ScheduleType;
  person: string;
  notes?: string;
}
```

#### Event Handler Design
```tsx
const handleCellClick = useCallback((dateStr: string, timeStr: string = '09:00') => {
  // Calculate end time (+1 hour)
  const [h, m] = timeStr.split(':').map(Number);
  const endH = Math.min(23, h + 1);
  const endTimeStr = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  setModalState({
    isOpen: true,
    mode: 'create',
    date: dateStr,
    endDate: dateStr,
    isRange: false,
    startTime: timeStr,
    endTime: endTimeStr,
    title: '새 일정',
    type: 'security',
    person: '오창선',
    notes: ''
  });
}, []);

const handleScheduleClick = useCallback((schedule: Schedule, e: React.MouseEvent) => {
  e.stopPropagation(); // Prevent cell click
  setModalState({
    isOpen: true,
    mode: 'edit',
    scheduleId: schedule.id,
    date: schedule.date,
    endDate: schedule.endDate || schedule.date,
    isRange: !!(schedule.endDate && schedule.endDate !== schedule.date),
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    title: schedule.title,
    type: schedule.type,
    person: schedule.person,
    notes: schedule.notes || ''
  });
}, []);
```

---

### 3.2 HTML5 Drag & Drop Rescheduling Architecture

#### Requirement
User drags a schedule card from one cell to another. Drop target extracts target `date` and optional target `startTime`, recalculating `endTime` based on original event duration, then triggers `updateSchedule` for instant UI feedback and disk/CRDT persistence.

#### DND Protocol & Data Transfer Format
- **MIME Type**: `application/json` or `text/plain`
- **Payload**: JSON string `{ "id": "sched_123", "durationMinutes": 60 }`

#### Implementation Specification

##### 1. Draggable Schedule Card (`ScheduleItem.tsx`)
```tsx
// Props
interface ScheduleItemProps {
  schedule: Schedule;
  config: { bg: string; badge: string; icon: React.ReactNode };
  onDelete: (id: string) => void;
  onClick: (schedule: Schedule, e: React.MouseEvent) => void;
}

// In ScheduleItem:
const handleDragStart = (e: React.DragEvent) => {
  e.stopPropagation();
  // Compute duration in minutes
  const [sh, sm] = schedule.startTime.split(':').map(Number);
  const [eh, em] = schedule.endTime.split(':').map(Number);
  const durationMinutes = (eh * 60 + em) - (sh * 60 + sm);

  const payload = JSON.stringify({
    id: schedule.id,
    durationMinutes: durationMinutes > 0 ? durationMinutes : 60
  });

  e.dataTransfer.setData('application/json', payload);
  e.dataTransfer.setData('text/plain', schedule.id);
  e.dataTransfer.effectAllowed = 'move';
};

<div
  draggable={true}
  onDragStart={handleDragStart}
  onClick={(e) => onClick(schedule, e)}
  className="cursor-grab active:cursor-grabbing ..."
>
  {/* Schedule card UI */}
</div>
```

##### 2. Drop Target Cell (Week / Month / Timetable Cell)
```tsx
// Drop target state for hover highlights
const [isDragOver, setIsDragOver] = useState(false);

const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (!isDragOver) setIsDragOver(true);
};

const handleDragLeave = (e: React.DragEvent) => {
  e.preventDefault();
  setIsDragOver(false);
};

const handleDrop = (e: React.DragEvent, targetDateStr: string, targetTimeStr?: string) => {
  e.preventDefault();
  setIsDragOver(false);

  let scheduleId = '';
  let durationMinutes = 60;

  try {
    const jsonRaw = e.dataTransfer.getData('application/json');
    if (jsonRaw) {
      const parsed = JSON.parse(jsonRaw);
      scheduleId = parsed.id;
      durationMinutes = parsed.durationMinutes || 60;
    } else {
      scheduleId = e.dataTransfer.getData('text/plain');
    }
  } catch (err) {
    scheduleId = e.dataTransfer.getData('text/plain');
  }

  if (!scheduleId) return;

  const updates: Partial<Schedule> = { date: targetDateStr };

  if (targetTimeStr) {
    const [th, tm] = targetTimeStr.split(':').map(Number);
    const startTotal = th * 60 + tm;
    const endTotal = startTotal + durationMinutes;

    const endH = Math.min(23, Math.floor(endTotal / 60));
    const endM = endTotal % 60;

    updates.startTime = `${String(th).padStart(2, '0')}:${String(tm).padStart(2, '0')}`;
    updates.endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  }

  updateSchedule(scheduleId, updates);
};

<div
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={(e) => handleDrop(e, dayStr, slotTimeStr)}
  className={`transition-colors ${isDragOver ? 'bg-indigo-500/10 ring-2 ring-indigo-500/50' : ''}`}
>
  ...
</div>
```

---

## 4. R4 Implementation Design: Multi-View Support

### 4.1 View Mode State & Tab Bar Controls

#### View Mode State
```ts
export type SchedulerViewMode = 'week' | 'month' | 'timetable';

const [viewMode, setViewMode] = useState<SchedulerViewMode>('week');
```

#### Header Controls Design
```tsx
<div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/50 dark:border-slate-700/60">
  <button
    onClick={() => setViewMode('week')}
    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
      viewMode === 'week'
        ? 'bg-indigo-600 text-white shadow-xs'
        : 'text-slate-600 dark:text-slate-350 hover:bg-white/50 dark:hover:bg-slate-700/50'
    }`}
  >
    주간 보기
  </button>
  <button
    onClick={() => setViewMode('month')}
    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
      viewMode === 'month'
        ? 'bg-indigo-600 text-white shadow-xs'
        : 'text-slate-600 dark:text-slate-350 hover:bg-white/50 dark:hover:bg-slate-700/50'
    }`}
  >
    월간 보기
  </button>
  <button
    onClick={() => setViewMode('timetable')}
    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
      viewMode === 'timetable'
        ? 'bg-indigo-600 text-white shadow-xs'
        : 'text-slate-600 dark:text-slate-350 hover:bg-white/50 dark:hover:bg-slate-700/50'
    }`}
  >
    타임테이블
  </button>
</div>
```

---

### 4.2 Rendering Architecture per View Mode

#### 1. Week View (`viewMode === 'week'`)
- Layout: 7 equal-width columns (Monday to Sunday).
- Header: Day name, date number, today indicator, count badge.
- Body: Stacked schedule cards with drag target container.
- Date Navigation: `±7 days`.

#### 2. Month View (`viewMode === 'month'`)
- Layout: 6 weeks × 7 days calendar grid (42 day cells).
- Header: Mon / Tue / Wed / Thu / Fri / Sat / Sun headers.
- Day Cell Content:
  - Date number (highlight today in indigo, dim previous/next month days in text-slate-400).
  - Compact schedule pills (showing title + startTime, color-coded by type).
  - Max 3 pills rendered per day cell + `+N개 더` button to expand/view date modal.
  - Drop Target: Full cell area drops schedule to update `date`.
- Date Navigation: `±1 month` (`handlePrevMonth`, `handleNextMonth`).

#### 3. Timetable View (`viewMode === 'timetable'`)
- Layout: Hourly time grid (Rows: 08:00 to 20:00, 13 slots; Columns: 7 week days).
- Header: Fixed time axis column on left + 7 day headers across top.
- Slot Cells:
  - Each hour slot cell `(dayDate, hour)` is a drop target (`onDrop` updates `date` and `startTime`).
  - Clicking any slot opens create modal prefilled with `date` and `startTime: "14:00"`, `endTime: "15:00"`.
- Schedule Overlay Positioning:
  - Calculate `top = (startHour - 8) * slotHeightPx`
  - Calculate `height = (durationHours) * slotHeightPx`
  - Positioned relative/absolute over the day column for precise visual scheduling.

---

## 5. Verification & Schema Safety

### 5.1 Zod Schema Compatibility Check
When calling `updateSchedule(id, updates)`, updates pass through `ScheduleSchema`:
```ts
const ScheduleSchema = z.object({
  id: z.string().catch(...),
  date: z.string().catch(...),
  endDate: z.string().optional().catch(undefined),
  startTime: z.string().catch('09:00'),
  endTime: z.string().catch('18:00'),
  title: z.string().catch('새로운 일정'),
  type: ScheduleTypeSchema.catch('other'),
  person: z.string().catch(''),
  notes: z.string().optional().catch(''),
  createdAt: z.string().catch(...),
  updatedAt: z.string().catch(...),
});
```
- `.catch()` error bounds prevent schema verification crashes during drag-and-drop or partial updates.
- TypeScript interfaces match `ScheduleDto` 1:1.

### 5.2 Zero-Stall & Performance Standards
- Components leverage `React.memo` (`ScheduleItem`, `ScheduleModal`, `WeeklyScheduler`).
- $O(1)$ pre-computed grouping map via `useMemo` (`schedulesByDayMap`) prevents rendering lag during drag hover.
- High-contrast dark theme classes applied cleanly (`dark:bg-slate-900`, `dark:border-slate-800`).

---

## 6. Proposed Code Structure for `WeeklyScheduler.tsx`

The complete implementation combines:
1. `ScheduleModal`: Unified popup modal for cell-click creation and card-click editing.
2. `ScheduleItem`: Extended with HTML5 DND (`draggable`, `onDragStart`, `onClick`).
3. `WeekViewGrid`: Rendered when `viewMode === 'week'`.
4. `MonthViewGrid`: Rendered when `viewMode === 'month'`.
5. `TimetableGrid`: Rendered when `viewMode === 'timetable'`.
6. Header toolbar with view switcher tab buttons, navigation buttons (Today, Prev, Next), and Quick Add button.

All findings are ready for handoff to implementer.
