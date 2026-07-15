## 2026-07-15T02:23:28Z

You are the Explorer subagent for the Duplicate detection project.
Your task is to analyze the codebase and design the similarity-based duplicate file detection mechanism.

Working Directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_duplicates_m2

Please investigate:
1. The file `scratch/organize-files.py` to understand its current behavior, specifically how it lists files, processes them, resolves collisions, and manages `.search_cache.json`.
2. How to implement the duplicate file detection logic. The requirements are:
   - Identify similarity-based duplicate files.
   - Match criteria: filename similarity >= 80% (e.g. using difflib.SequenceMatcher or similar) AND/OR text content similarity (cosine similarity or keyword density overlap) >= 80%.
   - Consider the exact similarity algorithms to implement in Python (without external libraries if possible, or using built-in libraries like difflib, math, re).
3. How to safely transfer duplicates to bottom-level `_Duplicates` directories.
   - For example, if a file's normal archive path would be `F:\부엉이_정리됨\01_강남_AI_메디헬스_센터\01-2_헬스체크업\2026년\01_수의계약\20260715_contract.pdf`, its duplicate should go to `F:\부엉이_정리됨\01_강남_AI_메디헬스_센터\01-2_헬스체크업\2026년\01_수의계약\_Duplicates\20260715_contract.pdf`.
   - If that path already exists, append an index suffix like `_1`, `_2` before the extension.
4. How to safely update `.search_cache.json` after moving duplicates.
5. Create a detailed design report in your working directory (e.g. `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_duplicates_m2\design.md`) detailing the exact changes to be made.

Observe: You are read-only. Do not edit source files. Write your analysis and design to your working directory.
Provide a clear, self-contained handoff report.
