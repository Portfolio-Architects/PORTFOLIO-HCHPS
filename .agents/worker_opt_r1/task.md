# Worker 1 Task: High-Contrast Readability & Fonts (R1) Implementation

## Objective
Implement high-contrast dark theme UI enhancement and import/apply Inter and Outfit fonts across the PORTFOLIO-VITAL project.

## Reference Materials
Please read the Explorer's synthesis:
- Synthesis Report: `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\orchestrator\synthesis.md`
- Styling Analysis Details: `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_opt_r1\analysis.md`

## Required Actions

### 1. Font Setup (`src/app/layout.tsx`)
- Import `Inter` and `Outfit` fonts from `next/font/google` directly.
- Define font variables `--font-inter` and `--font-outfit`.
- Apply these variables to the `<body>` element's class: `${inter.variable} ${outfit.variable} font-sans antialiased`. Remove any default Geist font references if they override the body font.

### 2. CSS Global Configuration (`src/app/globals.css`)
- Configure Tailwind v4 `@theme` rule to map `sans` to `var(--font-inter)` and `display` to `var(--font-outfit)`.
- Implement high-contrast dark mode CSS variables under `@media (prefers-color-scheme: dark)`.

### 3. Component Readability Enhancements
- **src/components/dashboard/WeeklyScheduler.tsx**:
  - Fix all color typos (`slate-55`, `indigo-55`, `emerald-55`, `amber-55`, `slate-450`, `slate-350`) to their standard Tailwind equivalents.
  - Implement dark-theme classes for columns, header days, scheduled items, preset buttons, forms, inputs, and textareas.
- **src/components/dashboard/PortfolioDashboardView.tsx**:
  - Add dark-mode classes to cards (`dark:glass-panel-dark`), select fields, item lists, and text. Ensure dark text (e.g. `text-slate-900`) is overridden in dark mode with readable classes (e.g. `dark:text-white`).
- **src/components/MindMap3D.tsx**:
  - Fix typo `bg-rose-55/50` -> `bg-rose-50/50 dark:bg-rose-950/20 text-rose-750 dark:text-rose-400 border-rose-100 dark:border-rose-900/40`.
  - Add dark-theme compatibility to search dropdown, side panel background, node modals, and performance profiler.
- **src/components/MindMapInspector.tsx**:
  - Enhance dark compatibility for the contact card, AI tool panel, select inputs, and priority items.
- **src/components/WikiEditor.tsx**:
  - Detect system dark mode on mount using `window.matchMedia('(prefers-color-scheme: dark)')`.
  - Pass dynamic `theme={isDark ? "dark" : "light"}` to `<BlockNoteView>`. Set wrapper background to `dark:bg-slate-950`.
- **src/components/ui/card.tsx` & `src/components/ui/modal.tsx**:
  - Adjust backdrop blur classes (`backdrop-blur-md`), close button hovers, and footer background colors for dark mode.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Verification
- Run `npm run lint` and `npm run build` after completing the changes to ensure everything compiles without errors.
- Detail the exact command lines, output logs, and verify that the layout behaves as expected.
- Report back with a summary of files changed, diffs, and validation output.
