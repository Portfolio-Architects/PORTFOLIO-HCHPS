# Refinement of Duplicate File Handling and Caching

This file documents the changes made to resolve vulnerability and performance issues in duplicate file processing.

## 1. Tier 4 Binary False Duplicates
- **Observation**: Non-text binary files of the same size but with different content and names (e.g. `20260715_리플릿_시안_A안.bin` vs `20260715_리플릿_시안_B안.bin`) were incorrectly consolidated as duplicates under Tier 4.
- **Change**: Updated Tier 4 comparison logic. If content hashes differ AND their cleaned base names (after stripping copy/version suffixes) differ, they are not classified as duplicates. They must only be duplicates if their hashes match or their base names match exactly.
- **Verification**: Verified using Test Case E, which creates parallel binary options and asserts that they remain unique.

## 2. False Empty Duplicates
- **Observation**: Empty files (0-byte) always shared the same hash (`e3b0c442...`), causing them to be merged under Tier 1 hash matching even if they represented different formats or different placeholder files.
- **Change**: Excluded 0-byte (empty) files from Tier 1-4 comparisons. Added a dedicated check at the top: empty files are only classified as duplicates if both are empty, their file extensions match, and their cleaned base names match exactly.
- **Verification**: Verified using Test Case F, which creates different empty placeholder files and asserts that they remain unique.

## 3. Case-Insensitive Regex Casing
- **Observation**: Suffix-stripping in `get_clean_base_filename` and keyword checks in `has_final_keyword` were case-sensitive and did not support English variants (like `_COPY`, `_Final`) or version tags (`_v1`, `v1`, `v2`, `_1`).
- **Change**: 
  - Added `flags=re.IGNORECASE` to regex replacements in `get_clean_base_filename` and included standard English keywords (`final`, `copy`, `submit`, `dist`).
  - Modified `has_final_keyword` to check lowercase variants and support version tags. Changed `has_final_keyword` to return an integer score (2 for strong final/revision tags, 1 for weak version/copy tags, 0 for none) to allow weighted ranking, preventing newer version tags from incorrectly overriding strong final tags in older files during sorting.
- **Verification**: Verified using Test Case G (case-insensitive cleaning) and Test Case A (keyword priority ranking).

## 4. Cache Write Performance Bottleneck
- **Observation**: Cache serialization and disk writing was performed on every file move in `sync_cache_move()`, causing significant disk I/O bottlenecks (e.g. 500+ writes for 500 duplicates).
- **Change**: Removed `save_search_cache()` from `sync_cache_move()`. Defer writing the cache to disk until the end of the batch process (at the end of `main()`), while updating the in-memory cache map `global_cache` in real-time.
- **Verification**: Verified using Test Case H, which monitors the number of disk writes and asserts it is exactly 1 at the end of the execution.
