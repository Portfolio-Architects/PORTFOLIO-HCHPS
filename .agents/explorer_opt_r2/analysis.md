# R2 Project Management Schedule Planner Migration & Integration Analysis

**Author**: `explorer_opt_r2` (Teamwork Explorer)  
**Date**: 2026-07-22  
**Target File**: `src/components/project/ProjectManagementPage.tsx`  
**Related Components**: `src/components/dashboard/WeeklyScheduler.tsx`, `src/hooks/useSchedules.ts`, `src/hooks/useProjects.ts`

---

## 1. Executive Summary

The objective of R2 is to integrate the **Schedule Planner (일정 플래너)** into the **Project Management (`ProjectManagementPage.tsx`)** module. 
Currently:
- `ProjectManagementPage.tsx` features a 2-column layout (Left Sidebar: Project List, Right Panel: Project Details containing parameters grid, checklist, achievements, future plans, and associated tasks).
- `WeeklyScheduler.tsx` lives under `src/components/dashboard/` and manages weekly schedule entries (`security`, `meeting`, `education`, `other`) using `useSchedules()`.

This analysis provides the complete design, code mapping, tab navigation architecture, schedule data integration, and exact proposed modifications adhering strictly to AGENTS.md hydration and performance rules.

---

## 2. Component Inspection & Line-by-Line Mapping

### A. `src/components/project/ProjectManagementPage.tsx`
- **Lines 1–12**: Imports (`useProjects`, `useTasks`, `Project`, `ChecklistItem`, `Task`, `lucide-react` icons).
- **Lines 14–56**: Main component `ProjectManagementPage()` initialization, hook hooks (`useProjects`, `useTasks`), local state for modal dialogs (`isAddingProject`, `isEditingProject`, `isAddingTask`), project form state, checklist text state, selected project memoization (`selectedProject`).
- **Lines 82–196**: Project CRUD event handlers (`handleCreateProject`, `handleUpdateProject`, `handleDeleteProject`, `handleAddChecklist`, `handleCreateAssociatedTask`, `handleToggleTaskStatus`).
- **Lines 191–206**: `associatedTasks` and `progressMap` memoizations.
- **Lines 207–300**: Main container div and **Left Column Sidebar (`w-full md:w-[360px]`)**: displays project list, search/selection handlers, progress bars, edit/delete buttons.
- **Lines 302 border/panel**: **Right Column Panel**: Currently renders only the detailed project view when `selectedProject` is non-null or an empty state when no project is selected.
  - **Lines 306–321**: Project Header (color dot, name, description).
  - **Lines 324–429**: Left Sub-panel (Project attributes grid: Target, Budget, Location, Staff, Timeline + Checklist items list & add form).
  - **Lines 432–520**: Right Sub-panel (Achievements text box, Future Plans text box + Associated Tasks list & task assignment modal trigger).
- **Lines 536–741**: Modals (`isAddingProject`, `isEditingProject`, `isAddingTask`).

### B. `src/components/dashboard/WeeklyScheduler.tsx`
- **Lines 1–87**: `ScheduleForm` component (isolated form memoized with `React.memo` for registering new schedules).
- **Lines 100–376**: `ScheduleItem` memoized component (renders single schedule card with color coding by type, person badge, note tooltip, and delete action).
- **Lines 380–618**: `WeeklySchedulerComponent` wrapped with `React.memo` as `WeeklyScheduler`. Uses `useSchedules()` hook, calculates `weekDays` array, filters schedules by date range, and renders the 7-day calendar grid.

### C. `src/hooks/useSchedules.ts`
- Provides `schedules`, `loading`, `addSchedule`, `updateSchedule`, `deleteSchedule`, `getSchedulesForDate`.
- `Schedule` type fields: `id`, `date`, `endDate`, `startTime`, `endTime`, `title`, `type` (`'security' | 'meeting' | 'education' | 'other'`), `person`, `notes`, `createdAt`, `updatedAt`.

---

## 3. Architecture & Tab Navigation Structure

Currently, `ProjectManagementPage.tsx` lacks a top tab switcher for switching views within a project or across the project management module. 

### Proposed Tab Navigation Architecture:
We introduce an **Active Tab State** in `ProjectManagementPage.tsx`:
```tsx
export type ProjectTabType = 'overview' | 'schedule';
const [activeTab, setActiveTab] = useState<ProjectTabType>('overview');
```

#### Placement Options:
1. **Right Panel Header Tab Navigation Bar** (Recommended):
   - Located directly below or alongside the Project Header inside the Right Panel (`selectedProject` detail view).
   - Allows switching between:
     - **`[FolderGit2] 사업 개요 및 세부 현황` (Overview)**: Displays attributes, checklist, achievements, future plans, and tasks.
     - **`[Calendar] 일정 플래너` (Schedule Planner)**: Displays the weekly schedule planner view.

2. **Global Project Management Module Tab Bar**:
   - Placed above the 2-column layout or inside the main header.
   - `overview`: 2-column project list + detail view.
   - `schedule`: Full-width or sidebar-assisted Schedule Planner integrating project schedules.

---

## 4. Schedule Data & Project Integration Strategy

When the user switches to the **'일정 플래너' (Schedule Planner)** tab in `ProjectManagementPage.tsx`:

1. **Project-Contextual Schedule Filtering**:
   - If a project is selected (`selectedProjectId`), the Schedule Planner can highlight schedules associated with the project's staff (`selectedProject.staff`) or project category.
   - An optional filter toggle: `"전체 일정 보기" (View All)` vs `"현재 사업 일정만 보기" (View Current Project Schedules)`.

2. **Auto-Populating Schedule Registration Form**:
   - When registering a new schedule while inside a project view, the `person` field defaults to `selectedProject.staff` (e.g. "홍길동 팀장"), and `notes` defaults to `[사업: selectedProject.name]`.

3. **Project Timeline & Milestones Integration**:
   - Displays project key timeline (`selectedProject.timeline`) as a banner above the weekly grid so team members can align weekly tasks with overall project deadlines.

---

## 5. Hydration & Staggered Chunk Compliance (AGENTS.md Rules)

To strictly comply with **AGENTS.md Rule 2-I (Hydration & Chunk Isolation)** and **Rule 2-J (Zero-Stall)**:

1. **Dynamic Import**:
   `WeeklyScheduler` component MUST be dynamically imported with `ssr: false`:
   ```tsx
   const WeeklyScheduler = dynamic(
     () => import('../dashboard/WeeklyScheduler').then(mod => mod.WeeklyScheduler),
     {
       ssr: false,
       loading: () => <WeeklySchedulerSkeleton />
     }
   );
   ```

2. **Skeleton Fallback Component (`WeeklySchedulerSkeleton`)**:
   Must render an exact real-dimension placeholder (height ~620px, high-contrast skeleton blocks with `animate-pulse`) to prevent Cumulative Layout Shift (CLS) during hydration and tab switching.

3. **Staggered Preloading / Idle Callback**:
   - When `ProjectManagementPage` mounts, schedule bundle preloading can be deferred using `requestIdleCallback` (with fallback to `setTimeout` 3.5s) so main thread hydration remains 100% smooth.

4. **Memoization**:
   - Tab switching handlers and sub-views wrapped with `useCallback` / `useMemo` to maintain $O(1)$ response time.

---

## 6. Proposed Code Modifications (Diff Patch Proposal)

### Proposed Changes to `src/components/project/ProjectManagementPage.tsx`:

```tsx
// 1. Add imports
import dynamic from 'next/dynamic';
import { Calendar, LayoutGrid, ... } from 'lucide-react';

// 2. Add Skeleton Component for WeeklyScheduler
function WeeklySchedulerSkeleton() {
  return (
    <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-200/60 h-[600px] animate-pulse flex flex-col gap-4">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200">
        <div className="w-48 h-6 bg-slate-200 rounded-lg" />
        <div className="w-36 h-8 bg-slate-200 rounded-xl" />
      </div>
      <div className="grid grid-cols-12 gap-4 flex-1">
        <div className="col-span-3 bg-slate-200/60 rounded-xl h-full" />
        <div className="col-span-9 grid grid-cols-7 gap-2 h-full">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="bg-slate-200/50 rounded-xl h-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

// 3. Dynamic import of WeeklyScheduler
const WeeklyScheduler = dynamic(
  () => import('../dashboard/WeeklyScheduler').then(mod => mod.WeeklyScheduler),
  {
    ssr: false,
    loading: () => <WeeklySchedulerSkeleton />
  }
);

// 4. In ProjectManagementPage component state:
export type ProjectTabType = 'overview' | 'schedule';

export default function ProjectManagementPage() {
  const [activeTab, setActiveTab] = useState<ProjectTabType>('overview');

  // ... (existing code)

  return (
    <div className="flex h-full bg-slate-50/50 p-4 md:p-6 overflow-hidden">
      <div className="flex flex-col md:flex-row w-full max-w-[1700px] mx-auto gap-6 h-full">
        
        {/* Left Column: Project List Sidebar */}
        <div className="w-full md:w-[360px] shrink-0 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-full overflow-hidden">
          {/* Sidebar Header & List (unchanged) */}
        </div>

        {/* Right Column: Project Details Panel */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-full overflow-hidden">
          {selectedProject ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Project Header + Tab Selector Bar */}
              <div className="p-5 border-b border-slate-100 flex flex-col gap-3 shrink-0 bg-slate-50/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span 
                      className="w-3.5 h-3.5 rounded-full shrink-0" 
                      style={{ backgroundColor: selectedProject.color }} 
                    />
                    <h1 className="text-lg font-black text-slate-800 leading-snug">
                      {selectedProject.name}
                    </h1>
                  </div>

                  {/* Tab Navigation Buttons */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
                    <button
                      onClick={() => setActiveTab('overview')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer border-0 ${
                        activeTab === 'overview'
                          ? 'bg-white text-blue-600 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <LayoutGrid size={14} />
                      <span>사업 개요 및 실무</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('schedule')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer border-0 ${
                        activeTab === 'schedule'
                          ? 'bg-white text-blue-600 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Calendar size={14} />
                      <span>일정 플래너</span>
                    </button>
                  </div>
                </div>

                {selectedProject.description && (
                  <p className="text-xs text-slate-500 leading-relaxed max-w-[90%] whitespace-pre-wrap pl-6">
                    {selectedProject.description}
                  </p>
                )}
              </div>

              {/* Tab Content View Switching */}
              {activeTab === 'overview' ? (
                /* Panels split: Left (Attributes & Checklist), Right (Achievements & Tasks) */
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
                  {/* Existing Overview Panels */}
                </div>
              ) : (
                /* Integrated Schedule Planner Tab Content */
                <div className="flex-1 p-5 overflow-y-auto custom-scrollbar">
                  {/* Project Context Banner */}
                  <div className="mb-4 p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-blue-600" />
                      <span className="text-xs font-extrabold text-slate-700">
                        {selectedProject.name} 주간 세부 수행 일정
                      </span>
                    </div>
                    {selectedProject.timeline && (
                      <span className="text-[11px] font-bold text-blue-600">
                        사업 기한: {selectedProject.timeline}
                      </span>
                    )}
                  </div>
                  
                  {/* Dynamically Loaded Weekly Scheduler */}
                  <WeeklyScheduler />
                </div>
              )}

            </div>
          ) : (
            /* Empty State */
          )}
        </div>

      </div>
    </div>
  );
}
```

---

## 7. Verification Method

1. **Static Analysis & Type Checks**:
   `npx tsc --noEmit`
2. **Harness & Rule Compliance**:
   `node scripts/run-harness.js`
3. **Dynamic Hydration Verification**:
   Ensure `WeeklyScheduler` only loads on demand when navigating to the '일정 플래너' tab or asynchronously without SSR mismatch errors.
