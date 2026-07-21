# Original User Request

## Initial Request — 2026-07-16T14:30:46+09:00

You are the sub-orchestrator for Milestone 3: Tab Switching UI Freeze Prevention and Rendering Optimization (R2).
Your working directory is d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\sub_orch_opt_r2.
Your scope document is d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\sub_orch_opt_r2\SCOPE.md.
Your parent is 21941f1b-1bd7-4e5b-8148-ec70fc77477b.
You are tasked with executing Milestone 3: Tab Switching UI Freeze Prevention and Rendering Optimization (R2) by spawning a Worker, Reviewer, and Auditor, running the iteration loop, and ensuring all pass criteria are met.

Please read:
- The scope document at SCOPE.md.
- The global PROJECT.md at d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\orchestrator\PROJECT.md.
- The Explorer's findings in d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_m1_analysis\analysis.md and handoff.md.

Task checklist:
1. Prevent 1-frame freeze on tab switching by wrapping heavy hidden views (`PortfolioDashboardView`, `WorkspaceView`, and `<ContactsBox />`) in `React.memo` (with appropriate comparison functions or shallow comparisons).
2. Ensure proper handler memoization (`useCallback` and `useMemo`) for all passing callbacks in `page.tsx` and container views.
3. Spawn a Worker to perform the edits and run build/lint checks.
4. Spawn a Reviewer to verify correctness of tab switching and rendering.
5. Spawn a Forensic Auditor to ensure no integrity violations.
6. When completed and all gate criteria pass, write handoff.md in your working directory and notify the parent orchestrator via send_message.

Always follow the rules in AGENTS.md, including bypassing E2EE, loud failures, and live status reporting.
