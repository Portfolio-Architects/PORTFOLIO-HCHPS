# Handoff Report - Explorer 1 (Hard Handoff)

This handoff report summarizes the findings, reasoning, design, and verification plan for implementing final file identification and marking in the duplicate processing engine.

---

## 1. Observation

We directly investigated the following files and content:

### A. Current Iterative Duplicate Processing
In `scratch/organize-files.py` (lines 802-804):
```python
802:         if is_duplicate:
803:             dest_dir = os.path.join(dest_dir, "_Duplicates")
804:             print(f"⚠️  중복 파일 발견: '{clean_file}' -> '{matched_original}' ({duplicate_reason})")
```
This shows that duplicate routing is performed inside the file migration loop on a one-by-one basis, which makes file placement dependent on processing order.

### B. Requirements for Final File Identification
In `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\ORIGINAL_REQUEST.md` (lines 12-21):
```markdown
12: ### R1. 중복 파일 그룹 내 "최종안" 자율 식별
13: - 중복/유사 중복으로 식별된 파일 그룹 내에서 어떤 파일이 최종안인지 판별합니다.
14: - 판별 순위:
15:   1. 파일 이름에 '최종', '수정완료', '제출용', '배포용' 등 최종안을 나타내는 명시적 키워드가 포함된 파일
16:   2. 최종 키워드가 없는 그룹일 경우, 가장 최근에 수정된 시간(mtime)이 가장 최신인 파일
17: 
18: ### R2. 최종안 명시적 표식 부여 및 파일명 표준화
19: - 최종안으로 식별된 파일의 파일명 앞에 `[최종]` 접두사(예: `[최종] 20260715_보고서.hwpx`)를 부여하여 표준화합니다.
```

### C. Required Test Scenarios
In `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\ORIGINAL_REQUEST.md` (lines 29-36):
```markdown
29:   - 묶음 A: `20260715_주요업무보고_1.hwpx` (mtime 이전), `20260715_주요업무보고_수정완료.hwpx` (mtime 최신)
30:   - 묶음 B: `20260715_체력인증계획_1.hwpx` (mtime 최신), `20260715_체력인증계획_2.hwpx` (mtime 이전)
```

---

## 2. Logic Chain

1. **Flaw of Iterative Processing**: In `organize-files.py`, if a draft `A_1.txt` is moved first, it sits in the target root. When a newer/final version `A_최종.txt` is processed next, it gets matched against `A_1.txt`, classified as a duplicate, and sent to `_Duplicates/A_최종.txt`. Thus, the older draft remains in the root.
2. **Need for Batch Clustering**: To ensure that the final file is kept in the root, we must group files before moving them. This is achieved by:
   - Grouping files by their computed target `dest_dir`.
   - Applying Tiers 1-4 similarity checks to group duplicates into clusters (connected components of a similarity graph).
3. **Determining the Final File**: Within each cluster, the final file must be selected by checking:
   - First, whether the file contains keywords `'최종'`, `'수정완료'`, `'제출용'`, `'배포용'`.
   - Second, if there are multiple or zero keyword-matching files, selecting the one with the latest `mtime`.
4. **Renaming the Final File**:
   - The selected final file must be stripped of version/duplicate/final suffixes (like `_수정완료`, `_1`, etc.) to produce a clean base name.
   - It is prepended with `[최종] ` and placed in the target category root.
   - All other files (duplicates) are placed in `_Duplicates/` under their original standardized name (without `[최종] `).
5. **Handling Re-Runs (Prefix Stripping)**: To make the execution idempotent, files starting with `[최종] ` must have this prefix stripped during analysis and have their `had_final_tag` flag set to `True`, which maps to keyword `'최종'` priority.
6. **Real-Time Cache Sync & Zero Deletion**:
   - Immediate serialization of cache on disk prevents desynchronization if the process aborts.
   - The name collision resolver (`resolve_filename_collision`) ensures that duplicate files in `_Duplicates` or the root never overwrite existing files.

---

## 3. Caveats

- **API Summary Quota**: AI-based content summaries are bypassed in tests, using local regex-based summaries instead. The design should work identically for both.
- **Transitivity of Clustering**: Using connected components means that if `File A` is similar to `File B`, and `File B` is similar to `File C`, all three form a single duplicate group, even if `File A` and `File C` are not directly similar. This is the desired behavior for document versions.

---

## 4. Conclusion

We have formulated a robust design for duplicate resolution. The engine should group files by category directory first, apply connected component similarity clustering (Tiers 1-4), rank cluster members to identify the "final" file, prepend `[최종] `, strip duplicate/version suffixes, move other files to `_Duplicates/`, resolve name collisions to ensure zero deletion, and synchronize the cache to disk in real-time.

---

## 5. Verification Method

To verify the implementation:
1. Run the test command:
   ```powershell
   python scratch/verify-duplicates.py
   ```
2. Verify that all assertions for Test Case A (묶음 A) and Test Case B (묶음 B) pass successfully:
   - `[최종] 20260715_주요업무보고.hwpx` must be in the root of the Plans/Reports folder, and `20260715_주요업무보고_1.hwpx` must be in `_Duplicates/`.
   - `[최종] 20260715_체력인증계획.hwpx` must be in the root of the Fitness Centre folder, and `20260715_체력인증계획_2.hwpx` must be in `_Duplicates/`.
   - All paths must be mapped correctly inside `.search_cache.json` with valid SHA-256 hashes.
