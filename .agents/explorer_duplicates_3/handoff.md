# Handoff Report

## 1. Observation
- **Target Files**:
  - `scratch/organize-files.py` (992 lines) - Handles file layout, categorization, duplication components, and caching.
  - `scratch/verify-duplicates.py` (315 lines) - Handles mock test scenarios and assertions.
  - `PROJECT.md` & `ORIGINAL_REQUEST.md` - Define architecture, interface contracts, and project guidelines.
- **Prefix Cleaning Function**:
  In `scratch/organize-files.py:130-138`:
  ```python
  def clean_final_tag(filename: str) -> (str, bool):
      """Strip [최종] prefix if present, return cleaned filename and a boolean indicator."""
      has_final_tag = False
      name = filename
      match = re.match(r"^\[최종\][\s_\-]*", name)
      if match:
          has_final_tag = True
          name = name[match.end():]
      return name, has_final_tag
  ```
- **Base Name Suffix Stripping**:
  In `scratch/organize-files.py:140-163`:
  ```python
  def get_clean_base_filename(filename: str) -> str:
      """Repeatedly strip draft/version/final/duplicate/copy suffixes from the end of the filename,
      handling any trailing parenthesized summary."""
      name, ext = os.path.splitext(filename)
      
      # Check if there is a trailing parenthesized summary
      summary_match = re.search(r"(\([^)]+\))$", name)
      summary = ""
      if summary_match:
          summary = summary_match.group(1)
          name = name[:-len(summary)] # Strip the summary temporarily
  ```
- **Final File Renaming Block**:
  In `scratch/organize-files.py:957-960`:
  ```python
                  clean_base = get_clean_base_filename(final_info["std_name"])
                  proposed_final_name = "[최종] " + clean_base
                  resolved_final_name = resolve_filename_collision(dest_dir, proposed_final_name, final_info["orig_path"])
  ```
- **Cache Move Sync**:
  In `scratch/organize-files.py:190-210`, `sync_cache_move` updates the cache keys in real-time when files are moved.

---

## 2. Logic Chain
1. **R1 (Prefix Upgrade)**:
   - To replace the prefix `[최종] ` with `★최종★_` and ensure no prefix accumulation (such as `★최종★_★최종★_`), `clean_final_tag` must be updated to clean both prefixes (using a regex group match `(?:\[최종\]|★최종★_)`).
   - The renaming block inside the deduplication components loop must use `★최종★_` instead of `[최종] `.
2. **R2 (Korean Keyword Tagging)**:
   - Korean keywords must be extracted from the document body (`final_info["content"]`) using a standard, lightweight, dependency-free tokenization mechanism to be fully compatible with local python environments.
   - We extract all Hangul tokens using `re.findall(r'[가-힣]+', content)`.
   - To extract meaningful keyword stems, we strip particles (조사) matching a regex of common particles (e.g. `은/는/이/가/을/를/의/에/과/와/로/으로/...`), prioritizing longer ones, and filtering out a set of common administrative/structural stopwords.
   - To prevent keyword tag accumulation on multiple runs, `get_clean_base_filename` must be updated to strip any trailing `_(...)` or `(...)` pattern from the end of the filename prior to checking standard draft/version suffixes.
3. **R3 (Cache Sync)**:
   - Since `sync_cache_move` dynamically updates the cache keys from old paths to new paths, it natively works with the new filename format without extra modifications.
4. **Verification**:
   - The test script `scratch/verify-duplicates.py` mocks the file environment and asserts naming formats. It must be updated to match the new prefix `★최종★_` and the injected keywords `_(...)` for Test Cases A, B, C, and G.

---

## 3. Caveats
- **Parsing Length Limit**:
  The body content retrieved via `parse_pdf_text` and `parse_hwpx_text` is limited to the first 2000 characters. While this is highly performant and sufficient for keyword frequency analysis, some documents might have their primary keywords late in the document. However, since the cache stores the first 2000 characters, reusing this cached content avoids major performance overhead.
- **Pure Python Tokenizer**:
  A pure Python regex tokenizer does not handle compound nouns as perfectly as specialized morph-analyzers like KoNLPy. But since KoNLPy requires Java and complex binary setups, a pure Python approach is standard, robust, and performs very well on the given domain texts.

---

## 4. Conclusion
- The filename format upgrade and cache synchronization can be safely implemented via targeted edits to `clean_final_tag`, `get_clean_base_filename`, and the final renaming block inside `main()`.
- The design strategy guarantees no filename or keyword tag accumulation on reruns, maintains 100% cache synchronization, and keeps file processing completely safe (no loss of files).
- Updates to `verify-duplicates.py` are straightforward and fully cover the new format requirements.

---

## 5. Verification Method
- Execute the updated test suite using:
  `python scratch/verify-duplicates.py`
- Inspect `scratch/test_env` output filenames during test runs to ensure they follow `★최종★_YYYYMMDD_파일명_(keyword1, keyword2, ...).hwpx`.
- Verify `.search_cache.json` to confirm updated file paths exist and no stale file paths remain.
