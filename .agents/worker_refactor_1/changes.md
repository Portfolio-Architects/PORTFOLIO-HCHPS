# Changes

## 1. Code Modifications
- **File modified:** `src/app/page.tsx`
- **Location:** Splash screen `useEffect` (lines 554-571)
- **Problem:** The inner timer (`removeTimerId` / `removeTimer`) was created inside the outer timer's callback, and its cleanup function was returned within the `setTimeout` callback which was ignored. As a result, the inner timer was never cleared if the component unmounted before the timer finished, leading to a memory leak.
- **Solution:** Declared both `timerId` and `removeTimerId` as mutable variables within the `useEffect` scope. Cleared both timer variables in the `useEffect` cleanup function.

## 2. Documentation & Manifest Updates
- **File modified:** `PORTFOLIO VITAL - Engineering Report.md`
  - Added the memory leak fix to Section 8: "최근 엔지니어링 마일스톤 (요약)".
- **File modified:** `PORTFOLIO VITAL - Engineering Milestones.md`
  - Added the corresponding milestone header and details to Section 8.
- **File modified:** `AGENTS.md`
  - Synchronized the milestones list by running `node scripts/sync-rules.js`.

## 3. Verification Commands Run
- `node scripts/run-harness.js`
  - Executed successfully.
  - Zod Database validation passed with 0 errors.
  - ESLint checks and typechecks passed with 0 warnings, 0 violations, and 0 bottlenecks in `data/diagnose_report.json`.
- `npm run build`
  - Compiles Next.js application successfully without errors (with only Turbopack dynamic import file pattern matches warnings, which are normal for the dynamic filesystem search feature).
