# Challenge Report & Handoff

## 1. Observation
We reviewed the implementation in `scratch/organize-files.py` and the test suite in `scratch/verify-duplicates.py`. We executed the tests and performed exploratory edge-case analysis.

### Verification of Existing Tests
We ran `python scratch/verify-duplicates.py` and obtained the following confirmation:
```
ALL TESTS PASSED SUCCESSFULLY!
```

### Exploratory Edge-Case Findings
We created a custom test script to evaluate name cleaning, tag injection, and keyword extraction on various edge cases and observed the following outputs:
1. **Double Final Tags**: For an input filename `[최종]_★최종★_20260715_회의록.txt`, the pipeline output `std_name` was:
   ```
   20260715_최종★_20260715_회의록.txt
   ```
2. **Short Noun Particle Stripping**: For the content `"밥을 먹었습니다. 집에 가고 싶어요."`, keywords like `"밥을"` and `"집에"` were not stripped of their particles because their potential stems (`"밥"`, `"집"`) were shorter than 2 characters. Consequently, they were treated as stems of length 2 and kept as keywords.
3. **Nested Particle Stripping**: For the content `"서울에서부터 출발하여"`, the word `"서울에서부터"` was stripped only once of its outermost particle (`"부터"`), resulting in `"서울에서"`. The inner particle `"에서"` remained attached.
4. **Cache Management**: The prune logic at the end of the script:
   ```python
   stale_keys = [k for k in global_cache.keys() if not os.path.exists(k)]
   for k in stale_keys:
       global_cache.pop(k, None)
   ```
   correctly identifies and removes absolute path keys for files that no longer exist, preventing stale entries from accumulating.

---

## 2. Logic Chain

### Double Final Tag Prefix Bug
- `clean_final_tag` matches `^(?:\[최종\]|★최종★_)[\s_\-]*` using a single `re.match` without looping.
- Thus, `[최종]_★최종★_20260715_회의록.txt` only has `[최종]_` stripped, returning `★최종★_20260715_회의록.txt` as `clean_name`.
- In `main()`, because `clean_name` does not start with `202\d{5}_`, `has_prefix` is evaluated as `False`.
- The script executes:
  ```python
  std_name = re.sub(r"^[#★\s\*]+", "", clean_name)
  ```
  which strips only the leading `★` from `★최종★_20260715_회의록.txt`, yielding `최종★_20260715_회의록.txt`.
- Prepending the date yields `20260715_최종★_20260715_회의록.txt`. This leaves a dirty `최종★_` tag inside the standardized name.

### Korean Word Particle Stripping Limitations
- In `extract_korean_keywords`, particles are stripped only if `len(potential_stem) >= 2`.
- When a 1-character noun has a 1-character particle (e.g. `"밥을"` -> `"밥"` + `"을"`), the potential stem length is 1. The stripping is bypassed, and the stem remains `"밥을"` (length 2). It then passes the `len(stem) < 2` check and is extracted as a keyword.
- Additionally, the stripping loop uses `break` immediately after a suffix match. Therefore, nested particles like `"에서부터"` have only the outermost suffix (`"부터"`) stripped, leaving `"서울에서"` instead of `"서울"`.

---

## 3. Caveats
- **Gemini API Integration**: The actual API behavior under strict rate-limiting (HTTP 429) was not tested with real network calls due to the `CODE_ONLY` restriction, though the code's local fallback mechanism is logically verified.
- **Time Complexity on Massive Folders**: The duplicate clustering step constructs a similarity graph with $O(N^2)$ comparisons inside each folder. While fine for standard directories, it may cause performance degradation if a single category folder contains thousands of files.

---

## 4. Conclusion
The implementation is highly robust for standard duplicates and cache management, but has minor defects in filename standardization and keyword extraction heuristics.

### Adversarial Challenge Report

| Challenge | Severity | Description | Mitigation |
|---|---|---|---|
| **Double Final Tag Prefix** | **Medium** | Filenames with multiple final tags (e.g., `[최종]_★최종★_...`) are not fully cleaned, leaving a dirty prefix in the middle of the filename. | Modify `clean_final_tag` to strip prefixes repeatedly in a `while True` loop. |
| **Short Noun Particle Stripping** | **Low** | 1-character nouns with particles (like "밥을", "집에") are extracted as keywords with their particles attached. | Allow stripping of particles even if it results in a 1-character stem, but discard the stem afterwards. |
| **Nested Suffix Stripping** | **Low** | Only the outermost particle in nested structures (like "에서부터") is stripped. | Run the particle stripping logic recursively or iteratively on the word. |

---

## 5. Verification Method

To independently verify the Double Final Tag Bug:
1. Create a mock file named `[최종]_★최종★_20260715_회의록.txt` with some dummy content.
2. Run `python scratch/organize-files.py` (ensure to backup files or run in test environment).
3. Inspect the resulting filename. It will contain `_최종★_` in the middle of the name instead of being completely cleaned.
