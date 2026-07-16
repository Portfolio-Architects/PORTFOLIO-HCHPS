# Milestone 3 Analysis Report: Tab Switching UI Freeze Prevention and Rendering Optimization

## 1. Overview
This report presents the diagnostic findings and optimization strategies for **Milestone 3 (Tab Switching UI Freeze Prevention and Rendering Optimization)**. The investigation covers component rendering behavior, state updates, handler memoization, and list filtering in the main views (`PortfolioDashboardView`, `WorkspaceView`, and `ContactsBox`) controlled under `ProtectedApp` in `src/app/page.tsx`.

---

## 2. Active Tab State & Module Rendering Analysis
**Target File**: `src/app/page.tsx` (`ProtectedApp` component)

### Current Mechanism
* Active tabs are tracked in state via:
  ```typescript
  const [activeModule, setActiveModule] = useState<ModuleType>('dashboard');
  ```
* Visited tabs are cached in state to preserve their DOM state:
  ```typescript
  const [visitedModules, setVisitedModules] = useState<Record<ModuleType, boolean>>({
    dashboard: true,
    mindmap: false,
    workspace: false,
    law: false,
  });
  ```
* Visited tabs remain mounted in the DOM, toggling visibility based on CSS classes:
  ```tsx
  {/* Dashboard */}
  {visitedModules.dashboard && (
    <div className={activeModule === 'dashboard' ? 'block' : 'hidden'}>
      <PortfolioDashboardView tasks={tasks} budgetCategories={budgetCategories} budgetEntries={budgetEntries} onLogout={handleLogout} appMode={appMode} />
    </div>
  )}

  {/* Workspace (Budget Management) */}
  {visitedModules.workspace && (
    <div className={activeModule === 'workspace' ? 'block' : 'hidden'}>
      <WorkspaceView ... />
    </div>
  )}
  ```

### Performance Defect
* Setting wrapper `div` components to `hidden` (`display: none`) conceals them visually but **keeps them fully mounted in the React component tree**.
* Consequently, when any state change causes `ProtectedApp` to re-render (e.g., scroll calculations, timer notifications, search modal toggles, or data queries updating), React performs a complete virtual DOM traversal and rendering pass on **all visited tabs, even if they are hidden**.
* Neither `PortfolioDashboardView` nor `WorkspaceView` are memoized, so they execute their entire rendering logic, invoke custom hooks (like `usePortfolioAnalytics`), map large arrays, and force subcomponents (like `ContactsBox`) to re-render, leading to substantial UI freeze/stutter during tab switching and normal interaction.

---

## 3. Hidden Tab Freeze Strategy
To prevent hidden tab views from running expensive logic or re-rendering:
1. **Pass `isActive` to each view**:
   * `PortfolioDashboardView`: `isActive={activeModule === 'dashboard'}`
   * `WorkspaceView`: `isActive={activeModule === 'workspace'}`
2. **Apply `React.memo` with a custom comparison function**:
   * If both `prevProps.isActive` and `nextProps.isActive` are `false`, the tab is hidden and remains hidden. The component should skip rendering entirely and return `true` from the comparison function.
   * If `isActive` transitions (either `true -> false` or `false -> true`), return `false` to let React perform a single rendering cycle to mount/unmount or show/hide the view cleanly.
   * This effectively "freezes" background tabs, blocking all internal computations when other parts of the application update.

---

## 4. Component Memoization & Custom Comparison Functions

### A. `PortfolioDashboardView` Memoization
* **File**: `src/components/dashboard/PortfolioDashboardView.tsx`
* **Props interface extension**:
  ```typescript
  interface DashboardProps {
    tasks: Task[];
    budgetCategories: BudgetCategory[];
    budgetEntries: BudgetEntry[];
    onLogout?: () => void;
    appMode?: 'HCHPS' | 'VITAL';
    isActive?: boolean; // New prop
  }
  ```
* **Memoized Export Pattern**:
  ```typescript
  export const PortfolioDashboardView = React.memo(
    PortfolioDashboardViewComponent,
    (prevProps, nextProps) => {
      // 1. Skip re-render if hidden and staying hidden
      if (!prevProps.isActive && !nextProps.isActive) {
        return true;
      }
      // 2. Re-render if transition happens (show/hide)
      if (prevProps.isActive !== nextProps.isActive) {
        return false;
      }
      // 3. Otherwise, check standard prop references
      return (
        prevProps.appMode === nextProps.appMode &&
        prevProps.onLogout === nextProps.onLogout &&
        prevProps.tasks === nextProps.tasks &&
        prevProps.budgetCategories === nextProps.budgetCategories &&
        prevProps.budgetEntries === nextProps.budgetEntries
      );
    }
  );
  ```

### B. `WorkspaceView` Memoization
* **File**: `src/components/WorkspaceView.tsx`
* **Props interface extension**:
  ```typescript
  interface WorkspaceViewProps {
    // ...existing props...
    isActive?: boolean; // New prop
  }
  ```
* **Memoized Export Pattern**:
  ```typescript
  export const WorkspaceView = React.memo(
    WorkspaceViewComponent,
    (prevProps, nextProps) => {
      // 1. Skip re-render if hidden and staying hidden
      if (!prevProps.isActive && !nextProps.isActive) {
        return true;
      }
      // 2. Re-render if transition happens
      if (prevProps.isActive !== nextProps.isActive) {
        return false;
      }
      // 3. Compare standard data array and function prop references
      return (
        prevProps.budgetCategories === nextProps.budgetCategories &&
        prevProps.budgetEntries === nextProps.budgetEntries &&
        prevProps.inventoryItems === nextProps.inventoryItems &&
        prevProps.overallStats === nextProps.overallStats &&
        prevProps.addCategory === nextProps.addCategory &&
        prevProps.updateCategory === nextProps.updateCategory &&
        prevProps.deleteCategory === nextProps.deleteCategory &&
        prevProps.replaceCategories === nextProps.replaceCategories &&
        prevProps.addEntry === nextProps.addEntry &&
        prevProps.updateEntry === nextProps.updateEntry &&
        prevProps.deleteEntry === nextProps.deleteEntry &&
        prevProps.getCategoryStats === nextProps.getCategoryStats &&
        prevProps.addItem === nextProps.addItem &&
        prevProps.updateItem === nextProps.updateItem &&
        prevProps.deleteItem === nextProps.deleteItem &&
        prevProps.adjustStock === nextProps.adjustStock &&
        prevProps.getItemHistory === nextProps.getItemHistory &&
        prevProps.addSignal === nextProps.addSignal
      );
    }
  );
  ```

### C. `ContactsBox` Memoization
* **File**: `src/components/dashboard/ContactsBox.tsx`
* **Observation**: `ContactsBox` receives no props (`React.FC`). However, because the parent `PortfolioDashboardView` re-renders frequently, `ContactsBox` runs its entire body on every render.
* **Proposed Optimization**: Wrap the entire component in `React.memo`:
  ```typescript
  export const ContactsBox = React.memo(ContactsBoxComponent);
  ```
  Since it receives no props, it will only re-render if its own local state (`searchTerm`, `editingContactId`, etc.) or internal hook (`useContacts()`) updates.

---

## 5. Callback & Value Memoization (useCallback & useMemo)

### A. Inside `ContactsBox.tsx`
* **Defect**: The handlers `startEdit`, `handleCancelEdit`, and `handleSubmit` are declared as inline arrow functions or plain functions. They are recreated on every render, which invalidates the `React.memo` inside `<ContactCard />` (because `onStartEdit` reference changes).
* **Proposed Changes**:
  * Wrap `startEdit` in `useCallback` with `[]` dependencies:
    ```typescript
    const startEdit = useCallback((contact: Contact) => {
      setEditingContactId(contact.id);
      setName(contact.name);
      setPhone(contact.phone);
      setEmail(contact.email || '');
      setNotes(contact.notes || '');
      setError(null);
    }, []);
    ```
  * Wrap `handleCancelEdit` in `useCallback` with `[]` dependencies:
    ```typescript
    const handleCancelEdit = useCallback(() => {
      setEditingContactId(null);
      setName(''); setPhone(''); setEmail(''); setNotes('');
      setError(null);
    }, []);
    ```
  * Wrap `handleSubmit` in `useCallback`:
    ```typescript
    const handleSubmit = useCallback((e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!name.trim()) { setError('이름/노드명을 입력해주세요.'); return; }
      if (!phone.trim()) { setError('연락처 번호를 입력해주세요.'); return; }
      const payload = { name: name.trim(), phone: phone.trim(), email: email.trim(), notes: notes.trim() };
      if (editingContactId) {
        updateContact(editingContactId, payload);
        setEditingContactId(null);
      } else {
        addContact(payload);
      }
      setName(''); setPhone(''); setEmail(''); setNotes('');
    }, [name, phone, email, notes, editingContactId, addContact, updateContact]);
    ```

### B. Inside `PortfolioDashboardView.tsx`
* **Defect**: Inline callback definitions are instantiated inside JSX:
  * Select dropdown: `onChange={(e) => setSelectedProject(e.target.value)}`
  * Buttons: `onClick={() => setChartType('monthly')}` and `onClick={() => setChartType('cumulative')}`
* **Proposed Changes**:
  * Extract selection handler:
    ```typescript
    const handleProjectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedProject(e.target.value);
    }, [setSelectedProject]);
    ```
  * Extract chart toggle handlers:
    ```typescript
    const handleSetMonthly = useCallback(() => setChartType('monthly'), []);
    const handleSetCumulative = useCallback(() => setChartType('cumulative'), []);
    ```

### C. Inside `WorkspaceView.tsx`
* **Defect**: Switcher button click handlers are inline:
  * `onClick={() => setActiveTab('budget')}` and `onClick={() => setActiveTab('inventory')}`
* **Proposed Changes**:
  * Extract tab toggles:
    ```typescript
    const handleSetBudgetTab = useCallback(() => setActiveTab('budget'), []);
    const handleSetInventoryTab = useCallback(() => setActiveTab('inventory'), []);
    ```

---

## 6. ContactsBox Filter Diagnostics
* **Inspection**: The search filtering code inside `ContactsBox.tsx` uses `useMemo`:
  ```typescript
  const filteredContacts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.phone.toLowerCase().includes(term) ||
        (c.notes && c.notes.toLowerCase().includes(term))
    );
  }, [contacts, searchTerm]);
  ```
* **Evaluation**:
  1. **Debouncing**: Search term changes are debounced via `localSearchTerm` with a 150ms timeout. This is excellent as it prevents running the filter loop on every keystroke.
  2. **Array Stability**: The `contacts` reference comes from `useContacts()`, which returns a stable state variable managed by React Query/Sheets sync hook. Hence, `useMemo` will not trigger unnecessarily.
  3. **String Safety**: To prevent potential runtime crashes if `name` or `phone` are ever missing or undefined (before Zod sandboxing or during partial loads), we can apply defensive fallbacks:
     ```typescript
     (c.name || '').toLowerCase().includes(term) ||
     (c.phone || '').toLowerCase().includes(term)
     ```
  4. **Primary Bottleneck**: The primary performance cost is not the filter calculation itself, but rather the fact that `ContactsBox` re-renders and recreates all handlers on every parent render cycle. Wrapping the component in `React.memo` solves this problem.
