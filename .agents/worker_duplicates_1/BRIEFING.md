# BRIEFING — 2026-07-15T16:48:00+09:00

## Mission
Implement the filename format upgrade in the duplicate organizer.

## 🔒 My Identity
- Archetype: preview_worker
- Roles: implementer, qa, specialist
- Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_duplicates_1\
- Original parent: de6f3535-3bb7-4a6d-98a0-244ab2c32fb5
- Milestone: Duplicate filename format upgrade

## 🔒 Key Constraints
- CODE_ONLY network mode: No external network access.
- Minimal change principle.
- E2EE bypass: Dev environment offline JSON cache.
- Zod schema error validation, no suppression.
- Correctly output handoff to handoff.md and notify parent orchestrator.

## Current Parent
- Conversation ID: de6f3535-3bb7-4a6d-98a0-244ab2c32fb5
- Updated: not yet

## Task Summary
- **What to build**: Filename format upgrade for duplicates (prefix replacement, tag injection with up to 4 most frequent Korean keywords, real-time cache sync, test updates).
- **Success criteria**: All tests in `scratch/verify-duplicates.py` pass.
- **Interface contracts**: `scratch/organize-files.py` and `scratch/verify-duplicates.py`
- **Code layout**: Source in `scratch/`, tests in `scratch/verify-duplicates.py`

## Key Decisions Made
- Replace "[최종] " prefix with "★최종★_" for final files in duplicate clusters.
- Implement tokenization, particle stripping, and stopword filtering for Korean keyword extraction.
- Strip `_(...)` keyword tags inside `get_clean_base_filename` and clean final tags to keep both idempotent.

## Artifact Index
- d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_duplicates_1\handoff.md — Handoff report detailing work done.
