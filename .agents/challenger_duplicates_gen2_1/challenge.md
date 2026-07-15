## Challenge Summary

**Overall risk assessment**: HIGH

The duplicate processing engine in `scratch/organize-files.py` works correctly for simple, exact duplicates, and does not permanently delete files (they are moved to `_Duplicates` instead). However, several major vulnerabilities and logical design flaws exist that can cause **false-positive consolidation** of distinct files, leading to data layout confusion, incorrect prioritization of older versions, and a severe performance bottleneck when scaling to large directories.

---

## Challenges

### [High] Challenge 1: False Positive Consolidation of Non-text Binary Files (Tier 4)
- **Assumption challenged**: That non-text/binary files with similar names (SequenceMatcher ratio >= 80%) and similar sizes (difference <= 5%) are duplicate revisions.
- **Attack scenario**: A user has two design drafts or assets of the same size, such as `20260715_리플릿_디자인_시안_A안.bin` and `20260715_리플릿_디자인_시안_B안.bin`. Although they represent distinct options with entirely different binary contents (different SHA-256 hashes), they are flagged as duplicates.
- **Blast radius**: One of the distinct drafts is moved to `_Duplicates` (making it less accessible), and the remaining draft is renamed to `[최종]`. This results in functional loss of visibility for valid, non-duplicate files.
- **Mitigation**: Add a content/hash check or avoid grouping binary files as duplicates unless their sizes are identical and a byte-by-byte or partial hash match confirms similarity, or remove Tier 4 logic altogether for binary files with distinct hashes.

### [Medium] Challenge 2: False Positive Consolidation of Empty Files
- **Assumption challenged**: That files with identical content hashes are always duplicate copies of the same document.
- **Attack scenario**: A user creates multiple empty template/placeholder files in the same directory (e.g., `20260715_양재천_지출_청구서A.txt` and `20260715_양재천_지출_청구서B.txt`). Because they are empty (0 bytes), they share the same SHA-256 hash. The engine groups them under Tier 1 hash matching.
- **Blast radius**: One of the empty placeholders is moved to `_Duplicates` and hidden, and the other is renamed to `[최종]`, even though they represent different placeholder paths.
- **Mitigation**: Exclude empty files (0 bytes) from hash-based duplicate comparison.

### [Medium] Challenge 3: Case-Sensitivity and Missing Casing in Final Tag Cleaning
- **Assumption challenged**: That final tags in filenames are always lowercase and use specific Korean keywords.
- **Attack scenario**: A user has files ending with English tags like `FINAL`, `Final`, `COPY`, or version keywords like `final_v2`.
- **Blast radius**: 
  1. The engine's regex `(?:최종안?|수정완료|제출용|배포용|복사본|copy)$` is case-sensitive and misses uppercase English keywords. Thus, tags like `_COPY` or `_FINAL` are not stripped from the final filename, resulting in dirty outputs like `[최종] 20260715_양재천_회의록_COPY.txt`.
  2. The function `has_final_keyword` only checks for Korean words (`최종`, `수정완료`, `제출용`, `배포용`). As a result, files with English final tags (`FINAL.txt`) are ranked lower (score 0) than Korean files, meaning a newer English final file will be discarded in favor of an older Korean draft.
- **Mitigation**: Modify regexes and keyword lists to be case-insensitive (`re.IGNORECASE`) and include standard English tags like `final`, `copy`, and version identifiers.

### [Low] Challenge 4: Quadratic Performance Scaling $O(N^2)$
- **Assumption challenged**: That the number of files mapped to a single destination directory is always small enough for pairwise comparison.
- **Attack scenario**: If a user runs the script on a directory containing thousands of files that all map to a single generic directory (like `08_기타_일반행정\2026년\06_기타서류`), the engine builds a similarity graph by comparing every file pair.
- **Blast radius**: For $N = 1000$ files, the engine must perform 499,500 comparisons. If files have different hashes, it falls back to tokenizing and running cosine similarity or SequenceMatcher. This takes over 10 seconds for $N=1000$, and would take ~4.5 minutes for $N=5000$, stalling the program.
- **Mitigation**: Implement a fast-filtering heuristic. Group files first by size, or use a MinHash/LSH (Locality Sensitive Hashing) pipeline to only compare files that are likely to be similar, avoiding $O(N^2)$ comparisons.

---

## Stress Test Results

- **Massive Duplicates (200 files)** → The engine clusters them successfully into 1 final representative and 199 duplicates → Worked as expected, but shows $O(N^2)$ scaling bottleneck → **PASS** (with performance warning)
- **Empty Files (Different Folders)** → Files map to different folders and are not compared → Both files remain unique in their respective folders → **PASS**
- **Empty Files (Same Folder)** → `청구서A.txt` and `청구서B.txt` have same hash (`e3b0c442...`) → `청구서B` is moved to `_Duplicates`, `청구서A` renamed to `[최종]` → **FAIL** (False positive deduplication)
- **English Casing and Tags** → `FINAL.txt` and `COPY.txt` processed → `COPY.txt` chosen, output named `[최종] ..._COPY.txt` (not cleaned) → **FAIL** (Regex and rank casing bug)
- **Collided Sizes (Binary files)** → `A안.bin` and `B안.bin` (100 bytes, similar names, diff hash) → `B안.bin` moved to `_Duplicates`, `A안.bin` renamed to `[최종]` → **FAIL** (False positive deduplication)
- **Cache Integrity** → Create cache, insert stale key, re-run → Stale key pruned, cache remains healthy → **PASS**

---

## Unchallenged Areas

- **Gemini API Key validation** — We did not test behavior when the API key is invalid but quota is not exhausted (e.g. invalid key format), as the local fallback handles standard exceptions gracefully.
