# Handoff Report: Duplicate File Reorganization Optimization

## 1. Observation

- **Engine Script Path:** `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\organize-files.py`
  - In `organize-files.py`, the final tag stripping is handled by:
    ```python
    130: def clean_final_tag(filename: str) -> (str, bool):
    131:     """Strip [최종] prefix if present, return cleaned filename and a boolean indicator."""
    132:     has_final_tag = False
    133:     name = filename
    134:     match = re.match(r"^\[최종\][\s_\-]*", name)
    135:     if match:
    136:         has_final_tag = True
    137:         name = name[match.end():]
    138:     return name, has_final_tag
    ```
  - The legacy `[최종]` prefix is assigned by:
    ```python
    957:                 clean_base = get_clean_base_filename(final_info["std_name"])
    958:                 proposed_final_name = "[최종] " + clean_base
    ```
  - File reading and caching are performed inside `get_inferred_date_and_content` (lines 325–417) for `.pdf` and `.hwpx` extensions, storing the result in `global_cache` which maps absolute paths to metadata.
  - Cache synchronization is executed synchronously when moving/renaming:
    ```python
    190: def sync_cache_move(old_abs_path: str, new_abs_path: str, file_meta: dict):
    ```
    And stale keys are pruned at the end of the execution (lines 974–976).

- **Test Suite Path:** `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\verify-duplicates.py`
  - The script executes multiple test cases (A through H) using mock files within a temporary directory `scratch/test_env` and asserts successful organization and cache updates.
  - Running `python scratch/verify-duplicates.py` currently outputted:
    ```
    ✓ Test Case C (Repeat-Run Prefix Accumulation Prevention) Passed.
    Cache contains 4 entries.
    ✓ Test Case D (Real-time Cache Write & Pruning) Passed.
    ...
    ALL TESTS PASSED SUCCESSFULLY!
    ```

- **Requirements Path:** `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\ORIGINAL_REQUEST.md` (lines 51–90) details the follow-up requirements:
  - R1: Use prefix `★최종★_` for final files to force top-level sorting in Windows Explorer.
  - R2: Extract up to 4 most frequent Korean keywords from document bodies (PDF/HWPX), append as `_(keyword1, keyword2...)` before extension. Stopwords and particles must be filtered out.
  - R3: Ensure real-time cache synchronization in `.search_cache.json` for the new filename format.
  - Automated Tests: Update `verify-duplicates.py` to assert the new format and prevent prefix/tag accumulation.

---

## 2. Logic Chain

1. **R1 (Prefix Replacement):** Replacing `[최종] ` with `★최종★_` requires updating the final prefix generation line (`proposed_final_name = "★최종★_" + clean_base`) and broadening the pattern matching in `clean_final_tag(filename)` to match `^(?:\[최종\]|★최종★)[\s_\-]*`. This ensures that on repeated runs, files with either the old or new final prefix are recognized as final files, stripped of their prefix during processing, and processed without accumulation.
2. **R2 (Keyword Tagging):**
   - Documents processed for keywords are those of `.pdf` and `.hwpx` types where content is extracted and cached.
   - Korean words can be extracted with regex `[가-힣]+`.
   - Stripping particles (은/는/이/가/을/를/의/에/과/와/로/으로...) and common verb endings (합니다, 하다, 되다...) from the end of words is required. Because Korean is agglutinative, these can be recursively stripped.
   - However, if a word is reduced to less than 2 characters (e.g. stripping `과` from `성과` would leave `성`), it will be discarded as a short word. To prevent this, we must only strip suffixes if the resulting word length is at least 2 characters.
   - Standard stopwords (like `실적`, `계획`, `보고`) must be defined and filtered.
   - Counting and sorting frequencies (descending frequency, then alphabetical ascending for ties) allows selecting up to 4 stable, deterministic keywords.
   - Appending this as `_(keyword1, keyword2, keyword3, keyword4)` before the extension requires updating the final filename assembly and updating `get_clean_base_filename` to strip existing keyword tags `_(\([^)]+\))` to prevent accumulation on repeat runs.
3. **R3 (Cache Sync):** Since `sync_cache_move` already populates absolute path keys, cache sync is guaranteed for the new filenames as long as the new destination paths are passed to it. Making `get_clean_base_filename` strip the keyword tag is sufficient to keep cache keys valid and hit-rate high on repeat runs.
4. **Verification Updates:** Since the test suite mocks text contents and asserts exact names, updating the assertions to check for `★최종★_` and keyword tags, plus adding a new Test Case I, will ensure correctness and regression safety.

---

## 3. Caveats

- **Network-dependent AI Summary:** The AI summary is bypassed in tests (`org.get_ai_content_summary = lambda ...: ""`), and the local fast summary (`get_local_content_summary`) is used instead. The design ensures keyword extraction works purely locally based on document body text.
- **Empty Files/Non-Text Formats:** If files are empty or do not have PDF/HWPX extensions, no keywords are extracted and no `_(...)` tag is appended. This conforms to the "up to 4" requirement (meaning 0 keywords is acceptable for empty/binary files).
- **External Libraries:** The extraction logic is designed using pure Python standard library regex and sorting to avoid external dependencies like KoNLPy or NLTK, which might not be present in the execution environment.

---

## 4. Conclusion

The proposed design strategy successfully satisfies R1, R2, and R3. It introduces the `★최종★_` prefix, establishes a robust local Korean NLP keyword extraction function that protects 2-character nouns from particle over-stripping, maintains real-time cache synchronization, and provides a concrete suite of test updates to assert the new formats.

---

## 5. Verification Method

To verify the changes when implemented:
1. Run the updated test suite command:
   ```powershell
   python scratch/verify-duplicates.py
   ```
2. Verify that it prints `ALL TESTS PASSED SUCCESSFULLY!` and that the newly added `Test Case I` passes.
3. Inspect `scratch/test_env` during test execution or trace the output file list to ensure final files are generated with names like `★최종★_YYYYMMDD_파일명_(keyword1, keyword2).ext`.
4. Inspect `.search_cache.json` created under the test environment to check that cache keys match the new filename format exactly.
