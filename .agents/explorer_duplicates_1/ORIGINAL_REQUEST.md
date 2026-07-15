## 2026-07-15T07:42:57Z
You are teamwork_preview_explorer. Your working directory is d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_duplicates_1\.
Please analyze:
- d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\organize-files.py
- d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\verify-duplicates.py
- d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\PROJECT.md
- d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\ORIGINAL_REQUEST.md

Propose a detailed design strategy for implementing:
1. R1: Replacing "[최종] " prefix with "★최종★_" for final files.
2. R2: Extracting up to 4 most frequent Korean keywords from the document body (PDF/HWPX) to append as `_(keyword1, keyword2, keyword3)` before the extension.
   - Describe a robust frequency analysis method in Python.
   - Design a regex or basic list of stopwords (particles like 은/는/이/가/을/를/의/에/과/와/로/으로, and common Korean verbs/adjectives/adverbs or non-noun terms) to filter out non-noun or non-meaningful terms.
3. R3: Ensuring real-time cache synchronization in `.search_cache.json` for the new filename format.
4. Updates to `scratch/verify-duplicates.py` to add new test cases verifying the new format.

Write your findings to d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_duplicates_1\analysis.md and notify the parent orchestrator.
