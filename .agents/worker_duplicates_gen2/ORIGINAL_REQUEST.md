## 2026-07-15T05:04:14Z
You are the Worker. Your working directory is d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_duplicates_gen2.

Your task is to modify scratch/organize-files.py and scratch/verify-duplicates.py to implement and verify the group-first duplicate organization design.

Read the detailed design and synthesis of findings at:
- Synthesis Report: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\orchestrator_duplicates_gen2\synthesis.md
- Explorer Reports:
  - d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_duplicates_gen2_1\analysis.md
  - d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_duplicates_gen2_2\analysis.md
  - d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_duplicates_gen2_3\analysis.md

Detailed Requirements:
1. In `scratch/organize-files.py`:
   - At the beginning of scan, strip any existing `[최종] ` prefix from the filename to get `clean_name`, and record if it originally had it (`had_final_tag = True`).
   - Standardize/categorize files as usual.
   - Instead of checking and moving files one-by-one on-the-fly, map all files to their target destination directory (`dest_dir`). If a file is currently in a `_Duplicates` folder, its target directory should be resolved to the parent category root (so it is re-evaluated with the others).
   - In each `dest_dir`, cluster files into duplicate groups using a Connected Components algorithm based on the 4 similarity Tiers:
     - Tier 1: SHA-256 hash equality.
     - Tier 2: Text content cosine similarity >= 80%.
     - Tier 3: Text content cosine similarity >= 50% AND SequenceMatcher filename similarity >= 80%.
     - Tier 4: SequenceMatcher filename similarity >= 80% AND size difference <= 5% (for non-text/binary files).
   - In each duplicate cluster of size >= 2:
     - Rank the files to find the single "final" file. The primary ranking is the presence of keywords ('최종', '수정완료', '제출용', '배포용') in the filename or if `had_final_tag` is True. The secondary ranking (tie-breaker) is the most recent modification time (`mtime`).
     - Rename the final file by stripping draft/version/final/duplicate/copy suffixes (like `_최종`, `_수정완료`, `_1`, etc.) from the base name, prepending `[최종] `, and keeping it in `dest_dir`.
     - Rename other duplicate files by stripping any leading `[최종]` prefix and move them to `dest_dir/_Duplicates/`.
     - Use `resolve_filename_collision` to resolve name collisions (ensuring Zero Deletion).
   - In-memory `global_cache` and the `.search_cache.json` file on disk must be synchronized in real-time (immediately after each rename/move operation). At the end of execution, prune stale paths from the cache.
2. In `scratch/verify-duplicates.py`:
   - Modify the mock test case generation and assertions to cover:
     - Test Case A: Keyword Priority (주요업무보고_수정완료 is kept as `[최종] 20260715_주요업무보고.hwpx` in category root, while 주요업무보고_1 is moved to `_Duplicates/`).
     - Test Case B: Most Recent mtime Tie-Breaker (체력인증계획_1 is kept as `[최종] 20260715_체력인증계획.hwpx` in category root, while 체력인증계획_2 is moved to `_Duplicates/`).
     - Test Case C: Repeat-Run prefix accumulation prevention (running organize multiple times does not result in `[최종] [최종] ...`).
     - Test Case D: Real-time cache write and key pruning validation.
3. Run the verification script: `python scratch/verify-duplicates.py` and verify that it outputs "ALL TESTS PASSED SUCCESSFULLY!".

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Document your changes in d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_duplicates_gen2\changes.md and write a handoff report. When complete, send a message back to me (Recipient: 1de8bc79-1ac7-4764-a71c-01d215f62aa6) with passing results.
