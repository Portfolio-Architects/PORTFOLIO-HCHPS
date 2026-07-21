# R1 Requirement Analysis Report: Top-Level Hook Scoping & Conditional Computing in `ProtectedApp` (`src/app/page.tsx`)

## Executive Summary
This analysis evaluates top-level React hooks called within `ProtectedApp` in `src/app/page.tsx`, focusing on computational efficiency, signal extraction performance, conditional hook execution, state flow, and data freshness guarantees.

Key Findings:
1. **Unconditional Signal Extraction Overhead**: `useMergedSignals` processes keyword extraction (`extractKeywords`) and sorting across all Tasks, Projects, Meetings, Budget Entries, and Inventory Items on **every single state change**, even when the MindMap tab is inactive and the AI Assistant modal is closed.
2. **Conditional Activation Safety**: Adding an `enabled` flag (`isSignalsNeeded = activeModule === 'mindmap' || isQuickInputOpen`) to `useMergedSignals` eliminates 100% of background keyword extraction during standard navigation while guaranteeing zero stale data when switching tabs or opening the AI Assistant.
3. **Double Call of `useGraphCustomization`**: `useGraphCustomization` is called in both `ProtectedApp` (`src/app/page.tsx:377`) and `MindMap3D` (`MindMap3D.tsx:184`). Its internal `enabled` flag correctly manages global watcher polling counters (`activePollCount`), stopping 10s background timers when MindMap is inactive.
4. **State Flow**: Top-level module navigation is managed by `activeModule` (`ModuleType`) and `visitedModules` (DOM retention + CSS toggle). Sub-views manage internal tab states (e.g. `WorkspaceView`'s `activeTab`).

---

## 1. Top-Level Hook Inventory in `ProtectedApp` (`src/app/page.tsx`)

`ProtectedApp` (lines 355–767) calls **32 hook instances**:

| Hook Category | Hook Name | Purpose | Scope / Condition |
|---|---|---|---|
| State | `useState<ModuleType>('dashboard')` | Active module selection (`activeModule`) | Top-level |
| State | `useState<Record<ModuleType, boolean>>(...)` | Lazy mount & DOM retention tracker | Top-level |
| State | `useState(false)` (x2) | Quick input modal (`isQuickInputOpen`), Log modal (`isLogsOpen`) | Top-level UI |
| State | `useState<number \| null>(null)` | AI button bottom position offset | Responsive UI |
| Data | `useTasks()` | React Query tasks fetcher & mutations | Top-level SSOT |
| Data | `useBudget()` | React Query budget categories & entries | Top-level SSOT |
| Data | `useInventory()` | React Query inventory items & stock | Top-level SSOT |
| Data | `useMeetings()` | React Query meetings list | Top-level SSOT |
| Data | `useProjects()` | React Query projects list | Top-level SSOT |
| Data | `useSignal()` | Signals & keyword map storage | Top-level SSOT |
| Background | `useScheduleAlerts(tasks, meetings)` | Calculates urgent/overdue schedule alerts | Top-level (Active across all tabs) |
| Background | `useNotificationAlerts(scheduleAlerts)` | Triggers browser notifications | Top-level (Active across all tabs) |
| Heavy Processing | `useMergedSignals(...)` | Combines & extracts keywords across 5 data domains | **Unconditional** (Needs scoping) |
| Heavy Processing | `useGraphCustomization(activeModule === 'mindmap')` | Yjs CRDT & Cloud sync for MindMap | **Conditional** (`enabled` flag passed) |
| Memoization | `useMemo` (`actualBudgetEntries`) | Filters non-planned budget entries | Derived state |
| Memoization | `useMemo` (`aiContextData`) | Packages context for AIAssistantModal | Derived state |
| Callbacks | `useCallback` (x8) | Event handlers & preloader | Stable references |
| Effects | `useEffect` (x4) | Tombstone sync, title, footer observer, wiki listener | Side effects |
| Refs | `useRef` (x2) | Touch swipe coordinates | UI interaction |

---

## 2. State Scoping & Passing (`activeModule` vs `activeTab`)

### Top-Level Module Routing (`activeModule`)
- **State Declaration**: `const [activeModule, setActiveModule] = useState<ModuleType>('dashboard');` where `ModuleType = 'dashboard' | 'mindmap' | 'workspace' | 'project'`.
- **Module Visiting/Caching**: `visitedModules` (`Record<ModuleType, boolean>`) keeps modules mounted once visited:
  ```tsx
  {visitedModules.mindmap && (
    <div className={activeModule === 'mindmap' ? 'block' : 'hidden'}>
      <MindMap3D ... isActive={activeModule === 'mindmap'} />
    </div>
  )}
  ```
- **Passed to Components**:
  - `Sidebar`: receives `activeModule` and `onModuleChange`.
  - `MindMap3D`: receives `isActive={activeModule === 'mindmap'}`.
  - `PortfolioDashboardView`, `WorkspaceView`, `ProjectManagementPage`: rendered conditionally inside CSS hidden wrappers.

### Child Tab Routing (`activeTab`)
- Sub-components manage their own internal tab states (e.g. `WorkspaceView.tsx:50` manages `activeTab = 'budget' | 'inventory'`).
- UI Store (`src/store/ui-store.ts`) holds global UI defaults.

---

## 3. Analysis of `useMergedSignals` & `useGraphCustomization`

### Call Sites
1. **`useMergedSignals`**:
   - `src/app/page.tsx:376`: Called once at the top level of `ProtectedApp`.
   - **No other call sites exist** in the repository.
2. **`useGraphCustomization`**:
   - `src/app/page.tsx:377`: `useGraphCustomization(activeModule === 'mindmap')`
   - `src/components/MindMap3D.tsx:184`: `useGraphCustomization(isActive)`
   - Referenced for types/utilities in `MindMapInspector.tsx`, `useGlobalSearch.ts`, `useWikiStorage.ts`, and `signal-graph.ts`.

### Heavy Computation Analysis in `useMergedSignals`
Inside `src/hooks/useMergedSignals.ts`:
1. `mergedKeywordMap`:
   - Calls `extractKeywords` on all `tasks` (title + description), `projects` (name + description + checklist), `meetings` (title + agenda + notes), `budgetEntries` (purpose + memo), and `inventoryItems` (name + category).
   - Stemming (`stripSuffix`), stop-word filtering, regex sanitization across hundreds of strings.
2. `mergedEntries`:
   - Builds individual signal entries for all 5 domains and sorts the combined array by `createdAt` date descending.

**Current Issue**:
`useMergedSignals` runs this keyword extraction and sorting on **every render** whenever tasks, budget entries, or inventory items change—even when the user is on the Dashboard tab with the AI Assistant modal closed.

### Performance Impact of `useGraphCustomization`
- `useGraphCustomization` receives `enabled = activeModule === 'mindmap'`.
- Internal logic (`useGraphCustomization.ts:703`):
  ```ts
  useEffect(() => {
    if (!enabled || !isCloudLoaded) return;
    activePollCount++;
    ...
  }, [enabled, isCloudLoaded]);
  ```
- When `enabled` is `false`, 10-second cloud polling is paused and `activePollCount` drops to 0. Yjs local store subscriptions remain active via `useSyncExternalStore` (16ms debounced).

---

## 4. Signal Extraction Logic & `aiContextData` Optimization

### Proposed `enabled` Flag for `useMergedSignals`
Modify `useMergedSignals` signature to accept an optional `enabled: boolean = true`:

```ts
export function useMergedSignals(
  signalEntries: SignalEntry[],
  keywordMap: Record<string, number>,
  tasks: Task[],
  projects: Project[],
  meetings: Meeting[],
  budgetEntries: BudgetEntry[],
  inventoryItems: InventoryItem[],
  enabled: boolean = true
) {
  const EMPTY_KEYWORD_MAP = useMemo<Record<string, number>>(() => ({}), []);
  const EMPTY_ENTRIES = useMemo<SignalEntry[]>(() => [], []);

  const mergedKeywordMap = useMemo(() => {
    if (!enabled) return EMPTY_KEYWORD_MAP;
    // ... keyword extraction loop ...
  }, [enabled, keywordMap, tasks, projects, meetings, budgetEntries, inventoryItems]);

  const mergedEntries = useMemo(() => {
    if (!enabled) return EMPTY_ENTRIES;
    // ... entry building & sorting loop ...
  }, [enabled, signalEntries, tasks, projects, meetings, budgetEntries, inventoryItems]);

  return { mergedKeywordMap, mergedEntries };
}
```

In `ProtectedApp` (`src/app/page.tsx`):
```tsx
const isSignalsNeeded = activeModule === 'mindmap' || isQuickInputOpen;
const { mergedKeywordMap, mergedEntries } = useMergedSignals(
  signalEntries,
  keywordMap,
  tasks,
  projects,
  meetings,
  budgetEntries,
  inventoryItems,
  isSignalsNeeded
);
```

### `aiContextData` Optimization
When `isSignalsNeeded` is `false`:
- `mergedEntries` is `EMPTY_ENTRIES` (`[]`).
- `mergedKeywordMap` is `EMPTY_KEYWORD_MAP` (`{}`).
- `aiContextData` memoization (`useMemo`) dependencies do not trigger re-computation when background tasks or budget items update.
- When `isQuickInputOpen` becomes `true` (user clicks AI Assistant), `isSignalsNeeded` becomes `true`, immediately computing complete context data.

---

## 5. Data Freshness & Stale Data Prevention Verification

### Mechanism of Zero-Stale-Data Guarantee
1. **Source Data SSOT**: All primary datasets (`tasks`, `projects`, `meetings`, `budgetEntries`, `inventoryItems`) are held at the top level of `ProtectedApp` via React Query hooks. They update continuously regardless of active tab.
2. **Synchronous `useMemo` Re-evaluation**: When `isSignalsNeeded` switches from `false` to `true` (user clicks MindMap tab or opens AI Assistant):
   - React schedules a re-render of `ProtectedApp`.
   - `useMemo` detects `enabled` changed from `false` to `true`.
   - `useMemo` executes synchronously during that render pass, reading the **current, up-to-date** `tasks`, `projects`, `meetings`, `budgetEntries`, `inventoryItems` from React state.
   - The resulting `mergedKeywordMap`, `mergedEntries`, and `aiContextData` are 100% up to date before the browser paints the frame.
3. **No Cache Invalidation Risks**: Because React's dependency array includes `[enabled, signalEntries, keywordMap, tasks, projects, meetings, budgetEntries, inventoryItems]`, any change during inactive states is captured immediately upon re-activation.

---

## 6. Implementation Strategy (Proposed Patch)

### Proposed File Modifications

#### A. `src/hooks/useMergedSignals.ts`
- Add `enabled: boolean = true` as 8th parameter.
- Wrap keyword extraction and entry mapping in `if (!enabled) return EMPTY_...`.
- Add `enabled` to `useMemo` dependency arrays.

#### B. `src/app/page.tsx`
- Define `isSignalsNeeded`:
  `const isSignalsNeeded = activeModule === 'mindmap' || isQuickInputOpen;`
- Pass `isSignalsNeeded` to `useMergedSignals`.

---

## Conclusion
Scoping `useMergedSignals` with `isSignalsNeeded = activeModule === 'mindmap' || isQuickInputOpen` completely eliminates CPU-intensive text parsing and sorting during standard app navigation while guaranteeing complete data freshness when switching to the MindMap tab or opening the AI Assistant.
