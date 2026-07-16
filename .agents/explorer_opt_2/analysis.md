# Milestone 3 Analysis: Tab Switching UI Freeze Prevention and Rendering Optimization

## Summary
The application manages tab states using a keep-alive strategy (storing visited modules in DOM with `hidden` class), which causes hidden views to continuously re-render when parent state updates. Applying `React.memo` with custom comparison functions that bypass hidden views, combined with memoizing unstable event handlers like `startEdit` in `ContactsBox`, will prevent UI freeze and optimize rendering.

---

## 1. Active Tab States and Module Rendering Analysis
In `src/app/page.tsx`, the `ProtectedApp` component manages module state using:
- `activeModule` (`useState<ModuleType>('dashboard')`): Stores the currently visible tab.
- `visitedModules` (`useState<Record<ModuleType, boolean>>`): Tracks which modules have been visited.

### Rendering Method
Tabs are mounted lazily but kept alive in the DOM using CSS visibility toggle:
```tsx
{visitedModules.dashboard && (
  <div className={activeModule === 'dashboard' ? 'block' : 'hidden'}>
    <PortfolioDashboardView ... />
  </div>
)}
```
### Performance Impact
Because these views remain mounted in the DOM, any state update in `ProtectedApp` (e.g. periodic tickers, global search updates, or switching the active tab itself) triggers a full virtual DOM reconciliation and re-rendering of all hidden views, leading to visible frames dropping (UI freeze) during transitions.

---

## 2. Bypassing Hidden Tab Re-renders
To prevent hidden views from executing expensive rendering or processing when they are not visible:
1. **Pass `isActive` status as a prop** to each tab-level view:
   - `PortfolioDashboardView`: `isActive={activeModule === 'dashboard'}`
   - `WorkspaceView`: `isActive={activeModule === 'workspace'}`
   - `MindMap3D`: `isActive={activeModule === 'mindmap'}` (already receives `isActive={activeModule === 'mindmap'}`)
2. **Utilize `React.memo` with a custom comparison function**:
   - If `prevProps.isActive !== nextProps.isActive`, allow re-rendering to toggle CSS visibility.
   - If `!nextProps.isActive`, return `true` (skip rendering) to freeze/isolate the component while hidden.
   - If the component is active, perform normal shallow comparison of relevant data dependencies.

---

## 3. React.memo & Custom Comparison Functions

### A. PortfolioDashboardView
- **Current State**: Imported dynamically without wrapper.
- **Proposed Optimization**: Wrap the exported component in `React.memo`:
```tsx
export const PortfolioDashboardView = React.memo(
  function PortfolioDashboardView({ isActive = true, tasks, budgetCategories, budgetEntries, appMode = 'VITAL' }: DashboardProps) {
    // ...
  },
  (prev, next) => {
    if (prev.isActive !== next.isActive) return false;
    if (!next.isActive) return true; // Freeze when hidden
    return (
      prev.appMode === next.appMode &&
      prev.tasks === next.tasks &&
      prev.budgetCategories === next.budgetCategories &&
      prev.budgetEntries === next.budgetEntries
    );
  }
);
```

### B. WorkspaceView
- **Current State**: Imported dynamically without wrapper.
- **Proposed Optimization**: Wrap in `React.memo`:
```tsx
export const WorkspaceView = React.memo(
  function WorkspaceView(props: WorkspaceViewProps) {
    // ...
  },
  (prev, next) => {
    if (prev.isActive !== next.isActive) return false;
    if (!next.isActive) return true; // Freeze when hidden
    return (
      prev.budgetCategories === next.budgetCategories &&
      prev.budgetEntries === next.budgetEntries &&
      prev.inventoryItems === next.inventoryItems &&
      prev.overallStats === next.overallStats
    );
  }
);
```

### C. ContactsBox
- **Current State**: Wrapped in a standard dynamic import, but not memoized.
- **Proposed Optimization**: Wrap `ContactsBox` in `React.memo(ContactsBox)`. Since it takes no props, the default memoization prevents all re-renders caused by parent changes, as long as internal event handlers are properly memoized.

---

## 4. React.useCallback and useMemo Optimizations

### A. ContactsBox Callback Instability (Crucial Fix)
- **Problem**: `startEdit` in `ContactsBox.tsx` (line 97) is an inline function. Since it is passed to `ContactCard` (`onStartEdit`), it changes reference on every render. Because of this, the `React.memo` on `ContactCard` is completely broken. Every keystroke in the form inputs causes every contact card to re-render.
- **Proposed Fix**: Wrap `startEdit` in `useCallback`:
```tsx
const startEdit = useCallback((contact: Contact) => {
  setEditingContactId(contact.id);
  setName(contact.name);
  setPhone(contact.phone);
  setEmail(contact.email || '');
  setNotes(contact.notes || '');
  setError(null);
}, []);
```
- **Other handlers**: Wrap `handleCancelEdit` and `handleSubmit` in `useCallback`.

### B. Stable Callbacks from Custom Hooks
- **Verification**: Hook functions returned by `useBudget` (e.g. `addCategory`, `addEntry`) and `useInventory` (e.g. `addItem`, `updateItem`) are already properly memoized with `useCallback` inside their respective hooks, making them safe to pass down as dependencies.

---

## 5. Expensive Filters in ContactsBox
- **Current State**:
  - `filteredContacts` is memoized:
    ```tsx
    const filteredContacts = useMemo(() => { ... }, [contacts, searchTerm]);
    ```
  - `searchTerm` is debounced from `localSearchTerm` with a `150ms` delay to prevent triggering filters on every keypress during IME composition.
- **Verdict**: The filter logic is clean and properly debounced. The lag in `ContactsBox` is primarily caused by **render cascades** resulting from the unstable `startEdit` callback, which triggers virtual DOM updates on all `ContactCard` elements during typing. Stabilizing `startEdit` resolves this performance bottleneck.
