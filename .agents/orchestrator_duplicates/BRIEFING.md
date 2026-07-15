# BRIEFING — 2026-07-15T11:18:00+09:00

## Mission
Implement similarity-based duplicate file detection and safe transfer to `_Duplicates` directories with search cache integrity and verification.

## 🔒 My Identity
- Archetype: orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\agents\orchestrator_duplicates
- Original parent: parent
- Original parent conversation ID: 3c9c0b0a-ff34-43d1-8432-3a67d79010ca

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\orchestrator_duplicates\plan.md
1. **Decompose**: Decompose the task into milestones/work items to be implemented by subagents.
2. **Dispatch & Execute** (pick ONE):
   - **Direct (iteration loop)**: Direct the Explorer, Worker, and Reviewer subagents.
   - **Delegate (sub-orchestrator)**: Spawn a sub-orchestrator for larger subtasks.
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: Self-succeed at 16 spawns, write handoff.md, spawn successor.
- **Work items**:
  1. Requirements analysis and plan.md [pending]
  2. Implement similarity-based duplicate detection [pending]
  3. Safe transfer to `_Duplicates` folders [pending]
  4. Cache path mapping integrity in `.search_cache.json` [pending]
  5. Create verification script `scratch/verify-duplicates.py` [pending]
  6. Verify script runs successfully [pending]
- **Current phase**: 2
- **Current focus**: 2. Design & Exploration

## 🔒 Key Constraints
- Never write, modify, or create source code files directly.
- Never run build/test commands yourself — require workers to do so.
- May use file-editing tools ONLY for metadata/state files (.md) in the .agents/ folder.
- No file deletion/removal (only shutil.move), and safe disk I/O backups.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.

## Current Parent
- Conversation ID: 3c9c0b0a-ff34-43d1-8432-3a67d79010ca
- Updated: not yet

## Key Decisions Made
- [TBD]

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| explorer_m2 | teamwork_preview_explorer | Design & Exploration | completed | 27adeddd-d33c-494f-a8fc-d8a8eceee635 |
| worker_m3 | teamwork_preview_worker | Implementation & Testing | completed | 9073d884-9aba-4419-953a-659109c064d1 |
| worker_m4 | teamwork_preview_worker | Verification Execution | completed | 971cae54-025b-4c03-bc1d-34cb00a56c41 |
| worker_sync | teamwork_preview_worker | Patch Logging & Sync | completed | cb9bd557-dd72-4226-8ccd-de71628c0515 |

## Succession Status
- Succession required: no
- Spawn count: 4 / 16
- Pending subagents: none
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: none
- Safety timer: none
- On succession: kill all timers before spawning successor
- On context truncation: run `manage_task(Action="list")` — re-create if missing

## Artifact Index
- d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\orchestrator_duplicates\ORIGINAL_REQUEST.md — Original User Request
- d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\orchestrator_duplicates\progress.md — Progress tracking and heartbeat
