## Challenge Summary

**Overall risk assessment**: CRITICAL

Through rigorous empirical testing of the duplicate processing engine in `scratch/organize-files.py` (via isolated test harnesses), we identified critical bugs that present substantial data loss risk (hiding unique documents in duplicate subfolders), regex-based cleaning bypasses, and severe disk write performance bottlenecks.

---

## Challenges

### [Critical] Challenge 1: Data Loss / Hiding of Unique Parallel Files (Tier 4 Size/Similarity Fallback)

- **Assumption challenged**: The assumption that non-text/binary files with similar names (>=80%) and similar sizes (<=5% difference) are duplicate versions of the same file.
- **Attack scenario**: If a user has separate parallel design options or assets of the same size (e.g., `20260715_리플릿_디자인_시안_A안.bin` and `20260715_리플릿_디자인_시안_B안.bin` both generated at 500 bytes), Tier 4 matches them as duplicates.
- **Blast radius**: The engine moves the non-selected file (e.g. `B안.bin`) to `_Duplicates` and renames the other to `[최종] 20260715_리플릿_디자인_시안_A안.bin`. This hides valid parallel options, which constitutes severe functional data loss and misleads the user.
- **Mitigation**: Binary files with different hashes must never be treated as duplicates unless there is an explicit version suffix pattern (e.g., `_v1`, `_v2`) present in their names. Alternatively, Tier 4 should be disabled, or restricted to require exact hash matches.

### [High] Challenge 2: Duplicate Consolidation of Semantically Different Empty Files

- **Assumption challenged**: The assumption that files with the same SHA-256 hash are always duplicates.
- **Attack scenario**: Multiple files under the same folder structure happen to be empty (0 bytes). Since they are empty, they share the same hash (`e3b0c442...`). If they map to the same target folder and work domain (e.g. `20260715_기타_회의록_A.txt` and `20260715_기타_회의록_B.txt`), they are consolidated as duplicates, and `B.txt` is moved to `_Duplicates`. Furthermore, empty files of different formats (e.g., `.pdf` vs `.hwpx`) are also consolidated as duplicates.
- **Blast radius**: Legitimate empty placeholder files or templates with different names are incorrectly archived, hiding them from the user's view. Different file formats are merged.
- **Mitigation**: Exclude 0-byte (empty) files from hash-based duplicate comparison, or verify that their base names (excluding version tags) match before treating them as duplicates. Do not match files with different extensions.

### [Medium] Challenge 3: Case-Sensitivity Regex Bypass in Filename Cleaning

- **Assumption challenged**: Suffixes indicating finality, duplicates, or versioning (e.g. `COPY`, `V3`, `Final`) are successfully stripped during filename normalization.
- **Attack scenario**: When a file with uppercase or mixed-case suffixes (like `_COPY_V3.txt` or `_Final.txt`) is processed, `get_clean_base_filename` fails to strip these suffixes because the regexes are case-sensitive and lack the `re.IGNORECASE` flag.
- **Blast radius**: The final file retains the duplicate-related suffixes, resulting in names like `[최종] 20260715_바른자세_보고서_COPY_V3.txt` instead of the expected `[최종] 20260715_바른자세_보고서.txt`.
- **Mitigation**: Add `re.IGNORECASE` to the regex substitutions in `get_clean_base_filename` and include `final` in the keyword pattern list.

### [High] Challenge 4: Sequential Write Cache Bottleneck under Massive Duplicates

- **Assumption challenged**: Real-time cache synchronization is efficient and safe.
- **Attack scenario**: When running the organizer on a large directory or a directory with a massive amount of duplicates (e.g., 500 files), `sync_cache_move` calls `save_search_cache` for every single file moved.
- **Blast radius**: The entire cache file is serialized and written to disk 500+ times sequentially. In our test with 500 duplicate files, this caused the script to take 11.697 seconds and perform 501 full cache write cycles, creating severe disk I/O bottlenecks and unnecessary SSD wear.
- **Mitigation**: Defer writing the cache to disk until the end of the batch process (e.g., after the loop in `main`), rather than saving on every single move.

---

## Stress Test Results

- **Massive Duplicates Performance Test** → Verify that 500 duplicate files are successfully categorized without loss and check execution speed → Finished in 11.697 seconds with 501 cache write operations, identifying a major performance bottleneck → **FAIL (Performance/IO)**
- **Empty & Invalid Files Test** → Verify empty txt files with different names and empty PDF/HWPX files are handled without crashes or false positives → Files processed without crash, but empty text files with different names and different format files (PDF vs HWPX) were consolidated as duplicates → **FAIL (False Positive duplicate consolidation)**
- **Casing and Patterns Test** → Verify cleaning regex removes casing variants like `COPY_V3` and `Final` when normalizing filenames → Suffixes `COPY_V3` and `Final` were not stripped because of case sensitivity and missing patterns, leaving the dirty suffixes in the final name if they were selected → **FAIL (Regex Bypass)**
- **Collided Hashes and Sizes (Tier 4) Test** → Verify binary files of the same size but different contents and similar names are not consolidated → Engine consolidated `A안.bin` and `B안.bin` into a duplicate cluster and moved B안 to `_Duplicates` despite different content/hashes → **FAIL (Data Loss Risk)**

---

## Unchallenged Areas

- **Gemini API Integration** — Gemini API summary generation was mocked (bypassed with `IS_API_QUOTA_EXHAUSTED = True` and empty summaries) during stress tests to avoid network calls and quota issues.
