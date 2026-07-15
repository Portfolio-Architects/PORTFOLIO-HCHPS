## 2026-07-15T09:21:40Z
You are the Worker for the RSI & Self-Evolution project (Milestones M2 and M3).
Your tasks are:
1. Implement `scripts/self-evolution.js`:
   - It must execute `node scripts/diagnose-targets.js` asynchronously and read `data/diagnose_report.json`.
   - It must parser-refactor or regex-refactor the following types of bottlenecks in source files:
     - **Time Complexity**: Rewrite nested loops (e.g. `.find()`, `.filter()` inside `.map()`) in React components. Convert the searched array into a `useMemo` Map lookup:
       `const searchArrMap = useMemo(() => new Map(searchArr.map(s => [s.id, s])), [searchArr]);`
       and replace the `.find(...)` inside the loop with `searchArrMap.get(...)`. Ensure `useMemo` is imported from `'react'`.
     - **Console Spam**: Comment out `console.warn(...)` and `console.error(...)` inside UI components in `src/components/` using block comments (e.g., `/* console.warn(...) */`).
     - **Lazy Loading**: Convert static imports of heavy components (`MindMap3D`, `WeeklyScheduler`, `InventoryList`, `BlockNote`) inside `page.tsx` or `dashboard` files to Next.js dynamic imports (`dynamic(() => import(...), { ssr: false })`). Ensure `import dynamic from 'next/dynamic';` is added to the file if not present.
   - Upon making modifications, run `node scripts/run-harness.js`.
   - If verification passes (returns exit code 0):
     - Append log details of the optimized items to `PORTFOLIO VITAL - Engineering Report.md`.
     - Run `node scripts/sync-rules.js`.
     - Run `git add .`, commit changes as `[auto] self-improvement: optimize <details>`, and push.
   - If verification fails (Self-Rollback Guard):
     - Revert the files using `git checkout -- <filepath>` or a backup mechanism.
     - Track failed count for each file. If a file fails 3 times, insert a `try-catch` fallback block wrapping the problematic code, or tag the code/report so the app remains safe (e.g. `[FALLBACK mode]`).
2. Implement `src/components/dashboard/DummyPerfTest.tsx` as a test component containing:
   - A static import of `MindMap3D`.
   - A `console.warn` call.
   - An O(N^2) loop where `projectList.find(p => p.id === task.projectId)` is inside `taskList.map(...)`.
3. Test `scripts/self-evolution.js` on `src/components/dashboard/DummyPerfTest.tsx` and verify it automatically refactors it to pass all diagnostics.
4. Verify that inserting a lint error into `src/components/dashboard/DummyPerfTest.tsx` triggers the Rollback Guard in `self-evolution.js`.
5. Run the static analysis harness `node scripts/run-harness.js` and Next.js build `npm run build` to ensure the entire codebase compiles successfully and diagnostics report 0 warnings, 0 violations, 0 bottlenecks.
6. Provide a detailed handoff report in `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_rsi_impl\handoff.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your working directory is: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_rsi_impl.
Do not write metadata files outside your working directory. You are authorized to create/edit source files under `src/` and `scripts/`.
