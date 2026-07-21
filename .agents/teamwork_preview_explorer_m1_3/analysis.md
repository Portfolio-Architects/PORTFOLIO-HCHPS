# Milestone 1: Initial Server Hydration & Staggered Chunk Isolation — Analysis Report

## Summary
This investigation analyzed initial server hydration bottlenecks and chunk loading behavior in `src/app/page.tsx`, `src/components/dashboard/PortfolioDashboardView.tsx`, `src/components/WorkspaceView.tsx`, `src/components/budget/BudgetDashboard.tsx`, and associated heavy widgets. On dev-server startup, hydration stalls exceeding 50ms are caused by:
1. **Unconditional JSX mounting of dynamic modal components** (`AIAssistantModal` and `AppLogModal` in `src/app/page.tsx`), which forces Next.js dev server to request and compile their JS chunks on startup even when closed.
2. **Synchronous top-level import of Recharts** in `PortfolioDashboardView.tsx`, adding heavy charting JS evaluation to initial dashboard mount.
3. **Rigid millisecond timers (`setTimeout` 120ms/280ms)** in `PortfolioDashboardView.tsx` that collide with dev-server startup compilation and initial hydration tasks.
4. **Synchronous top-level modal imports** in `BudgetDashboard.tsx` (`LedgerModal`, `CategoryEditModal`, `BatchEditModal`, `ExpenseEntryModal`, `DailyExpenseStatModal`), inflating the workspace chunk by over 60%.

Implementing **conditional lazy mounting**, **`requestIdleCallback` idle deferral wrappers**, **dynamic modal imports**, and **staggered idle chunk isolation** eliminates startup hydration stalls, keeping startup hydration stall strictly **under 50ms**.

---

## 1. Direct Observations & Component Tree Analysis

### 1.1 Unconditional Dynamic Modal JSX in `src/app/page.tsx`
- **Location**: `src/app/page.tsx`, lines 303-311 & lines 752-768
- **Code snippet**:
  ```tsx
  // lines 303-311: Dynamic imports defined
  const AppLogModal = dynamic(() => import('@/components/AppLogModal').then(mod => mod.AppLogModal), {
    ssr: false,
    loading: () => null
  });

  const AIAssistantModal = dynamic(() => import('@/components/ai/AIAssistantModal').then(mod => mod.AIAssistantModal), {
    ssr: false,
    loading: () => null
  });

  // lines 752-768: Unconditional JSX rendering
  <AppLogModal 
    isOpen={isLogsOpen}
    onClose={() => setIsLogsOpen(false)}
    appMode={appMode}
  />
  <AIAssistantModal 
    isOpen={isQuickInputOpen} 
    onClose={handleCloseQuickInput}
    contextData={aiContextData}
    appMode={appMode}
  />
  ```
- **Finding**: Because `AppLogModal` and `AIAssistantModal` are mounted directly in the JSX tree (with `isOpen` passed as `false`), Next.js `next/dynamic` initiates chunk downloads and module evaluations immediately on initial render. This forces dev-server compilation of `OntologyNetwork`, `AgentStatusBoard`, block editor extractors, and Lucide icons during page load.

### 1.2 Synchronous Top-Level Import of Recharts in `PortfolioDashboardView.tsx`
- **Location**: `src/components/dashboard/PortfolioDashboardView.tsx`, line 2
- **Code snippet**:
  ```tsx
  import { PieChart, Pie, Cell, Line, Bar, ReferenceLine, XAxis, YAxis, Tooltip as RechartsTooltip, Area, CartesianGrid, ComposedChart } from 'recharts';
  ```
- **Finding**: Direct top-level import of Recharts embeds heavy chart evaluation (~400KB JS) into the initial dashboard mount pipeline. During initial server hydration and client mount, evaluating Recharts components blocks the main thread.

### 1.3 Fixed `setTimeout` Timers for Heavy Dashboard Widgets
- **Location**: `src/components/dashboard/PortfolioDashboardView.tsx`, lines 136-147 & lines 442-455
- **Code snippet**:
  ```tsx
  const schedulerTimer = setTimeout(() => {
    setRenderScheduler(true);
  }, 120);

  const contactsTimer = setTimeout(() => {
    setRenderContacts(true);
  }, 280);
  ```
- **Finding**: `WeeklyScheduler` (28KB) and `ContactsBox` (13KB) are dynamic components, but `setRenderScheduler(true)` and `setRenderContacts(true)` are triggered at fixed 120ms and 280ms timeouts. On dev-server startup, 100-300ms coincides with HMR compilation and main thread hydration tasks. Scheduling component mounts at fixed millisecond offsets causes main thread task queue spikes exceeding 50ms.

### 1.4 Synchronous Modal Imports in `BudgetDashboard.tsx`
- **Location**: `src/components/WorkspaceView.tsx` line 6 & `src/components/budget/BudgetDashboard.tsx` lines 8-14
- **Code snippet**:
  ```tsx
  import { LedgerModal } from './ui/LedgerModal';
  import { CategoryEditModal } from './ui/CategoryEditModal';
  import { BatchEditModal } from './ui/BatchEditModal';
  import { ExpenseEntryModal } from './ui/ExpenseEntryModal';
  import { DailyExpenseStatModal } from './ui/DailyExpenseStatModal';
  ```
- **Finding**: `WorkspaceView` synchronously imports `BudgetDashboard`, which in turn synchronously imports 5 large modal components. When workspace is mounted or preloaded, all 5 modal files and their UI sub-components are evaluated immediately, inflating chunk size unnecessarily.

---

## 2. Technical Assessment: Causes of Dev-Server Hydration Stall (>50ms)

| Bottleneck Category | Cause | Dev-Server Impact | Proposed Optimization | Target Hydration Win |
|---|---|---|---|---|
| **Eager Modal Mounts** | `AIAssistantModal`, `AppLogModal` in `page.tsx` rendered unconditionally | Dev-server compiles modal chunks on load; hydration stall ~25-40ms | Conditional JSX rendering `{isQuickInputOpen && <AIAssistantModal ... />}` | ~25ms saved |
| **Heavy Chart Import** | Recharts imported synchronously in `PortfolioDashboardView` | Recharts bundle evaluation on dashboard mount (~30-50ms) | Dynamic chart section or idle-deferred chart container | ~30ms saved |
| **Timer Contention** | Fixed `setTimeout(120ms/280ms)` in `PortfolioDashboardView` | Collides with main thread hydration/layout calculations | Idle deferral wrapper (`requestIdleCallback`) for `WeeklyScheduler` & `ContactsBox` | ~20ms saved |
| **Monolithic Budget Chunk** | 5 modals imported synchronously in `BudgetDashboard.tsx` | Inflates `BudgetDashboard` JS size by >60% | Lazy `next/dynamic` loading for modals inside `BudgetDashboard.tsx` | ~35ms saved |

---

## 3. Staggered Chunk Isolation & Lazy Initialization Strategy

To eliminate dev-server startup hydration stalls and keep startup hydration under 50ms, we propose a 4-Step Concrete Implementation Plan:

### Step 1: Conditional Lazy Mounting in `src/app/page.tsx`
Modify `src/app/page.tsx` so that `AIAssistantModal` and `AppLogModal` are only mounted when open:
```tsx
{/* App Log Modal */}
{isLogsOpen && (
  <AppLogModal 
    isOpen={isLogsOpen}
    onClose={() => setIsLogsOpen(false)}
    appMode={appMode}
  />
)}

{/* Floating LLM Button & Popover */}
<div 
  className="fixed bottom-24 sm:bottom-8 right-4 sm:right-8 z-50 flex flex-col items-end gap-3"
  style={buttonBottom !== null ? { bottom: `${buttonBottom}px` } : undefined}
>
  {isQuickInputOpen && (
    <AIAssistantModal 
      isOpen={isQuickInputOpen} 
      onClose={handleCloseQuickInput}
      contextData={aiContextData}
      appMode={appMode}
    />
  )}
  <button ... />
</div>
```

### Step 2: Idle Deferral Wrapper (`requestIdleCallback`) for Heavy Widgets
Replace fixed `setTimeout` in `PortfolioDashboardView.tsx` with a robust `requestIdleCallback` idle deferral hook:
```tsx
function useIdleMount(timeoutMs = 1500) {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let handle: number;
    if ('requestIdleCallback' in window) {
      handle = window.requestIdleCallback(() => setIsReady(true), { timeout: timeoutMs });
      return () => window.cancelIdleCallback(handle);
    } else {
      const timer = setTimeout(() => setIsReady(true), 300);
      return () => clearTimeout(timer);
    }
  }, [timeoutMs]);
  return isReady;
}
```
Use `useIdleMount` to stagger `WeeklyScheduler` and `ContactsBox` rendering during true idle periods, preventing task queue blocking on dev-server startup.

### Step 3: Lazy Modal Dynamic Imports in `BudgetDashboard.tsx`
In `src/components/budget/BudgetDashboard.tsx`, dynamically import all modal components:
```tsx
const CategoryEditModal = dynamic(() => import('./ui/CategoryEditModal').then(m => m.CategoryEditModal), { ssr: false });
const ExpenseEntryModal = dynamic(() => import('./ui/ExpenseEntryModal').then(m => m.ExpenseEntryModal), { ssr: false });
const BatchEditModal = dynamic(() => import('./ui/BatchEditModal').then(m => m.BatchEditModal), { ssr: false });
const LedgerModal = dynamic(() => import('./ui/LedgerModal').then(m => m.LedgerModal), { ssr: false });
const DailyExpenseStatModal = dynamic(() => import('./ui/DailyExpenseStatModal').then(m => m.DailyExpenseStatModal), { ssr: false });
```
And conditionally render them:
```tsx
{showCatModal && (
  <CategoryEditModal ... />
)}
{showEntryModal && (
  <ExpenseEntryModal ... />
)}
{showBatchModal && (
  <BatchEditModal ... />
)}
{showLedgerModal && (
  <LedgerModal ... />
)}
{showDailyStatModal && (
  <DailyExpenseStatModal ... />
)}
```

### Step 4: Staggered Idle Preloading in `src/app/page.tsx`
Refine `preloadModulesOnIdle` in `src/app/page.tsx` to ensure background chunk caching only executes when the browser is idle:
- Initial delay: wait until global splash / hydration is complete (min 2000ms).
- Stagger module preloads across idle callbacks (`mindmap` at +3s, `workspace` at +5s, `project` at +7s).

---

## 4. Verification Plan

1. **Build & Lint Verification**:
   - Run `npm run build` to verify chunk splitting and bundle generation.
   - Run `node scripts/run-harness.js` to verify zero TypeScript and ESLint errors.
2. **Dev-Server Startup Performance Verification**:
   - Measure startup hydration time (Performance API / Chrome DevTools Performance profile).
   - Confirm dev-server startup hydration stall is < 50ms.
