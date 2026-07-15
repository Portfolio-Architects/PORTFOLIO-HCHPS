## 2026-07-15T01:45:22Z
You are a Worker agent.
Your working directory is `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_refactor_2\`.
Your task is to:
1. Fix the critical SyntaxError bug in `src/hooks/useSignal.ts` (lines 149 and 226) where `JSON.parse` is called with the `'[/* empty */]'` fallback string. Replace it with a valid empty array JSON string `'[]'`:
   - Line 149:
     ```typescript
     try { deletedIds = JSON.parse(localStorage.getItem('hchps-global-tombstones') || '[]'); } catch { }
     ```
   - Line 226:
     ```typescript
     const deletedIds = JSON.parse(localStorage.getItem('hchps-global-tombstones') || '[]');
     ```
2. Verify that the static analysis harness `node scripts/run-harness.js` passes with 0 warnings, 0 violations, and 0 bottlenecks in `data/diagnose_report.json`.
3. Verify that Next.js build (`npm run build`) compiles successfully without any typecheck errors.
4. Record the modifications in `PORTFOLIO VITAL - Engineering Report.md` and `PORTFOLIO VITAL - Engineering Milestones.md`, update `AGENTS.md`, and run `node scripts/sync-rules.js` for patch logging.
5. Write your detailed actions and commands run to `changes.md` and a final `handoff.md`.
6. Report back to the parent agent (ID: d1b458c6-f4a1-41f3-a56b-80942872b182) when finished.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
