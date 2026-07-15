## 2026-07-15T14:11:47+09:00

You are the Worker (Gen2). Your working directory is d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_duplicates_gen2_2.

Your task is to refine scratch/organize-files.py and scratch/verify-duplicates.py to resolve the vulnerabilities and performance issues identified by the Challengers.

Read the Challenger reports at:
- Challenger 1: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\challenger_duplicates_gen2_1\challenge.md
- Challenger 2: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\challenger_duplicates_gen2_2\challenge.md

Specific Requirements to implement:
1. In `scratch/organize-files.py`:
   - **Tier 4 Binary False Duplicates**: For non-text binary files (size > 0), do not group them as duplicates under Tier 4 if their content hashes differ AND their cleaned base names (after stripping copy/version suffixes) differ (e.g. `20260715_리플릿_시안_A안.bin` vs `20260715_리플릿_시안_B안.bin`). They must only be duplicates if their hashes match or their base names match exactly.
   - **False Empty Duplicates**: Exclude 0-byte (empty) files from Tier 1 hash-based duplicate comparison. Empty files must only be classified as duplicates if their file extensions match AND their cleaned base names (after stripping copy/version suffixes) match exactly.
   - **Case-Insensitive Regex Casing**: In `get_clean_base_filename` and final keyword score checks, make sure suffix-stripping and keyword checks are case-insensitive (`re.IGNORECASE` or `(?i)`) and support English variants like `final`, `copy`, `submit`, `dist`, `v1`, `v2`, `_1`, etc.
   - **Cache Write Performance Bottleneck**: Defer calling `save_search_cache()` to the end of the batch process (e.g., at the end of `main()`), rather than writing to disk on every single move inside `sync_cache_move()`. Ensure the in-memory cache map `global_cache` is still updated in real-time.
2. In `scratch/verify-duplicates.py`:
   - Enhance the test cases to verify the correct handling of:
     - Parallel binary options of the same size but different contents and names (e.g., `A안.bin` and `B안.bin` are kept as unique files).
     - Empty placeholder files of different names or extensions (are kept as unique files).
     - Case-insensitive tag cleaning (suffixes like `_COPY` and `_Final` are correctly cleaned).
     - Cache writing once at the end.
3. Run the verification script: `python scratch/verify-duplicates.py` and confirm that it outputs "ALL TESTS PASSED SUCCESSFULLY!".

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Document your changes in d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_duplicates_gen2_2\changes.md and write a handoff report. When complete, send a message back to me (Recipient: 1de8bc79-1ac7-4764-a71c-01d215f62aa6) with passing results.
