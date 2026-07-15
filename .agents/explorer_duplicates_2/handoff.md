# Handoff Report — explorer_duplicates_2

## 1. Observation
We observed the following files and structural lines in the workspace:
- **`scratch/organize-files.py`**:
  - Line 134: `match = re.match(r"^\[최종\][\s_\-]*", name)` inside `clean_final_tag(filename)` handles stripping of deprecated final tags.
  - Line 155: `name = re.sub(r"[\s_\-]+(?:최종안?|수정완료|제출용|배포용|복사본|copy|final|submit|dist)$", "", name, flags=re.IGNORECASE)` inside `get_clean_base_filename` handles cleaning the base filename.
  - Line 958: `proposed_final_name = "[최종] " + clean_base` prepends the deprecated tag.
  - Lines 190–211: `sync_cache_move(old_abs_path, new_abs_path, file_meta)` updates the in-memory cache mapping, which is saved once at the end of the script execution (Line 977: `save_search_cache()`).
- **`scratch/verify-duplicates.py`**:
  - Line 102: Assertions verify prefix `[최종] 20260715_주요업무보고.hwpx`.
  - Line 111: Assertions verify prefix `[최종] 20260715_체력인증계획.hwpx`.
  - Line 133: Assertions check for multiple `[최종]` tags.
- **`ORIGINAL_REQUEST.md`**:
  - Under `## Follow-up — 2026-07-15T16:36:09+09:00`, requirements detail changing the prefix to `★최종★_` (R1), extracting up to 4 Korean keywords from text using a frequency analysis excluding stopwords and appending it before the extension (R2), and synchronizing with the cache (R3).

---

## 2. Logic Chain
1. To change the final file prefix from `[최종] ` to `★최종★_` (R1), we must modify `clean_final_tag` in `scratch/organize-files.py` to match either prefix and modify the prefix assignment in the Pass 2 duplicate loop from `"[최종] "` to `"★최종★_"`.
2. To extract up to 4 Korean keywords (R2), we must implement a custom stemmer (`extract_korean_keywords`) in `scratch/organize-files.py` since no third-party libraries (e.g. `KoNLPy`) can be installed. This stemmer will use regex tokenization, strip common verb endings and particles, filter out general administrative stopwords, and count frequencies.
3. The extracted keywords must be appended immediately before the file extension, formatted as `_(keyword1, keyword2, ...)`.
4. To make this change idempotent and prevent keyword tags from compounding on reruns, we must update `get_clean_base_filename` in `scratch/organize-files.py` to strip any existing trailing `_(...)` keyword suffix.
5. Real-time cache synchronization (R3) is already native since `sync_cache_move` is called with the resolved `final_dest_path` which contains the new filename, updating absolute paths correctly and purging stale entries at the end.
6. The test script `scratch/verify-duplicates.py` must be updated to modify old assertions checking for `[최종]` to check for the new `★최종★_` prefix, and a new Test Case I must be added to check the keyword extraction, stopword filtering, and tag formatting.

---

## 3. Caveats
- No external Python libraries for morphology (`KoNLPy`, `mecab-ko`, etc.) are assumed to be available. We rely entirely on native regular expressions and custom particle/verb-ending strip rules, which is highly robust for administrative text but might not handle complex agglutinative sentences as perfectly as a full NLP package.
- Stopwords are predefined in a static list. Any very specialized or domain-specific stopwords not in the list might occasionally leak into the keyword list.

---

## 4. Conclusion
The proposed design strategy in `analysis.md` fully addresses R1, R2, and R3, and maps out the exact code structures and test suites needed to implement the requested features without breaking existing functionalities or losing cache integrity.

---

## 5. Verification Method
1. The implementation can be verified by running the updated test script:
   ```powershell
   python scratch/verify-duplicates.py
   ```
2. The exit code should be `0` (indicating `ALL TESTS PASSED SUCCESSFULLY!`).
3. Inspect `scratch/test_env` (or temporary run outputs) to confirm that the created final file names match the regex:
   `^★최종★_20260715_체력인증보고_\(체력인증센터,\s*국민체육진흥,\s*성과계획,\s*기획\)\.hwpx`
   and that no stopwords (e.g. `운영`, `실적`, `보고서`) or deprecated tags are present.
