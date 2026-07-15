# Handoff Report — Duplicate Processing Engine Stress & Boundary Verification

## 1. Observation

- **Implementation File**: `scratch/organize-files.py`
- **Verification Tool Command**: `python scratch/test-duplicates-challenge.py`
- **Output Results File**: `scratch/test_results.json`
- **Specific Observations**:
  1. **Massive Duplicates performance**: In `scratch/test_results.json` lines 2–8:
     ```json
     "massive_duplicates": {
       "status": "PASS",
       "duration": 11.697146892547607,
       "cache_writes": 501,
       "final_count": 500,
       "dup_count": 499
     }
     ```
  2. **Empty file duplicate consolidation**: In `scratch/test_results.json` lines 9–19:
     ```json
     "empty_invalid_files": {
       "status": "PASS",
       "has_false_positives": true,
       "files": [
         "01_강남_AI_메디헬스_센터\\01-2_헬스체크업\\2026년\\06_기타서류\\[최종] 20260715_기타_회의록_A.txt",
         "01_강남_AI_메디헬스_센터\\01-2_헬스체크업\\2026년\\06_기타서류\\_Duplicates\\20260715_기타_회의록_B.txt",
         "01_강남_AI_메디헬스_센터\\01-2_헬스체크업\\2026년\\06_기타서류\\_Duplicates\\20260715_기타_회의록_C.txt",
         "02_바른자세_개선_사업\\2026년\\04_계획 및 방침\\[최종] 20260715_바른자세_검사계획_empty.hwpx",
         "02_바른자세_개선_사업\\2026년\\04_계획 및 방침\\_Duplicates\\20260715_바른자세_검사계획_empty.pdf"
       ]
     }
     ```
  3. **Case-sensitive regex cleaning bypass**: Running `get_clean_base_filename` on strings:
     - `COPY_V3: 20260715_바른자세_보고서_COPY_V3.txt`
     - `Final: 20260715_바른자세_보고서_Final.txt`
  4. **Collided Hashes/Sizes (Tier 4) duplicate consolidation**: In `scratch/test_results.json` lines 32–39:
     ```json
     "collided_hashes_sizes": {
       "status": "PASS",
       "has_false_duplicate": true,
       "files": [
         "06_교육_자료_제작\\2026년\\05_디자인 시안\\[최종] 20260715_리플릿_디자인_시안_A안.bin",
         "06_교육_자료_제작\\2026년\\05_디자인 시안\\_Duplicates\\20260715_리플릿_디자인_시안_B안.bin"
       ]
     }
     ```

## 2. Logic Chain

1. **IO Slowdown**: In `scratch/organize-files.py`, `sync_cache_move` calls `save_search_cache` on every single file moved. For 500 duplicate files, this translates to 501 serial cache write cycles, which took 11.697 seconds. This scales poorly and increases disk write wear.
2. **False Empty Duplicates**: In `scratch/organize-files.py`, Tier 1 relies strictly on SHA-256 hash equality:
   `info_i["hash_val"] == info_j["hash_val"]`.
   Empty files (regardless of name or type) share the same SHA-256 hash (`e3b0c442...`). Hence, semantically different empty files (like `A.txt` and `B.txt`) or empty files of different formats (like `.pdf` and `.hwpx`) are grouped into the same duplicate component and moved to `_Duplicates`.
3. **Casing Regex Bypass**: Suffix cleaning in `get_clean_base_filename` uses:
   `re.sub(r"[\s_\-]+(?:최종안?|수정완료|제출용|배포용|복사본|copy)$", "", name)` and `re.sub(r"[\s_\-]+(?:v)?\d+$", "", name)`.
   Because no `re.IGNORECASE` flag is set, case-mismatched suffixes like `COPY`, `Final`, or `V3` are not stripped.
4. **False Binary Duplicates**: Tier 4 duplicate condition checks:
   `(not info_i["content"] or not info_j["content"]) and get_filename_similarity(info_i["std_name"], info_j["std_name"]) >= 0.80 and size_diff_ratio <= 0.05`.
   This incorrectly groups independent non-text files that share name similarity and similar sizes (such as `A안.bin` and `B안.bin`), moving the latter to `_Duplicates` despite completely different hashes and contents.

## 3. Caveats

- **AI API Integration**: We mocked the Gemini API (`get_ai_content_summary` returns `""`) to prevent network calls and quota exhaustion during tests. The behavior of AI-assisted summary mapping under heavy load was therefore not evaluated.
- **File Types**: We only tested text files (`.txt`) and binary files (`.bin`). We did not test actual healthy `.pdf` and `.hwpx` file parsing under massive volume since they require complex binary generation, but we mocked the text extraction outputs to represent empty content.

## 4. Conclusion

The duplicate processing engine in `scratch/organize-files.py` works correctly for straightforward identical files but exhibits critical functional risks and performance bottlenecks under specific boundary cases:
1. **Critical Data Loss Risk**: Unique binary files representing different design versions (e.g. `A안` vs `B안`) and semantically different empty placeholder files are incorrectly classified as duplicates and hidden in `_Duplicates` folders.
2. **Regex bypass**: Uppercase/mixed-case versions of finality and duplication suffixes (like `COPY`, `Final`, `V3`) are ignored by the cleaning regex.
3. **Severe performance bottlenecks**: Disk I/O overhead due to redundant cache saving during batch operations makes processing very slow (11.7 seconds for 500 files).

## 5. Verification Method

- Run the test suite:
  ```powershell
  python scratch/test-duplicates-challenge.py
  ```
- Inspect results:
  View the generated JSON file `scratch/test_results.json` and check:
  - `"has_false_duplicate"` in `collided_hashes_sizes` (should be `false` but is currently `true`).
  - `"has_false_positives"` in `empty_invalid_files` (should be `false` but is currently `true`).
  - `"is_fully_cleaned"` in `casing_and_patterns` (should be `true` but would fail if a casing variant was selected as final).
