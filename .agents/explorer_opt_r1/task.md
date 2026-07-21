# Explorer 1 Task: High-Contrast Readability & Fonts Analysis (R1)

## Objective
Analyze target components (`PortfolioDashboardView.tsx`, `WeeklyScheduler.tsx`, `MindMap3D.tsx`, `MindMapInspector.tsx`, `WikiEditor.tsx`, and related cards/modals under `src/components/`) to identify dark theme readability issues and construct a design plan.

## Target Components
- `src/components/dashboard/PortfolioDashboardView.tsx`
- `src/components/dashboard/WeeklyScheduler.tsx`
- `src/components/MindMap3D.tsx`
- `src/components/MindMapInspector.tsx`
- `src/components/WikiEditor.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/modal.tsx`
- Related cards/modals in the codebase.

## Key Requirements to Research
1. How to import and apply high-contrast dark theme fonts (`Inter` / `Outfit`).
2. Identify areas with low text-to-background contrast in dark mode (e.g., text-gray-500 on dark backgrounds).
3. Evaluate visual hierarchy: check if borders, shadows, padding, and margins of cards/modals need adjustment.
4. Check if TailwindCSS dark theme classes are applied correctly.

## Deliverables
- Write `analysis.md` in your folder (`.agents/explorer_opt_r1/`) detailing:
  - Exact styling changes needed for each component.
  - Recommended CSS/font import locations (e.g., `src/app/layout.tsx` or `globals.css`).
  - Proposed high-contrast color scheme classes (e.g. text color, border color, hover states).
- Report back with a summary when complete.
