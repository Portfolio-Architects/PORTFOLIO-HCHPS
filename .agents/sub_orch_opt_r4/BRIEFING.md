# BRIEFING — 2026-07-16T16:55:00Z

## Mission
Sub-orchestrate Milestone 5: API Data Fetching Delay and Local Caching Optimization (R4) to ensure all tests, reviews, and audits pass.

## 🔒 My Identity
- Archetype: teamwork_preview_orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\sub_orch_opt_r4
- Original parent: 21941f1b-1bd7-4e5b-8148-ec70fc77477b
- Original parent conversation ID: 21941f1b-1bd7-4e5b-8148-ec70fc77477b

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\sub_orch_opt_r4\SCOPE.md
1. **Decompose**: The scope is a single milestone (Milestone 5). We will run the iteration loop (Explorer findings already available -> Worker -> Reviewer + Challenger -> Forensic Auditor).
2. **Dispatch & Execute** (pick ONE):
   - **Direct (iteration loop)**: Iterate: Worker implements changes -> Reviewer + Challenger verify -> Auditor audits -> Check gate.
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: Self-succeed at 16 spawns, write handoff.md, spawn successor.
- **Work items**:
  1. Optimize query defaultOptions in providers.tsx [pending]
  2. Update hooks (useTasks, useBudget, useContacts, useGuidelines) [pending]
  3. Implement optimistic updates and error rollback in hooks [pending]
- **Current phase**: 2B (Iteration Loop)
- **Current focus**: Read input documents and start first iteration loop.

## 🔒 Key Constraints
- Maximize local cache reuse (staleTime 5m, gcTime 30m)
- Implement optimistic updates for hooks
- Run build/lint check
- Run Forensic Auditor (hard gate)
- Never reuse a subagent after it has delivered its handoff — always spawn fresh

## Current Parent
- Conversation ID: 21941f1b-1bd7-4e5b-8148-ec70fc77477b
- Updated: 2026-07-16T16:55:00Z

## Key Decisions Made
- [TBD]

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| worker_opt_r4 | teamwork_preview_worker | Implement cache optimization & optimistic updates | in-progress | 8585ff56-3028-4f8b-8a00-6bea87991ec5 |

## Succession Status
- Succession required: no
- Spawn count: 1 / 16
- Pending subagents: [8585ff56-3028-4f8b-8a00-6bea87991ec5]
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: task-27
- Safety timer: none
- On succession: kill all timers before spawning successor
- On context truncation: run `manage_task(Action="list")` — re-create if missing

## Artifact Index
- d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\sub_orch_opt_r4\SCOPE.md — Milestone 5 Scope Document
- d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\sub_orch_opt_r4\ORIGINAL_REQUEST.md — Verbatim user request
