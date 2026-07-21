# BRIEFING — 2026-07-16T14:35:00+09:00

## Mission
Run the rule synchronization script and verify there are no lint or build errors, then document results.

## 🔒 My Identity
- Archetype: teamwork_preview_worker
- Roles: implementer, qa, specialist
- Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\teamwork_preview_worker_final\
- Original parent: f837100e-8966-468e-afe5-abf012fb6aee
- Milestone: Sync rules and verify codebase state

## 🔒 Key Constraints
- Run the rule synchronization script: `node scripts/sync-rules.js`
- Verify that it completes successfully without errors
- Verify that there are no new lint errors or build errors after running the sync
- Document in handoff.md

## Current Parent
- Conversation ID: f837100e-8966-468e-afe5-abf012fb6aee
- Updated: yes

## Task Summary
- **What to build**: Execute rule sync and check codebase health (lint/build).
- **Success criteria**: Rules sync without error, zero new lint/build errors.
- **Interface contracts**: N/A
- **Code layout**: N/A

## Key Decisions Made
- Confirmed that the workspace compiles cleanly using Turbopack Next.js build.
- Checked ESLint rules and confirmed zero failures.

## Artifact Index
- d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\teamwork_preview_worker_final\handoff.md — Handoff report documenting command runs, output, and status.
