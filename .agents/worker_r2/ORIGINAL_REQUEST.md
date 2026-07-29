## 2026-07-23T01:29:48Z
You are worker_r2, a Worker subagent for the Localhost UX Optimization project.
Your working directory is `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_r2`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Mission: Implement Requirement R2 — Localhost Health & Daemon Status HUD Component.

Files to modify/create:
1. `src/hooks/useLocalhostHealth.ts` (create):
   - React Query hook probing Port 3001, Heap Memory (MB) (client browser `performance.memory` + server `/api/app-logs`), Auto-Backup count across backup tiers, File Watcher status, and Offline Sync indicator.
   - Configure `refetchInterval: 5000` with `refetchIntervalInBackground: false` (Zero-Stall compliance).
2. `src/components/layout/LocalhostStatusHUD.tsx` (create):
   - Sleek compact badge pill for sticky header showing status LED + Port 3001 + Heap MB + Backup count + Offline Sync.
   - Expanded high-contrast dark theme HUD Modal (`slate-950`/`slate-900`) detailing memory gauges, backup tier stats, file watcher path, and daemon logs button.
3. `src/components/Sidebar.tsx`:
   - Integrate `LocalhostStatusHUD` into the sticky top header (enhancing/replacing the daemon logs button slot).

Verification:
- Run `node scripts/run-harness.js` to ensure 0 TypeScript compilation errors, 0 Zod schema errors, and 0 ESLint warnings.

Output:
Write your implementation report to `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_r2\changes.md` and handoff to `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_r2\handoff.md`.
Send a completion message back to parent orchestrator.
