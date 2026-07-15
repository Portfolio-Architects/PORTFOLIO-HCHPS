# Plan - Duplicate Engine Optimization & Verification

This plan outlines the steps to implement final file identification and marking logic in the duplicate processing engine (`scratch/organize-files.py`), verify with `scratch/verify-duplicates.py` (which must be updated to cover the new test cases), and ensure cache synchronization and zero deletion.

## Steps

### Step 1: Explore & Analyze Current Logic (Explorer)
- Dispatch 3 Explorers to investigate `scratch/organize-files.py` and `scratch/verify-duplicates.py`.
- Formulate a precise design to:
  1. Group files that are determined to be duplicates/similar (based on the existing 4 similarity Tiers) before moving/marking.
  2. For each duplicate group, identify the "final" file based on:
     - Keywords ('최종', '수정완료', '제출용', '배포용') in the filename (case-insensitive, substring match).
     - If none or multiple have keywords, use `mtime` (most recent).
  3. Prepend `[최종]` to the filename of the final file. Keep it in the root folder.
  4. Move other files in the duplicate group to `_Duplicates/` subfolder without the `[최종]` prefix.
  5. Real-time synchronize `.search_cache.json` for all name and path changes (using absolute paths).
  6. Ensure Zero Deletion Guard (never delete/overwrite files, resolve collisions).
  7. Add automated tests inside `scratch/verify-duplicates.py` as specified in `ORIGINAL_REQUEST.md`.

### Step 2: Implementation (Worker)
- Dispatch a Worker to implement the designed modifications in `scratch/organize-files.py` and `scratch/verify-duplicates.py`.
- Run the python verification script and ensure it passes successfully.

### Step 3: Verification & Review (Reviewers, Challengers, Auditor)
- Dispatch 2 Reviewers independently to check the correctness, completeness, and safety of the changes.
- Dispatch 2 Challengers to empirically verify the solution's correctness and performance under edge cases.
- Dispatch a Forensic Auditor to ensure no cheating, dummy implementations, or integrity violations occurred.

### Step 4: Final Sign-off
- Synthesize all findings and report final status to the user.
