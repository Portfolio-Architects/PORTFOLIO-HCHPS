# Handoff Report — Explorer Opt R3

## 1. Observation

During our codebase investigation, we examined the following target files:
- `src/components/dashboard/PortfolioDashboardView.tsx`
- `src/components/dashboard/WeeklyScheduler.tsx`
- `src/components/MindMap3D.tsx`
- `src/components/MindMapInspector.tsx`

Specific observations:
1.  **PortfolioDashboardView (`src/components/dashboard/PortfolioDashboardView.tsx`):**
    *   Lines 89-100:
        ```tsx
        useEffect(() => {
          if (!isMounted || !chartContainerRef.current) return;
          
          const observer = new ResizeObserver((entries) => {
            if (!entries || entries.length === 0) return;
            const { width } = entries[0].contentRect;
            setChartWidth(width);
          });
          
          observer.observe(chartContainerRef.current);
          return () => observer.disconnect();
        }, [isMounted]);
        ```
    *   Lines 371-374:
        ```tsx
        <div className="mt-8 mb-8 flex flex-col gap-8">
          <WeeklyScheduler />
          <ContactsBox />
        </div>
        ```
    *   Lines 7-25: Dynamic loading definitions for `WeeklyScheduler` and `ContactsBox` are configured with `ssr: false` but are rendered immediately when the dashboard mounts without staggered delays.

2.  **WeeklyScheduler (`src/components/dashboard/WeeklyScheduler.tsx`):**
    *   Line 305:
        ```tsx
        export const WeeklyScheduler: React.FC = () => {
        ```
        The export is a plain function component without `React.memo` wrapping.
    *   Lines 517-580: Grid items are generated via inline `.map()` mapping over `daySchedules` to draw schedule items directly without a memoized subcomponent:
        ```tsx
        daySchedules.map((schedule) => {
          const config = getTypeConfig(schedule.type);

          return (
            <div
              key={schedule.id}
              className={`group relative flex flex-col p-2.5 border rounded-xl transition-all duration-200 hover:shadow-xs ${config.bg}`}
              ...
        ```

3.  **MindMap3D (`src/components/MindMap3D.tsx`):**
    *   Lines 41-66: `areMindMap3DPropsEqual` is defined:
        ```tsx
        function areMindMap3DPropsEqual(prevProps: MindMap3DProps, nextProps: MindMap3DProps) { ... }
        ```
    *   Line 70: The component is wrapped in `React.memo` but does **not** specify `areMindMap3DPropsEqual` as the second argument:
        ```tsx
        export const MindMap3D = React.memo(function MindMap3D({ signalKeywords, signalEntries, onRenameCategory, onDeleteCategory, isActive = true }: MindMap3DProps) {
        ```
        This results in shallow comparison of props, forcing re-renders on any change of `signalKeywords` or `signalEntries` references.

4.  **MindMapInspector (`src/components/MindMapInspector.tsx`):**
    *   Line 28:
        ```tsx
        overrides: Record<string, NodeOverride>;
        ```
        The entire overrides dictionary is passed as a prop, causing the inspector to re-render when changes occur to any node on the graph, even if they do not belong to the selected active node.
    *   Lines 58-59:
        ```tsx
        const { tasks = [] } = useTasks();
        const { categories = [], getCategoryStats } = useBudget();
        ```
        These data fetching hooks are directly invoked inside the component, making the component dependent on global task/budget state updates.

---

## 2. Logic Chain

1.  **Dashboard Rendering Pipeline**:
    *   `PortfolioDashboardView` handles container resizing using `ResizeObserver` which sets the `chartWidth` state (Observation 1).
    *   Updating `chartWidth` forces `PortfolioDashboardView` to re-render.
    *   Because `WeeklyScheduler` and `ContactsBox` are imported dynamically but not wrapped in `React.memo` (Observation 2), they re-render from scratch on every parent update, causing CPU stutters.
    *   Moreover, rendering both heavy components concurrently on mount blocks the main thread. Dividing their loading using separate delayed state flags will prevent UI freezes.

2.  **Scheduler Optimization**:
    *   The scheduler lists all schedules in a grid, drawing each schedule item card via inline JSX `.map()` (Observation 2).
    *   Every week transition or typing input triggers a complete rebuild of these schedule item cards.
    *   Extracting these cards into a memoized `ScheduleItem` component ensures cards only re-render if their individual schedule attributes change.

3.  **MindMap Rendering Pipeline**:
    *   `MindMap3D` fails to pass `areMindMap3DPropsEqual` to its `React.memo` container (Observation 3).
    *   As a result, it falls back to a default shallow comparison, forcing the canvas simulation engine and WebGL loops to reload or re-evaluate whenever any parent state changes.
    *   Similarly, `MindMapInspector` re-renders on every customization change due to receiving the entire `overrides` prop (Observation 4).
    *   Isolating these props to only pass the active node's custom configuration (e.g. `overrides[activeNode.id]`) and separating hooks from presentation will block unnecessary rendering cascades.

---

## 3. Caveats

*   We analyzed the code statically using read-only techniques. We assumed the performance spikes and re-rendering lag are directly correlated with these component designs, which is a standard pattern in React virtual DOM optimizations.
*   We did not modify the files, run profile tracing tools in a browser window, or verify the exact frame budget consumption quantitatively, as we are operating under read-only restrictions.

---

## 4. Conclusion

We conclude that the performance bottleneck is caused by a cascade of unnecessary re-renderings due to:
1.  Missing custom prop comparison arguments in `React.memo` for `MindMap3D`.
2.  Unmemoized inline map lists for scheduler cards, contact cards, and inspector panels.
3.  Lack of staggered DOM rendering gates for widgets that load immediately upon dashboard entry.

Our recommended optimizations (detailed in `analysis.md`) will isolate heavy components, restrict rendering dependencies to active nodes, and stagger mounting tasks to achieve a smooth, stutter-free dashboard experience.

---

## 5. Verification Method

To verify these findings and the proposed optimizations:
1.  **Inspect files:**
    *   Confirm line 70 in `src/components/MindMap3D.tsx` is indeed missing the second argument of `React.memo`.
    *   Confirm lines 371-374 in `src/components/dashboard/PortfolioDashboardView.tsx` render `<WeeklyScheduler />` and `<ContactsBox />` synchronously.
2.  **Lint and Build verification:**
    *   Run `npm run lint` and `npm run build` to verify there are no compilation or syntax issues in the target files.
3.  **Harness and Tests:**
    *   Run `npm test` to ensure Jest tests pass successfully before applying any structural refactorings.
