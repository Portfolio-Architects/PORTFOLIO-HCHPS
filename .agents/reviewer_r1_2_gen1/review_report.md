# Review Report — Milestone 2: Initial Page Loading and Splash Loading Optimization (R1)

## Review Summary

**Verdict**: REQUEST_CHANGES

The implementation of the splash screen timer is correct, set to 1000ms. Code syntax, ESLint checks, and TypeScript checks pass. However, there is a structural discrepancy in the `PortfolioDashboardViewSkeleton` weekly scheduler skeleton height that will cause Cumulative Layout Shift (CLS) when loading is complete.

---

## Findings

### [Major] Finding 1: Weekly Scheduler Skeleton Height Mismatch (CLS Risk)

- **What**: The weekly scheduler skeleton's height in `PortfolioDashboardViewSkeleton` (defined in `src/app/page.tsx`) is set to `h-[300px]`, whereas the actual dynamic component (`WeeklyScheduler`) and its own placeholder `WeeklySchedulerSkeleton` (in `PortfolioDashboardView.tsx`) have a height of `h-[620px]`.
- **Where**: `src/app/page.tsx`, line 98:
  ```tsx
  <div className="bg-slate-100/60 dark:bg-slate-800/40 rounded-[2rem] p-8 border border-slate-200/40 dark:border-slate-800 h-[300px] flex flex-col justify-between mt-6">
  ```
  vs `src/components/dashboard/PortfolioDashboardView.tsx`, line 9:
  ```tsx
  <div className="glass-panel dark:glass-panel-dark rounded-[2rem] p-8 shadow-2xs border border-white/20 dark:border-slate-800 h-[620px] ...">
  ```
- **Why**: When the page is loaded and transitions from `PortfolioDashboardViewSkeleton` to the actual `PortfolioDashboardView` component, the weekly scheduler section will jump from `300px` to `620px` (or the component's natural height of around `620px`). This `320px` height difference triggers a noticeable Cumulative Layout Shift (CLS), which violates the requirement to prevent CLS.
- **Suggestion**: Change the height of the weekly scheduler skeleton in `src/app/page.tsx` line 98 from `h-[300px]` to `h-[620px]` (or similar) to match its target component's height.

---

## Verified Claims

- **Splash timer is set to 1000ms (1s)** → verified via code inspection in `src/app/page.tsx:846` → **PASS**
- **TypeScript & ESLint linting passes** → verified by running `npm run lint` → **PASS**
- **Next.js application builds successfully** → verified by running `npm run build` → **PASS** (completed successfully)
- **High-fidelity skeleton components layout structure** → verified via code inspection in `src/components/law/LawSystemPage.tsx` and `src/components/WorkspaceView.tsx` → **PASS** (except the weekly scheduler height discrepancy noted in Finding 1)

---

## Coverage Gaps

- **Direct Visual Rendering Layout Shift Verification** — risk level: low — recommendation: accept risk (can be verified with Chrome DevTools Performance panel under simulated slow network in production mode).

---

## Unverified Items

- None.
