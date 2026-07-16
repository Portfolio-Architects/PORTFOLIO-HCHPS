# Handoff Report: Milestone 3 (Tab Switching UI Freeze Prevention and Rendering Optimization)

## 1. Observation
I directly observed the following locations and structures in the codebase:

1. **Active Tab States and Rendering Control**:
   * In `src/app/page.tsx` (Lines 408–414), visited tabs are initialized and tracked in state:
     ```typescript
     const [activeModule, setActiveModule] = useState<ModuleType>('dashboard');
     const [visitedModules, setVisitedModules] = useState<Record<ModuleType, boolean>>({
       dashboard: true,
       mindmap: false,
       workspace: false,
       law: false,
     });
     ```
   * Visited tabs are rendered in the DOM with visibility controlled by className toggles (Lines 713–770):
     ```tsx
     {/* Dashboard */}
     {visitedModules.dashboard && (
       <div className={activeModule === 'dashboard' ? 'block' : 'hidden'}>
         <PortfolioDashboardView tasks={tasks} budgetCategories={budgetCategories} budgetEntries={budgetEntries} onLogout={handleLogout} appMode={appMode} />
       </div>
     )}
     ```
     Similar wrapping blocks exist for `workspace` (Lines 740–763) and `law` (Lines 766–770).

2. **Component Memoization and Interfaces**:
   * In `src/components/dashboard/PortfolioDashboardView.tsx` (Line 123), `PortfolioDashboardView` is exported as a standard function component without `React.memo`:
     ```typescript
     export function PortfolioDashboardView({ budgetCategories, budgetEntries, appMode = 'VITAL' }: DashboardProps) {
     ```
   * In `src/components/WorkspaceView.tsx` (Line 49), `WorkspaceView` is exported without `React.memo`:
     ```typescript
     export function WorkspaceView(props: WorkspaceViewProps) {
     ```
   * In `src/components/dashboard/ContactsBox.tsx` (Line 75), `ContactsBox` is defined as:
     ```typescript
     export const ContactsBox: React.FC = () => {
     ```
     It is not wrapped in `React.memo`.

3. **Inline Handlers and Callbacks**:
   * In `src/components/dashboard/ContactsBox.tsx`, the event handlers are instantiated as standard functions on every render (Lines 97–104, 106–113, and 127–159):
     ```typescript
     const startEdit = (contact: Contact) => { ... };
     const handleCancelEdit = () => { ... };
     const handleSubmit = (e: React.FormEvent) => { ... };
     ```
     These callbacks are passed directly to `ContactCard` (Line 292):
     ```tsx
     <ContactCard
       key={contact.id}
       contact={contact}
       onStartEdit={startEdit}
       onDelete={deleteContact}
     />
     ```
     While `ContactCard` is wrapped in `React.memo` (Line 9), the `onStartEdit` prop changes reference on every render because `startEdit` is not memoized.
   * In `src/components/dashboard/PortfolioDashboardView.tsx`, inline callbacks are used in JSX:
     * Line 212: `onChange={(e) => setSelectedProject(e.target.value)}`
     * Line 350: `onClick={() => setChartType('monthly')}`
     * Line 356: `onClick={() => setChartType('cumulative')}`
   * In `src/components/WorkspaceView.tsx`, inline callbacks are used in tab selection buttons:
     * Line 69: `onClick={() => setActiveTab('budget')}`
     * Line 79: `onClick={() => setActiveTab('inventory')}`

4. **ContactsBox Filter Logic**:
   * In `src/components/dashboard/ContactsBox.tsx` (Lines 116–125), `filteredContacts` is memoized:
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
     `searchTerm` is debounced from `localSearchTerm` with a 150ms timeout (Lines 82–87).

---

## 2. Logic Chain
1. **Observation 1 (Tab State Rendering)**: Visited tab views remain mounted in the DOM under `hidden` classes.
2. **Observation 2 (Component Memoization)**: Since `PortfolioDashboardView` and `WorkspaceView` are not wrapped in `React.memo`, any render cycle triggered in the parent `ProtectedApp` component automatically triggers full render cycles in all visited tabs.
3. **Logic Integration (Hidden Tab Freeze)**: By introducing an `isActive` prop and using a custom `React.memo` comparison function, we can determine when a component is hidden and remains hidden (`!prevProps.isActive && !nextProps.isActive`). If so, we return `true` to skip rendering entirely.
4. **Observation 3 (Inline Handlers in ContactsBox)**: Because `startEdit` is re-instantiated on every render, the reference of `onStartEdit` changes on each render of `ContactsBox`.
5. **Logic Integration (ContactCard Memoization Bypass)**: This reference change invalidates the memoization of `<ContactCard />`, forcing it to fully re-render even if its contact data is identical. Wrapping the handlers (`startEdit`, `handleCancelEdit`, `handleSubmit`) in `useCallback` stabilizes the references and restores `React.memo` performance.
6. **Observation 4 (ContactsBox Filter)**: The filter is memoized and debounced, making it computationally light. However, if `ContactsBox` itself re-renders unnecessarily, it has to run the render body and reconcile children. Wrapping `ContactsBox` in `React.memo` and securing the search term prevents useless renders.

---

## 3. Caveats
* **Assumptions**: E2EE data decryption is bypassed as per the project developer guidelines. Therefore, we assume all database reads are already plain text JSON.
* **Limitations**: The 3D MindMap view (`MindMap3D.tsx`) was not part of the active files scope to memoize but was reviewed contextually. It already accepts `isActive`, which is used inside the component.

---

## 4. Conclusion
To prevent tab switching UI freeze and optimize rendering performance, we must:
1. Pass `isActive` from `ProtectedApp` to `PortfolioDashboardView` and `WorkspaceView`.
2. Wrap `PortfolioDashboardView` and `WorkspaceView` in `React.memo` with custom comparison functions that bypass rendering when `isActive` is false on both previous and next props.
3. Wrap `ContactsBox` in `React.memo` (without a custom comparison function as it has no props) to decouple it from parent re-renders.
4. Wrap all event handlers (`startEdit`, `handleCancelEdit`, `handleSubmit` in `ContactsBox`; `handleProjectChange`, `handleSetMonthly`, `handleSetCumulative` in `PortfolioDashboardView`; `handleSetBudgetTab`, `handleSetInventoryTab` in `WorkspaceView`) in `useCallback` to maintain reference stability.

---

## 5. Verification Method
* **Linting and Build Tests**:
  * Execute `npm run lint` and `npm run build` from the root directory to verify that type bindings and exports remain clean.
* **Verification Targets**:
  * Inspect `src/components/dashboard/PortfolioDashboardView.tsx`, `src/components/WorkspaceView.tsx`, and `src/components/dashboard/ContactsBox.tsx` to confirm `React.memo` wraps the exports and comparison functions check `isActive`.
