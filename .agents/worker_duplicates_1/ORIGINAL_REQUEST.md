## 2026-07-15T07:44:47Z
You are teamwork_preview_worker. Your working directory is d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_duplicates_1\.
Your task is to implement the filename format upgrade in the duplicate organizer.

### Requirements:
1. R1: Replace "[최종] " prefix with "★최종★_" for final files in duplicate clusters.
   - Modify `clean_final_tag(filename)` to strip both `[최종]` and `★최종★_` prefixes to keep it idempotent.
   - Prepend new tag when final files are moved/renamed.
2. R2: Tag Injection: extract up to 4 most frequent Korean keywords from document body text (PDF/HWPX) and append them in the format `_(keyword1, keyword2, keyword3)` before the extension.
   - Implement `extract_korean_keywords(content)` in python using regex-based tokenization, particle-stripping (e.g. 조사 like 은/는/이/가/을/를/의/에/과/와/로/으로/에서/부터/까지/하고), and stopword filtering (structural/administrative terms like 및/등/경우/내용/결과/보고/계획/사업/현황).
   - Ensure the particle stripping is done only if the resulting stem is at least 2 characters (e.g. "회의" should not strip "의" to become "회").
   - Update `get_clean_base_filename` to strip `_(...)` keyword tags (using regex like `_\([^)]+\)$`) to ensure it's idempotent.
   - In Pass 2 of `main()`, for duplicate clusters, get the clean base name, extract keywords from the final file's content, format the new name with keywords and prepended prefix, resolve collision, and move it.
3. R3: Real-Time Cache Sync: ensure `.search_cache.json` is updated in real time via the existing `sync_cache_move` and `save_search_cache` flow.
4. Update `scratch/verify-duplicates.py` tests:
   - Update existing assertions to expect `★최종★_` and the keyword tags.
   - Add a new Test Case I validating R1/R2, specifically checking keyword extraction, stopword filtering, and tag injection.
5. Run the verification script: `python scratch/verify-duplicates.py` and ensure ALL tests pass successfully.

MANDATORY INTEGRITY WARNING:
> DO NOT CHEAT. All implementations must be genuine. DO NOT
> hardcode test results, create dummy/facade implementations, or
> circumvent the intended task. A Forensic Auditor will independently
> verify your work. Integrity violations WILL be detected and your
> work WILL be rejected.

Please write your implementation report (detailing changes made, command run, test results output) to d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_duplicates_1\handoff.md and notify the parent orchestrator.
