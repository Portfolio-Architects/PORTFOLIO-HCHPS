# Handoff Report — Duplicates Reorganization & Safety Design

This report outlines the findings and proposed architectural improvements for managing duplicate files in the Owl Archive.

---

## 1. Observation
- The file `scratch/organize-files.py` implements an online duplicate detection strategy:
  ```python
  722:         # DUPLICATE DETECTION LOGIC
  723:         is_duplicate = False
  ...
  727:         if os.path.exists(dest_dir):
  728:             existing_files = [f for f in os.listdir(dest_dir) if os.path.isfile(os.path.join(dest_dir, f))]
  ```
  And when a duplicate is found:
  ```python
  802:         if is_duplicate:
  803:             dest_dir = os.path.join(dest_dir, "_Duplicates")
  ```
- Filename prefix standardization is performed inline during traversal:
  ```python
  674:         if not has_prefix:
  675:             clean_file = re.sub(r"^[#★\s\*]+", "", file)
  676:             clean_file = f"{inferred_date}_{clean_file}"
  ```
- Cache synchronization currently happens only at the end of the script:
  ```python
  871:     global_cache = updated_cache
  872:     save_search_cache()
  ```
- The test suite in `scratch/verify-duplicates.py` runs a mock environment using `shutil.rmtree` and `os.makedirs` in `scratch/test_env` to verify duplicate movement behaviors using:
  ```python
  108: # Check exact duplicate
  109: f1 = find_file(all_moved_files, dir_contract, "contract_original")
  110: f2 = find_file(all_moved_files, dup_contract, "contract_duplicate")
  ```

---

## 2. Logic Chain
1. **Observation 1 & 2**: Because files are processed and moved one-by-one, they are compared only against files already sitting in `dest_dir`. If `file_a` (no final tag) is processed before `file_b` (tagged with "최종"), `file_a` is placed in the root of `dest_dir`, and when `file_b` is subsequently processed, it is identified as a duplicate and relegated to `_Duplicates`.
2. **Observation 1 & 2**: To ensure that the final file is placed in the root directory and prepended with `[최종]` while older drafts or non-tagged duplicates go to `_Duplicates`, we need to group all files by `dest_dir` and cluster them into duplicate/similarity groups *before* any file movement occurs.
3. **Observation 3**: If the script is aborted mid-execution, the cache file on disk (`.search_cache.json`) will not be written to, resulting in an out-of-sync cache. Calling `save_search_cache()` in real-time immediately after each move/rename ensures consistency.
4. **Observation 4**: The test cases in `verify-duplicates.py` need updates to verify:
   - Prepended `[최종]` tag on final files.
   - Correct ranking (keyword priority > mtime).
   - Zero Deletion Guard (resolving name collisions via `resolve_filename_collision`).
   - Real-time cache updates.

---

## 3. Caveats
- **Gemini API Quota Fallback**: The design must seamlessly handle quota exhaustion by using the local text parsing summarization logic, as the test script disables the Gemini API (`org.get_ai_content_summary = lambda filename, content, target_work: ""`).
- **Binary Files Content Comparison**: Similarity in binary/non-text files relies on file size and filename similarity (Tier 4), as full text parsing is unavailable.

---

## 4. Conclusion
We recommend transforming `scratch/organize-files.py` to follow a **Group-Before-Organize** architecture. Files should be pre-classified, grouped by target path, clustered into similarity sets using Tiers 1-4, ranked using keywords and `mtime` to find the final file, and then moved with real-time cache synchronization and Zero Deletion collision checks.

---

## 5. Verification Method
1. **Inspection**:
   - Verify `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_duplicates_gen2_2\analysis.md` exists and contains the design details.
2. **Unit Testing**:
   - The test script `scratch/verify-duplicates.py` can be updated with the new test cases (Test Cases 5-8) and run using:
     ```powershell
     python scratch/verify-duplicates.py
     ```
   - If the script outputs `ALL TESTS PASSED SUCCESSFULLY!`, the implementation is verified.
