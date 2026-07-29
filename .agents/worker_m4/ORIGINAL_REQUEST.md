## 2026-07-23T11:42:30+09:00

You are the Worker Subagent for Milestone 4 (M4: Zero-Stall & Gatekeeper Verification Guarantee & AGENTS.md Rule Sync).

Working Directory: `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_m4`
Project Root: `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL`

Task Objective:
Execute full gatekeeper verification and rules synchronization. Ensure 0 Long Task thread stalls (>100ms) across all 4 main modules (`mindmap`, `project`, `dashboard`, `workspace`), run `node scripts/run-harness.js` (verifying 0 TSC errors, 0 Zod errors, 0 Architectural violations, 0 ESLint warnings), and run `node scripts/sync-rules.js` to sync the updated milestone log to `AGENTS.md`.

Instructions:
1. Run `npx tsc --noEmit` using `run_command` in `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL`.
2. Run `node scripts/run-harness.js` using `run_command` in `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL`.
3. Run `node scripts/sync-rules.js` using `run_command` in `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL`.
4. Inspect `AGENTS.md` and `data/diagnose_report.json` to confirm 0 Architectural Violations, 0 TSC errors, 0 Zod schema errors, 0 ESLint warnings, and 0 Performance Bottlenecks / thread stalls (>100ms).
5. Create `handoff.md` in `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_m4\handoff.md` detailing:
   - Full output and status of gatekeeper verification (`run-harness.js`)
   - `sync-rules.js` execution and `AGENTS.md` milestone log sync verification
   - Zero-Stall performance guarantee summary across all 4 modules (`mindmap`, `project`, `dashboard`, `workspace`)
6. Send a completion message back to parent orchestrator via `send_message`.
