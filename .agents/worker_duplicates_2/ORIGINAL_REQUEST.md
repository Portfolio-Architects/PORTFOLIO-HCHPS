## 2026-07-15T17:12:20+09:00
You are teamwork_preview_worker. Your working directory is d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_duplicates_2\.
Your task is to refine the implementation in `scratch/organize-files.py` and update the test scripts.

Specifically, perform these tasks:
1. Fix the Double-Prefix Cleaning:
   - In `scratch/organize-files.py`, modify `clean_final_tag(filename)` to clean both legacy `[최종]` and new `★최종★_` prefixes repeatedly (using a loop like `while True`) until no more tags are found.
   - For example, if a file has the name `[최종]_★최종★_20260715_회의록.txt`, it should be completely cleaned to `20260715_회의록.txt` and the function should return `(clean_name, True)`.
2. Fix Outdated Assertions in the Challenge Script:
   - In `scratch/test-duplicates-challenge.py`, update all assertions and matches that expect `[최종]` (like lines 97, 100, 226, 229, 237) to look for the new `★최종★_` prefix and accommodate any trailing keyword tags.
   - For example, line 237 checking `is_fully_cleaned = actual_base_name == "[최종] 20260715_바른자세_보고서.txt"` should check `actual_base_name.startswith("★최종★_20260715_바른자세_보고서")`.
3. Verify that running BOTH `python scratch/verify-duplicates.py` and `python scratch/test-duplicates-challenge.py` succeeds.
4. Update `PORTFOLIO VITAL - Engineering Report.md` with these refinements and run `node scripts/sync-rules.js` to sync rules.
