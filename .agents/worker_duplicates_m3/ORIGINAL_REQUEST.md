## 2026-07-15T02:24:47Z
You are the Worker subagent for the Duplicate detection project.
Your identity is: worker_duplicates_m3
Your working directory is: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_duplicates_m3

Objective:
Implement similarity-based duplicate file detection in `scratch/organize-files.py` as detailed in the design report `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_duplicates_m2\design.md`.

Input Information:
- Core script: `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\organize-files.py`
- Design report: `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_duplicates_m2\design.md`
- Original request requirements in `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\orchestrator_duplicates\ORIGINAL_REQUEST.md`

Requirements to implement:
1. Implement helper functions for SHA-256 hash calculation, Cosine Similarity of text content (using math & re, no external library), and Filename Similarity using difflib.SequenceMatcher.
2. Enhance cache entries inside `.search_cache.json` to store `"hash"`. Make sure the hash is computed and stored during the file scan. Ensure `get_inferred_date_and_content` takes advantage of this cached hash.
3. Prioritize processing of already-structured files. Sort `all_files_info` by path depth (descending) before iteration to ensure existing files act as "originals" and newly scanned/shallow/unsorted files are flagged as duplicates.
4. Implement duplicate check in the main loop:
   - For each scanned file, check if a file with similar characteristics exists in the target `dest_dir` (using the files currently listed in `dest_dir` or populated in `updated_cache` / `global_cache` for that directory).
   - Match criteria:
     - Exact content match: SHA-256 hash equality.
     - Text files: Cosine similarity >= 80%, OR (Cosine similarity >= 50% AND filename similarity >= 80%).
     - Non-text files: Filename similarity >= 80% AND size difference <= 5% (size similarity >= 95%).
   - If a duplicate is detected, adjust the destination directory to `os.path.join(dest_dir, "_Duplicates")`.
   - Resolve filename collisions in `_Duplicates` using `resolve_filename_collision`.
5. Update cache integrity:
   - Ensure the new final destination path is saved in the cache.
   - Ensure the old path is removed from the cache.
6. Safety Rules:
   - Do NOT delete/remove files. Only use `shutil.move` for transfers.
   - Do NOT use `os.remove` or `os.unlink` on user files. If a transfer fails, keep the original file.
   - Safe disk I/O backups.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Output Requirements:
- Write a handoff report at `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_duplicates_m3\handoff.md` detailing the changes made, build/test validation status, and how layout compliance is verified.
- Do NOT declare the task complete until you have verified that the updated `scratch/organize-files.py` compiles and runs.
