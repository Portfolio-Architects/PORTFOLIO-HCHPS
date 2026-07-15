# Handoff Report - Duplicate Processing Engine Verification

This report documents the verification, stress testing, and boundary case analysis of the duplicate processing engine in `scratch/organize-files.py`.

---

## 1. Observation

- **Implementation File**: `scratch/organize-files.py`
- **Testing Script**: `scratch/stress_test_organize_files.py` (which runs isolated scenarios using patched directories and real module imports).
- **Tool Commands Executed**:
  - `python scratch/stress_test_organize_files.py`
  - `python scratch/test_individual.py`
  - `python scratch/test_casing_only.py`

### Direct Log Outputs and Behaviors:
1. **Empty Files in Same Destination**:
   - Files: `20260715_양재천_지출_청구서A.txt` and `20260715_양재천_지출_청구서B.txt` (both 0 bytes).
   - Log output:
     ```
     ⚠️  중복 파일 발견: '20260715_양재천_지출_청구서B.txt' -> '20260715_양재천_지출_청구서A.txt' (moved to _Duplicates)
     📦 이관 완료: 03_양재천_건강걷기_및_걷자페스티벌\2026년\02_일반지출\_Duplicates\20260715_양재천_지출_청구서B.txt
     📦 이관 완료 (최종): 03_양재천_건강걷기_및_걷자페스티벌\2026년\02_일반지출\[최종] 20260715_양재천_지출_청구서A.txt
     ```
2. **English Casing and Tags**:
   - Files: `20260715_양재천_회의록_FINAL.txt` and `20260715_양재천_회의록_COPY.txt`.
   - Log output:
     ```
     📦 이관 완료 (최종): 03_양재천_건강걷기_및_걷자페스티벌\2026년\06_기타서류\[최종] 20260715_양재천_회의록_COPY.txt
     ```
   - The regex match did not strip `_COPY` from the filename.
3. **Collided Sizes / Binary Files (Tier 4)**:
   - Files: `20260715_리플릿_디자인_시안_A안.bin` and `20260715_리플릿_디자인_시안_B안.bin` (both 100 bytes, different random contents).
   - Log output:
     ```
     ⚠️  중복 파일 발견: '20260715_리플릿_디자인_시안_B안.bin' -> '20260715_리플릿_디자인_시안_A안.bin' (moved to _Duplicates)
     📦 이관 완료: 06_교육_자료_제작\2026년\05_디자인 시안\_Duplicates\20260715_리플릿_디자인_시안_B안.bin
     📦 이관 완료 (최종): 06_교육_자료_제작\2026년\05_디자인 시안\[최종] 20260715_리플릿_디자인_시안_A안.bin
     ```
4. **Quadratic Scaling**:
   - Log output from benchmark:
     - `N = 50`: 1225 comparisons took 0.0320 seconds.
     - `N = 100`: 4950 comparisons took 0.1112 seconds.
     - `N = 200`: 19900 comparisons took 0.3829 seconds.
     - `N = 500`: 124750 comparisons took 2.7201 seconds.

---

## 2. Logic Chain

1. **Observation 1** shows that two 0-byte text files are clustered as duplicates.
   - **Reasoning**: Line 822 of `scratch/organize-files.py` performs a SHA-256 hash comparison: `if info_i["hash_val"] and info_j["hash_val"] and info_i["hash_val"] == info_j["hash_val"]: is_dup = True`. Since 0-byte files return a valid SHA-256 hash string (`e3b0c442...`), they are grouped as duplicates.
   - **Conclusion**: Distinct empty placeholders mapping to the same folder suffer from false-positive consolidation.

2. **Observation 2** shows that `_COPY` was not cleaned from the final file name.
   - **Reasoning**: Line 155 of `scratch/organize-files.py` uses `name = re.sub(r"[\s_\-]+(?:최종안?|수정완료|제출용|배포용|복사본|copy)$", "", name)`. This regex does not specify `re.IGNORECASE`, so uppercase tags like `COPY` or `FINAL` are skipped.
   - **Conclusion**: Casing mismatch prevents proper cleaning of English final tags.

3. **Observation 3** shows that binary files of the same size and similar names are merged despite different content.
   - **Reasoning**: Lines 831-835 specify Tier 4 logic: `elif (not info_i["content"] or not info_j["content"]) and get_filename_similarity(info_i["std_name"], info_j["std_name"]) >= 0.80` and `size_diff_ratio <= 0.05`. Because the files are binary, their `content` is empty. The names `리플릿_디자인_시안_A안` and `리플릿_디자인_시안_B안` have a similarity of `91.67%` (>= 80%), and their sizes are identical.
   - **Conclusion**: Tier 4 logic leads to false-positive deduplication of different revisions/drafts (e.g. A안 vs B안) where content parsing is unavailable.

4. **Observation 4** shows that execution time grows quadratically with $N$.
   - **Reasoning**: The comparison loop compares every file with every other file in the component: `for i in range(N): for j in range(i+1, N)`.
   - **Conclusion**: Scaling to large numbers of files (e.g. 5000) will cause severe CPU bottlenecks (~4.5 minutes of compute time).

---

## 3. Caveats

- We assumed that binary file content parsing is not implemented in `organize-files.py` beyond PDF/HWPX.
- We did not modify the implementation code of `scratch/organize-files.py`, adhering to the "Review-only" key constraint.
- The stress test runs against temporary folders and does not modify the real user data in `F:\부엉이_정리됨`.

---

## 4. Conclusion

The duplicate processing engine is functionally stable under normal conditions and prevents deletion by archiving duplicates in a `_Duplicates` folder. However, it contains **high-risk logic** in Tier 4 and empty-file hash comparisons that will result in **false-positive consolidation of distinct files** (such as separate draft options like A안 and B안, or empty placeholders). It also lacks case-insensitivity for cleaning English tags and suffers from quadratic CPU scaling.

---

## 5. Verification Method

To verify these results independently:
1. Run the stress test script in the workspace directory:
   ```powershell
   python scratch/stress_test_organize_files.py
   ```
2. Verify that the output prints warnings regarding false consolidation of empty files, failed casing cleaning of English tags, and the binary file duplicate bug:
   - `❌ CRITICAL BUG: Different binary files with similar names and same size were consolidated as duplicates`
   - `⚠️  Warning: Filename cleaning did not produce the expected base name!`
3. Verify that the script terminates successfully, cleaning up its temporary directories.
