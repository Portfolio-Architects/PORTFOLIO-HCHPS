# Aggregated Optimization Strategy (R1, R2, R3)

This synthesis aggregates findings from the 3 parallel codebase Explorers to establish a comprehensive implementation guide.

---

## 1. R1: High-Contrast Readability & Fonts

### A. Global Font Import (`src/app/layout.tsx`)
- Import `Inter` and `Outfit` using `next/font/google` directly inside `layout.tsx` (offline-friendly, high performance).
- Define variables `--font-inter` and `--font-outfit`.
- Update `<body>` class to: `className={`${inter.variable} ${outfit.variable} font-sans antialiased``.

### B. Global Theme Variables (`src/app/globals.css`)
- Clean up `@theme` rule to map Tailwind's sans and display fonts:
  ```css
  @theme {
    --font-sans: var(--font-inter), 'Inter', -apple-system, sans-serif;
    --font-display: var(--font-outfit), 'Outfit', sans-serif;
  }
  ```
- Implement dark mode variables inside `@media (prefers-color-scheme: dark)`:
  ```css
  @media (prefers-color-scheme: dark) {
    :root {
      --color-bg: #090d16;
      --color-card: #0f172a;
      --color-text-primary: #f8fafc;
      --color-text-secondary: #94a3b8;
      --color-text-tertiary: #475569;
      --color-border: #1e293b;
      --color-border-light: #334155;
      
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
      --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
      --shadow-lg: 0 8px 25px rgba(0,0,0,0.5);
    }
  }
  ```

### C. Component Styling Overrides
- **WeeklyScheduler.tsx**:
  - Fix color typos: `slate-55` -> `slate-50`, `indigo-55` -> `indigo-50`, `emerald-55` -> `emerald-50`, `amber-55` -> `amber-50`, `slate-450` -> `slate-400`, `slate-350` -> `slate-400`.
  - Add `dark:` overrides to inputs, forms, preset buttons, columns, and scheduled item cards (`getTypeConfig`).
- **PortfolioDashboardView.tsx**:
  - Add `dark:glass-panel-dark` to cards.
  - Override dark text classes with responsive colors: `text-slate-900` -> `dark:text-white`, `text-slate-800` -> `dark:text-slate-100`, etc.
  - Style selectors and list hovers for dark mode compatibility.
- **MindMap3D.tsx**:
  - Fix typo: `bg-rose-55/50` -> `bg-rose-50/50 dark:bg-rose-950/20 text-rose-750 dark:text-rose-400 border-rose-100 dark:border-rose-900/40`.
  - Add dark classes to search dropdowns, panel containers, confirm/node modals, and performance profiler widget.
- **MindMapInspector.tsx**:
  - Add dark classes to contacts box, priority items card, and parent input field.
- **WikiEditor.tsx**:
  - Detect prefers-color-scheme on mount and dynamically pass `theme={isDark ? "dark" : "light"}` to `<BlockNoteView>`. Set wrapper background to `dark:bg-slate-950`.
- **Base UI Cards/Modals (`card.tsx`, `modal.tsx`)**:
  - Update overlay backdrops to `backdrop-blur-md` and update button hovers.

---

## 2. R2: Lazy Loading & FCP Optimization

### A. WikiEditor Deferred Loading
- Remove static import of `WikiEditor` in `MindMap3D.tsx`.
- Load it using `next/dynamic` with `ssr: false` and a custom `WikiEditorSkeleton` fallback wrapper.

### B. WeeklyScheduler Skeleton Fallback
- Replace the dynamic loader fallback spinner in `PortfolioDashboardView.tsx` with a matching `WeeklySchedulerSkeleton` layout structure that matches the full `h-[620px]` size to eliminate Cumulative Layout Shift (CLS).

### C. MindMap3D Skeleton Fallback
- Replace the dynamic loader fallback spinner in `src/app/page.tsx` with a matching `MindMap3DSkeleton` layout structure of `h-[660px]` with orbital wireframe aesthetics.

---

## 3. R3: Re-render Isolation & Staggered Preloading

### A. Memoization & Props Stability
- **WeeklyScheduler.tsx**: Memoize the main component with `React.memo` and extract schedule item layouts into a memoized `<ScheduleItem>` subcomponent to isolate updates.
- **ContactsBox.tsx**: Extract and memoize individual contact rows into a `<ContactCard>` subcomponent to prevent inputs typing lags.
- **MindMap3D.tsx**: Update the component export to include `areMindMap3DPropsEqual`:
  ```typescript
  export const MindMap3D = React.memo(MindMap3DComponent, areMindMap3DPropsEqual);
  ```
- **MindMapInspector.tsx**:
  - Pass only the specific active node override (`activeNodeOverride`) instead of the entire `overrides` dictionary to prevent all-node invalidation.
  - Localize the data query calls (`useTasks()`, `useBudget()`) or move them to the parent, passing pre-filtered slices.

### B. Staggered Preloading Logic
- **PortfolioDashboardView.tsx**: Implement staggered gates for scheduler and address book:
  - Mount scheduler after 120ms (`renderScheduler` flag).
  - Mount address book after 280ms (`renderContacts` flag).
  - Render loading skeletons while these widgets are deferred.
- **MindMap3D.tsx**: Delay the physics canvas activation loop by 150ms (`engineActive` flag) after mounting to avoid main thread freeze during tab swipe transition.
