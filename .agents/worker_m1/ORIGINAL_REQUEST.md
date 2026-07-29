## 2026-07-23T02:23:12Z
<USER_REQUEST>
You are the Worker Subagent for Milestone 1 (M1: Architectural Violation Removal & Direct Fetch Elimination).

Working Directory: `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_m1`
Project Root: `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL`

Task Objective:
Refactor `LocalhostStatusHUD.tsx` to eliminate all direct `fetch()` API calls inside the UI component, moving data fetching into a dedicated custom hook (`useLocalhostHealth.ts` in `src/hooks/`) in strict compliance with the MVC ontology (where UI components call hooks, not direct fetch).

Instructions:
1. Examine `src/components/dashboard/LocalhostStatusHUD.tsx` (or locate `LocalhostStatusHUD.tsx` in `src/components/`).
2. Create `src/hooks/useLocalhostHealth.ts` adhering to project patterns (using `@tanstack/react-query` or standard custom hook pattern with React Query if existing hooks like `useTasks` use `@tanstack/react-query`).
3. Refactor `LocalhostStatusHUD.tsx` to consume `useLocalhostHealth` instead of performing inline `fetch()`.
4. Run `node scripts/run-harness.js` using `run_command` in `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL` to verify 0 Architectural Violations, 0 TSC errors, 0 Zod errors, 0 ESLint warnings.
5. Create `handoff.md` in `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_m1\handoff.md` detailing:
   - Files created / modified
   - Build & harness validation results (command & output)
   - Interface compliance & verification
6. Send a completion message back to parent orchestrator via `send_message`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
</USER_REQUEST>
