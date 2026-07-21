# Re-render Isolation & Staggered Preloading Analysis (R3)

## Executive Summary
This analysis identifies critical re-rendering bottlenecks in the PORTFOLIO VITAL dashboard and 3D MindMap interfaces. We propose a comprehensive optimization plan utilizing `React.memo`, `useCallback` stability, and a multi-frame staggered preloading sequence to ensure smooth rendering and eliminate main-thread freezing.

---

## 1. Component Re-rendering Analysis & Hotspots

### A. PortfolioDashboardView (`src/components/dashboard/PortfolioDashboardView.tsx`)
*   **ResizeObserver Trigger**: The ResizeObserver (lines 89-100) sets `chartWidth` state on window/container resize. This triggers a full component re-render, forcing child components like `WeeklyScheduler` and `ContactsBox` to re-evaluate and rebuild their DOM subtrees.
*   **State-Driven Re-renders**: Frequent changes to `chartType` ('monthly' | 'cumulative') and project filtering (`selectedProject`) force full layout invalidations.
*   **Dynamic Component Over-evaluation**: While `WeeklyScheduler` and `ContactsBox` are dynamically imported with `ssr: false` to delay page-load weight, they are mounted instantly as soon as the dashboard is displayed. Their simultaneous mounting causes severe UI micro-stutters during entrance animations.

### B. WeeklyScheduler (`src/components/dashboard/WeeklyScheduler.tsx`)
*   **Lack of Main Component Memoization**: The main component is exported as `export const WeeklyScheduler: React.FC = () => { ... }`. It lacks `React.memo`, meaning it re-renders entirely whenever the parent dashboard re-renders.
*   **Inline Grid Item Card Rerenders**: The loop mapping over `weekDays` renders each schedule item card directly inline:
    ```tsx
    daySchedules.map((schedule) => {
      const config = getTypeConfig(schedule.type);
      return (
        <div key={schedule.id} className="...">
          {/* Card Content */}
        </div>
      );
    })
    ```
    Every time any scheduler state changes (e.g. navigating between weeks or typing in the form), all schedule card DOM elements are destroyed and recreated.

### C. MindMap3D (`src/components/MindMap3D.tsx`)
*   **Missing `React.memo` Comparison Function**: The comparison function `areMindMap3DPropsEqual` is defined (lines 41-66) but **NOT** passed as the second argument to `React.memo` (line 70).
    ```tsx
    // Line 70 is:
    export const MindMap3D = React.memo(function MindMap3D({ ... }) { ... })
    ```
    This results in a shallow equality check on props. Since `signalKeywords` is a new object and `signalEntries` is a new array on every parent state update, `MindMap3D` re-renders constantly.
*   **Inline Callback Invalidation**: Event handlers passed to `MindMapInspector` (such as `onRenameCategory` and `onDeleteCategory` from `page.tsx`) have dependency arrays containing `[tasks, updateTask]`. Any task mutation updates these callbacks, bypassing child memoization.

### D. MindMapInspector (`src/components/MindMapInspector.tsx`)
*   **Whole-State Overrides Invalidation**: The inspector receives the entire `overrides` dictionary (`Record<string, NodeOverride>`). When a user updates coordinates or options for *any* node on the 3D canvas, a new `overrides` reference is created, triggering a full inspector re-render even if the currently `activeNode` was untouched.
*   **Direct Hook Dependencies**: The inspector calls `useTasks()` (line 58) and `useBudget()` (line 59) directly. Task/budget updates cause the entire inspector panel (and its heavy sub-components) to re-evaluate.
*   **Inline Mapping Lists**: Suggestions (lines 930-941), autocomplete dropdowns (lines 994-1018), and connection edges (lines 1094-1130) create anonymous onClick callbacks inside the render loops, causing re-renders of list items on every tick.

---

## 2. Memoization & Reference Stability Proposals

### Proposal A: Wrap and Memoize Subcomponents
1.  **Extract `ScheduleCard` / `ScheduleItem`** inside `WeeklyScheduler.tsx`:
    ```tsx
    const ScheduleItem = React.memo(({ schedule, config, onDelete }: { 
      schedule: Schedule; 
      config: any; 
      onDelete: (id: string) => void; 
    }) => {
      return (
        <div className={`group relative flex flex-col p-2.5 border rounded-xl transition-all duration-200 hover:shadow-xs ${config.bg}`}>
          {/* Card JSX */}
        </div>
      );
    });
    ```
2.  **Extract `ContactCard`** inside `ContactsBox.tsx` to prevent keystroke typing lag when entering search keywords:
    ```tsx
    const ContactCard = React.memo(({ contact, onStartEdit, onDelete }: {
      contact: Contact;
      onStartEdit: (c: Contact) => void;
      onDelete: (id: string) => void;
    }) => {
      return (
        <div className="group relative flex flex-col p-4.5 bg-white/40 border border-slate-200/50 hover:border-emerald-500/40 rounded-2xl transition-all duration-200">
          {/* Card JSX */}
        </div>
      );
    });
    ```
3.  **Correct `MindMap3D.tsx` Memoization**:
    Update the component export to include the comparison function:
    ```tsx
    export const MindMap3D = React.memo(MindMap3DComponent, areMindMap3DPropsEqual);
    ```

### Proposal B: Localize State and Stabilize Props
1.  **Props Isolator for `MindMapInspector`**:
    Instead of passing the entire `overrides` dictionary, pass only the override values specific to the `activeNode.id`:
    ```tsx
    // Inside MindMap3D.tsx
    const activeNodeOverride = useMemo(() => {
      return activeNode ? overrides[activeNode.id] : undefined;
    }, [activeNode, overrides]);
    ```
    Modify `MindMapInspectorProps` to receive `activeNodeOverride` instead of `overrides`.
2.  **Separate UI View from Data Queries**:
    Extract task/budget data fetch calls out of `MindMapInspector` into the parent module view. Pass only pre-filtered/sliced arrays (like `matchedTasks` and `catStats`) to a lightweight inspector content presentation component.

---

## 3. Staggered Loading & Deferred Rendering Design

To prevent entrance lag spikes and layout freezes on page load, we recommend wrapping heavy DOM components with staggered rendering gates that queue mounting tasks over multiple animation frames.

### Structuring Staggered Initialization inside `PortfolioDashboardView.tsx`

#### Before:
```tsx
export function PortfolioDashboardView(...) {
  return (
    <div className="...">
      {/* ... Left/Right panels ... */}
      <div className="mt-8 mb-8 flex flex-col gap-8">
        <WeeklyScheduler />
        <ContactsBox />
      </div>
    </div>
  );
}
```

#### After (Proposed Structure):
```tsx
export function PortfolioDashboardView({ budgetCategories, budgetEntries, appMode = 'VITAL' }: DashboardProps) {
  // ... existing states ...
  const [renderScheduler, setRenderScheduler] = useState(false);
  const [renderContacts, setRenderContacts] = useState(false);

  useEffect(() => {
    // 1. Let main grid layout and charts paint first in Frame 1
    const schedulerTimer = setTimeout(() => {
      setRenderScheduler(true);
    }, 120); // Mount scheduler in Frame 8-10

    // 2. Delay contacts box mount to Frame 20+
    const contactsTimer = setTimeout(() => {
      setRenderContacts(true);
    }, 280);

    return () => {
      clearTimeout(schedulerTimer);
      clearTimeout(contactsTimer);
    };
  }, []);

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300 relative min-h-screen font-sans">
      {/* ... Main Panels ... */}
      
      <div className="mt-8 mb-8 flex flex-col gap-8">
        {renderScheduler ? (
          <WeeklyScheduler />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 gap-4 glass-panel rounded-[2rem] p-8 shadow-2xs border border-white/20 h-[300px] animate-pulse">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-650"></div>
            <p className="text-sm text-slate-500 font-bold">주간 일정을 순차 로딩하는 중...</p>
          </div>
        )}
        
        {renderContacts ? (
          <ContactsBox />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 gap-4 glass-panel rounded-[2rem] p-8 shadow-2xs border border-white/20 h-[250px] animate-pulse">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-650"></div>
            <p className="text-sm text-slate-500 font-bold">주소록 위젯을 순차 로딩하는 중...</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Staggering MindMap3D Canvas Engine Initializations

Within `MindMap3D.tsx`, we can delay the activation of the Heavy Canvas Engine loops:
```tsx
const [engineActive, setEngineActive] = useState(false);

useEffect(() => {
  if (!isActive) {
    setEngineActive(false);
    return;
  }
  
  // Stagger engine canvas bootstrap by 150ms to allow tab transitions to complete smoothly
  const timer = setTimeout(() => {
    setEngineActive(true);
  }, 150);
  
  return () => clearTimeout(timer);
}, [isActive]);

// Run the initialization code and loops only when engineActive is true
```
This isolates the canvas canvas compilation and physics thread startup from tab swipe transactions.
