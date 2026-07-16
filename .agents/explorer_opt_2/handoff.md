# Handoff Report: Milestone 3 (Tab Switching UI Freeze Prevention and Rendering Optimization)

## 1. Observation
- **Observation A (Active Tab and keep-alive strategy)**: In `src/app/page.tsx`, `ProtectedApp` keeps all visited modules in the DOM using a class-based block/hidden display utility.
  ```tsx
  {/* Dashboard */}
  {visitedModules.dashboard && (
    <div className={activeModule === 'dashboard' ? 'block' : 'hidden'}>
      <PortfolioDashboardView tasks={tasks} budgetCategories={budgetCategories} budgetEntries={budgetEntries} onLogout={handleLogout} appMode={appMode} />
    </div>
  )}
  ```
- **Observation B (Un-memoized parent views)**: `PortfolioDashboardView` and `WorkspaceView` are not memoized. They do not accept an `isActive` prop or handle short-circuit rendering when inactive.
- **Observation C (Un-memoized handler causing ContactCard render cascade)**: In `src/components/dashboard/ContactsBox.tsx`, `ContactCard` is wrapped in `React.memo` (line 9). However, the callback `startEdit` passed to it (line 97) is an un-memoized standard function:
  ```tsx
  const startEdit = (contact: Contact) => {
    setEditingContactId(contact.id);
    setName(contact.name);
    setPhone(contact.phone);
    setEmail(contact.email || '');
    setNotes(contact.notes || '');
    setError(null);
  };
  ```
- **Observation D (Debounced search filtering)**: In `src/components/dashboard/ContactsBox.tsx`, search input filtering uses a `150ms` debounce (line 82) and is memoized (line 116):
  ```tsx
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

---

## 2. Logic Chain
- **Step 1 (Parent state updates trigger hidden view renders)**: In `ProtectedApp` (`src/app/page.tsx`), state updates (e.g. `activeModule` switching, tickers, budget updates) trigger `ProtectedApp` to re-render. Since `PortfolioDashboardView` and `WorkspaceView` are not wrapped in `React.memo`, React unconditionally re-renders them, running all hooks, layout logic, and virtual DOM diffing even when their outer container has `display: none` (`className="hidden"`).
- **Step 2 (Custom React.memo to freeze hidden tabs)**: By wrapping `PortfolioDashboardView` and `WorkspaceView` in `React.memo` and passing `isActive={activeModule === '...'}` as a prop, we can implement a custom comparison function. If the component was hidden and remains hidden (`!nextProps.isActive`), the comparison returns `true` (skipping re-render). This completely stops hidden views from running any computation on parent changes.
- **Step 3 (Event handler recreation breaks ContactCard memoization)**: In `ContactsBox.tsx`, because `startEdit` is recreated on every render, the reference of `onStartEdit` prop passed to `<ContactCard>` changes on every keystroke in the form. This causes React to bypass the `React.memo` wrapper on `ContactCard` and re-render all contacts in the list. Wrapping `startEdit` in `useCallback` makes the prop reference stable, allowing `React.memo` to successfully skip renders.
- **Step 4 (Search filter is not the bottleneck)**: The search filter is already optimized because it is debounced by 150ms and wrapped in `useMemo`. The lag is purely caused by the `ContactCard` render cascade during text typing.

---

## 3. Caveats
- Bypassing rendering of inactive views means any background state updates (e.g. new budget entries arriving while on the Law tab) will not be reflected in the inactive view's virtual DOM immediately. They will update once the view becomes active again. This is the desired behavior for performance, but the developer should ensure that component local states (like expanded items or charts) do not reset when transitioning.
- The `isLocked` or security screens are top-level and completely unmount the app, so they are not affected by this optimization.

---

## 4. Conclusion
- The UI freeze/sluggishness during tab switching and input typing is caused by:
  1. Hidden, un-memoized tab views undergoing virtual DOM reconciliation when they are not active.
  2. Cascade re-renders of all `ContactCard`s in `ContactsBox` due to unstable handler props (`startEdit`).
- **Action Plan**:
  1. Wrap `PortfolioDashboardView` and `WorkspaceView` in `React.memo` with custom comparison functions that return `true` (skip render) if `!nextProps.isActive`.
  2. Pass `isActive` from `ProtectedApp` to both views.
  3. Wrap `startEdit`, `handleCancelEdit`, and `handleSubmit` in `useCallback` inside `ContactsBox.tsx`.
  4. Wrap `ContactsBox` in `React.memo(ContactsBox)`.

---

## 5. Verification Method
- **Static Verification**:
  - Run `npm run lint` and `npm run build` to verify no syntactic or typing regressions.
- **Behavioral Verification**:
  - Open React Developer Tools Profiler.
  - Record a profile. Switch tabs. Verify that components for hidden tabs do not trigger a render cycle when they are hidden.
  - Type into the search or form fields in `ContactsBox`. Check that only the updated elements render and no other `ContactCard`s are re-rendered.
