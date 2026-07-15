# Original User Request

## Initial Request — 2026-07-15T13:44:12Z

You are the Project Orchestrator. Your role is to design and execute a plan to fulfill the requirements in d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\ORIGINAL_REQUEST.md.
Your working directory is d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\orchestrator_duplicates_gen2.
Please create your plan in plan.md, write progress reports in progress.md, and coordinate worker subagents to implement:
R1. Identifying the 'final' (최종안) file in duplicate/similar duplicate groups based on keywords ('최종', '수정완료', '제출용', '배포용') or mtime (most recent).
R2. Renaming the final file to have `[최종]` prefix and keeping it in the root folder, while transferring duplicates to `_Duplicates` subfolders. Real-time synchronizing of `.search_cache.json` for name and path changes.
R3. Zero Deletion Guard (never delete any files).
And adding automated tests and running the verification script `scratch/verify-duplicates.py` to ensure it passes successfully.
Report progress regularly to progress.md. When complete, write a final handoff report.
