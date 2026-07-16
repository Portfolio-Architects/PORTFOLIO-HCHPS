# Milestone 3: Tab Switching UI Freeze Prevention and Rendering Optimization Report

This report documents the exploration, diagnostics, and precise optimization strategies for Milestone 3 (Tab Switching UI Freeze Prevention and Rendering Optimization) in the PORTFOLIO - VITAL application.

---

## 1. Active Tab States and Module Rendering Analysis
* **Location:** `src/app/page.tsx:711-771` (inside `ProtectedApp` component)
* **Observation:**
  - Tab views are dynamically loaded using Next.js `dynamic()` with `{ ssr: false }`.
  - Once a module is clicked, it is marked as `true` in `visitedModules` state:
    ```typescript
    const [visitedModules, setVisitedModules] = useState<Record<ModuleType, boolean>>({
      dashboard: true,
      mindmap: false,
      workspace: false,
      law: false,
    });
    ```
  - Visited tab modules are rendered simultaneously inside the DOM, and their visibility is toggled using conditional CSS classes (`block` vs `hidden` based on the value of `activeModule`):
    ```tsx
    {visitedModules.dashboard && (
      <div className={activeModule === 'dashboard' ? 'block' : 'hidden'}>
        <PortfolioDashboardView ... />
      </div>
    )}
    ```
* **Performance Impact:**
  - Keeping tab views in the DOM is beneficial for UI state persistence (e.g. scroll positions, inputs, form states).
  - However, because these views are mounted, **any state change in the parent `ProtectedApp` component (such as budget categories, entries, tasks, signals, or switching tabs itself) triggers a complete React reconciliation and rendering cascade of all visited tabs**, even if they are currently hidden.
  - Since `PortfolioDashboardView`, `WorkspaceView`, and `LawSystemPage` are not fully guarded, they re-execute heavy hooks (like `usePortfolioAnalytics`), filters, mapping loops, and recreate DOM elements, which blocks the main thread and causes UI freezing (up to 100-300ms) during tab switching.

---

## 2. Preventing Hidden Tab Views from Re-rendering and Running Expensive Logic
To prevent hidden tabs from re-rendering and running expensive logic when the active tab switches or when shared data (like tasks or budget entries) updates:
1. **Pass `isActive` Prop:** Introduce an `isActive` boolean prop to each main tab component:
   - `PortfolioDashboardView`: `isActive={activeModule === 'dashboard'}`
   - `WorkspaceView`: `isActive={activeModule === 'workspace'}`
2. **Utilize `React.memo` with Custom Comparison Functions:**
   - In each component's custom comparison function, if `prevProps.isActive` is `false` and `nextProps.isActive` is `false`, **return `true` immediately**.
   - Returning `true` tells React that the props are "equal" and that it should skip rendering the component entirely.
   - When the user switches back to the tab, `isActive` will change from `false` to `true`. This difference in `isActive` (`prevProps.isActive !== nextProps.isActive`) will cause the comparison to return `false`, prompting a re-render with the latest updated data.
   - This ensures hidden tabs consume zero CPU cycles for rendering when inactive, while preserving seamless update propagation when they become active.

---

## 3. Applying `React.memo` & Custom Comparison Functions

### A. `PortfolioDashboardView`
* **File:** `src/components/dashboard/PortfolioDashboardView.tsx`
* **Current State:** Defined as a normal function component. Not memoized.
* **Proposed Custom Comparison Logic:**
  We wrap the component in `React.memo` and check:
  1. If `prevProps.isActive === false` and `nextProps.isActive === false`, skip rendering.
  2. Otherwise, check if active state, mode, categories, entries, or tasks have changed.
  
  ```typescript
  // Prop Interface Extension
  interface DashboardProps {
    tasks: Task[];
    budgetCategories: BudgetCategory[];
    budgetEntries: BudgetEntry[];
    onLogout?: () => void;
    appMode?: 'HCHPS' | 'VITAL';
    isActive: boolean; // Add this prop
  }

  export const PortfolioDashboardView = React.memo(
    PortfolioDashboardViewComponent,
    (prevProps, nextProps) => {
      // 1. If it was not active and is still not active, skip render
      if (!prevProps.isActive && !nextProps.isActive) {
        return true;
      }
      // 2. Otherwise, standard prop checks
      return (
        prevProps.isActive === nextProps.isActive &&
        prevProps.appMode === nextProps.appMode &&
        prevProps.tasks === nextProps.tasks &&
        prevProps.budgetCategories === nextProps.budgetCategories &&
        prevProps.budgetEntries === nextProps.budgetEntries &&
        prevProps.onLogout === nextProps.onLogout
      );
    }
  );
  PortfolioDashboardView.displayName = 'PortfolioDashboardView';
  ```

### B. `WorkspaceView`
* **File:** `src/components/WorkspaceView.tsx`
* **Current State:** Wrapped in default `React.memo(WorkspaceViewComponent)` which does a shallow comparison. Because the parent passes many callbacks, any change in parent render could break the shallow memoization.
* **Proposed Custom Comparison Logic:**
  Wrap it with a custom comparison function that checks the active state and compares all structural data props:
  
  ```typescript
  // Prop Interface Extension
  interface WorkspaceViewProps {
    isActive: boolean; // Add this prop
    budgetCategories: BudgetCategory[];
    budgetEntries: BudgetEntry[];
    // ... other props
  }

  export const WorkspaceView = React.memo(
    WorkspaceViewComponent,
    (prevProps, nextProps) => {
      // 1. If it was not active and is still not active, skip render
      if (!prevProps.isActive && !nextProps.isActive) {
        return true;
      }
      // 2. Otherwise, compare core data props and stable callbacks
      return (
        prevProps.isActive === nextProps.isActive &&
        prevProps.budgetCategories === nextProps.budgetCategories &&
        prevProps.budgetEntries === nextProps.budgetEntries &&
        prevProps.overallStats === nextProps.overallStats &&
        prevProps.inventoryItems === nextProps.inventoryItems &&
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
  WorkspaceView.displayName = 'WorkspaceView';
  ```

---

## 4. Hook Optimization: `useCallback` and `useMemo` Usage

### A. Inside `ProtectedApp` (`src/app/page.tsx`)
- All mutations and callback wrappers (`addCategory`, `updateCategory`, `deleteCategory`, `replaceCategories`, `addEntry`, `updateEntry`, `deleteEntry`, `getCategoryStats`, `addItem`, `updateItem`, `deleteItem`, `adjustStock`, `getItemHistory`, `addSignal`, `deleteSignal`, `updateSignalKeywords`) are **already properly stabilized using `useCallback`** inside their respective hooks (`useBudget`, `useInventory`, `useSignal`).
- In `ProtectedApp`, `actualBudgetEntries` (filtered entries) and `aiContextData` are correctly cached using `useMemo`.
- `handleGetCategoryStats` is stabilized using `useCallback` in `page.tsx` line 432:
  ```typescript
  const handleGetCategoryStats = useCallback((id: string) => getCategoryStats(id, true), [getCategoryStats]);
  ```
- **Recommendation:**
  Ensure that when tabs are rendered, `isActive` is explicitly passed:
  ```tsx
  <PortfolioDashboardView 
    tasks={tasks} 
    budgetCategories={budgetCategories} 
    budgetEntries={budgetEntries} 
    onLogout={handleLogout} 
    appMode={appMode} 
    isActive={activeModule === 'dashboard'} 
  />
  ```
  and:
  ```tsx
  <WorkspaceView
    isActive={activeModule === 'workspace'}
    budgetCategories={budgetCategories}
    budgetEntries={actualBudgetEntries}
    // ... other props
  />
  ```

### B. Inside `PortfolioDashboardView`
- **Dynamic Chart Container Width ResizeObserver:**
  ```typescript
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
  This is fine, but it will trigger updates when width changes. Memoizing the chart rendering wrapper avoids redraws when only unrelated props change.
- **Theme Colors and Pie Chart Data:**
  The `themeColors` (line 180) and `dynamicPieData` (line 186) are correctly memoized with `useMemo`.

---

## 5. Diagnostics of `ContactsBox.tsx` and Expensive Filters

### A. Expensive Filters
* **Location:** `src/components/dashboard/ContactsBox.tsx:116-125`
* **Observation:**
  The search filter computes the filtered contacts on search query change:
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
  - **Assessment:** This filter uses `useMemo` and relies on `searchTerm` which is debounced by 150ms from `localSearchTerm` (line 82-87). This prevents the filter from running on every keystroke, which is highly efficient.

### B. Broken Child Component Memoization
* **Location:** `src/components/dashboard/ContactsBox.tsx:97-104`
* **Observation:**
  - `ContactCard` is wrapped in `React.memo` (line 9) and takes `contact`, `onStartEdit`, and `onDelete` as props.
  - However, in `ContactsBoxComponent`, the edit handler `startEdit` is defined as a standard function:
    ```typescript
    const startEdit = (contact: Contact) => {
      setEditingContactId(contact.id);
      setName(contact.name);
      setPhone(contact.phone);
      setEmail(contact.email || '');
      setNotes(contact.notes || '');
      setError(null);
    };
    ```
  - **Performance Bug:** Because `startEdit` is recreated on every single render of `ContactsBoxComponent`, its reference changes.
  - Therefore, whenever the user types in the input fields (e.g. typing in Name, Phone, Email, or Notes) or search box, `ContactsBoxComponent` re-renders, creating a new `startEdit` reference.
  - This breaks `React.memo` on **every single `ContactCard`**, causing the entire list of contacts to re-render in the virtual DOM on every single keystroke. This causes typing input latency (UI lag) in the creation form.
* **Proposed Fix:**
  Wrap `startEdit` in `useCallback`:
  ```typescript
  const startEdit = useCallback((contact: Contact) => {
    setEditingContactId(contact.id);
    setName(contact.name);
    setPhone(contact.phone);
    setEmail(contact.email || '');
    setNotes(contact.notes || '');
    setError(null);
  }, []); // State setters are stable, so dependencies are empty
  ```
  Additionally, wrap `handleCancelEdit` in `useCallback` for consistency:
  ```typescript
  const handleCancelEdit = useCallback(() => {
    setEditingContactId(null);
    setName('');
    setPhone('');
    setEmail('');
    setNotes('');
    setError(null);
  }, []);
  ```

---

## 6. Optimization Diff Patch Projections

Below are the exact changes proposed for implementation:

### 1. `src/app/page.tsx`
```diff
@@ -404,4 +404,5 @@
 interface ProtectedAppProps {
   appMode: 'HCHPS' | 'VITAL';
   onModeChange: (mode: 'HCHPS' | 'VITAL') => void;
+  isActive?: boolean;
 }
@@ -712,7 +713,7 @@
             {/* Dashboard */}
             {visitedModules.dashboard && (
               <div className={activeModule === 'dashboard' ? 'block' : 'hidden'}>
-                <PortfolioDashboardView tasks={tasks} budgetCategories={budgetCategories} budgetEntries={budgetEntries} onLogout={handleLogout} appMode={appMode} />
+                <PortfolioDashboardView tasks={tasks} budgetCategories={budgetCategories} budgetEntries={budgetEntries} onLogout={handleLogout} appMode={appMode} isActive={activeModule === 'dashboard'} />
               </div>
             )}
 
@@ -740,6 +741,7 @@
             {/* Workspace (Budget Management) */}
             {visitedModules.workspace && (
               <div className={activeModule === 'workspace' ? 'block' : 'hidden'}>
                 <WorkspaceView
+                  isActive={activeModule === 'workspace'}
                   budgetCategories={budgetCategories}
                   budgetEntries={actualBudgetEntries}
```

### 2. `src/components/dashboard/PortfolioDashboardView.tsx`
```diff
@@ -78,6 +78,7 @@
   onLogout?: () => void;
   appMode?: 'HCHPS' | 'VITAL';
+  isActive: boolean;
 }
@@ -122,2 +123,2 @@
-export function PortfolioDashboardView({ budgetCategories, budgetEntries, appMode = 'VITAL' }: DashboardProps) {
-  const [chartType, setChartType] = useState<'monthly' | 'cumulative'>('monthly');
+function PortfolioDashboardViewComponent({ budgetCategories, budgetEntries, appMode = 'VITAL' }: DashboardProps) {
+  const [chartType, setChartType] = useState<'monthly' | 'cumulative'>('monthly');
@@ -449,2 +450,17 @@
-}
+
+export const PortfolioDashboardView = React.memo(
+  PortfolioDashboardViewComponent,
+  (prevProps, nextProps) => {
+    // If not active in both renders, skip rendering
+    if (!prevProps.isActive && !nextProps.isActive) {
+      return true;
+    }
+    return (
+      prevProps.isActive === nextProps.isActive &&
+      prevProps.appMode === nextProps.appMode &&
+      prevProps.tasks === nextProps.tasks &&
+      prevProps.budgetCategories === nextProps.budgetCategories &&
+      prevProps.budgetEntries === nextProps.budgetEntries &&
+      prevProps.onLogout === nextProps.onLogout
+    );
+  }
+);
+PortfolioDashboardView.displayName = 'PortfolioDashboardView';
```

### 3. `src/components/WorkspaceView.tsx`
```diff
@@ -46,2 +46,3 @@
   addSignal?: (text: string) => void;
+  isActive: boolean;
 }
@@ -138,3 +139,27 @@
-export const WorkspaceView = React.memo(WorkspaceViewComponent);
-WorkspaceView.displayName = 'WorkspaceView';
+export const WorkspaceView = React.memo(
+  WorkspaceViewComponent,
+  (prevProps, nextProps) => {
+    if (!prevProps.isActive && !nextProps.isActive) {
+      return true;
+    }
+    return (
+      prevProps.isActive === nextProps.isActive &&
+      prevProps.budgetCategories === nextProps.budgetCategories &&
+      prevProps.budgetEntries === nextProps.budgetEntries &&
+      prevProps.overallStats === nextProps.overallStats &&
+      prevProps.inventoryItems === nextProps.inventoryItems &&
+      prevProps.addCategory === nextProps.addCategory &&
+      prevProps.updateCategory === nextProps.updateCategory &&
+      prevProps.deleteCategory === nextProps.deleteCategory &&
+      prevProps.replaceCategories === nextProps.replaceCategories &&
+      prevProps.addEntry === nextProps.addEntry &&
+      prevProps.updateEntry === nextProps.updateEntry &&
+      prevProps.deleteEntry === nextProps.deleteEntry &&
+      prevProps.getCategoryStats === nextProps.getCategoryStats &&
+      prevProps.addItem === nextProps.addItem &&
+      prevProps.updateItem === nextProps.updateItem &&
+      prevProps.deleteItem === nextProps.deleteItem &&
+      prevProps.adjustStock === nextProps.adjustStock &&
+      prevProps.getItemHistory === nextProps.getItemHistory &&
+      prevProps.addSignal === nextProps.addSignal
+    );
+  }
+);
+WorkspaceView.displayName = 'WorkspaceView';
```

### 4. `src/components/dashboard/ContactsBox.tsx`
```diff
@@ -96,17 +96,17 @@
-  const startEdit = (contact: Contact) => {
+  const startEdit = useCallback((contact: Contact) => {
     setEditingContactId(contact.id);
     setName(contact.name);
     setPhone(contact.phone);
     setEmail(contact.email || '');
     setNotes(contact.notes || '');
     setError(null);
-  };
+  }, []);
 
-  const handleCancelEdit = () => {
+  const handleCancelEdit = useCallback(() => {
     setEditingContactId(null);
     setName('');
     setPhone('');
     setEmail('');
     setNotes('');
     setError(null);
-  };
+  }, []);
```
