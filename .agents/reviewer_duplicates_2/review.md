# Review & Adversarial Challenge Report

This report evaluates the latest patch in `scratch/organize-files.py` and `scratch/verify-duplicates.py`.

---

## 1. Quality Review Report

### Review Summary
**Verdict**: **APPROVE** (with minor recommendations for keyword extraction improvements)

The implementation of the duplicate file helper and its corresponding test suite is of high quality. It covers multiple edge cases (such as 0-byte placeholders, binary files of identical size but different content, and repeat-run prefix accumulation) and exhibits solid caching performance by writing to disk exactly once at the end of execution while maintaining in-memory consistency in real time.

---

### Findings

#### [Minor] Finding 1: Suffix/Verb Endings in Keyword Extraction
- **What**: Verb endings are not stripped from Korean words during keyword extraction.
- **Where**: `scratch/organize-files.py` (lines 171-211) inside `extract_korean_keywords()`.
- **Why**: Suffixes corresponding to verb endings (e.g., `~다`, `~하다`, `~였다`, `~습니다` etc.) are not included in the `particles` list. If a verb ending occurs frequently, it remains attached to the stem and could be extracted as a document keyword (e.g., `"진행하였습니다"` is treated as stem `"진행하였습니다"`).
- **Suggestion**: Add common verb endings or conjugation suffixes (such as `['다', '하다', '였다', '습니다', '합니다', '입니다']`) to the cleaning routine, or filter them out if their stem length is too long without meaningful semantic value.

---

### Verified Claims

- **R1: Prefix replacement from `[최종] ` to `★최종★_`** → verified via Test Case G and Test Case I -> **PASS**
- **Prevention of prefix accumulation on repeat runs** → verified via Test Case C -> **PASS**
- **R2: Keyword extraction from HWPX/PDF text body** → verified via Test Case I -> **PASS**
- **R3: Cache synchronization in `.search_cache.json` in real time** → verified via Test Case D and Test Case H -> **PASS**
- **Test suite assertions & execution** → verified by running `python scratch/verify-duplicates.py` -> **PASS**
- **Layout Compliance** → verified that no source/test/data code resides in `.agents/` -> **PASS**

---

### Coverage Gaps

- **Verb/Adjective Conjugation Suffixes** — risk level: **Low** — recommendation: **Accept risk** since alphabetical tie-breaking and frequency limits naturally push conjugated verbs out of the top 4 keyword list in typical documents.

---

### Unverified Items

- None. All requirements were verified.

---

## 2. Adversarial Review Report

### Challenge Summary
**Overall risk assessment**: **LOW**

The duplicate-detection logic is structured as a robust 4-Tier similarity system (Hash -> Cosine Similarity -> Combo Similarity -> Binary Size/Name similarity). The potential vulnerabilities identified are edge cases related to nested prefixes.

---

### Challenges

#### [Low] Challenge 1: Single-pass Prefix Cleaning (Nested Tags)
- **Assumption challenged**: Assumes filenames only have a single level of `[최종] ` or `★최종★_` prefixes.
- **Attack scenario**: A file is named `★최종★_[최종]_20260715_보고서.hwpx`. Because `clean_final_tag()` uses a single regex match without looping, it only strips the outer `★최종★_`, leaving `[최종]_20260715_보고서.hwpx`. In Pass 1, `clean_name` keeps `[최종]_`, which does not match the date prefix pattern at the start, leading to standardized naming issues.
- **Blast radius**: Low. Standardized filenames may contain redundant tags (e.g., `★최종★_20260715_최종_보고서.hwpx`), but no runtime exception or data corruption will occur.
- **Mitigation**: Update `clean_final_tag()` to strip matching prefixes in a `while True` loop until no more prefixes are matched.

---

### Stress Test Results

- **Parallel Binary Files (Test Case E)** → Two files with same size (100 bytes) but different names/contents must not merge → **PASS** (Kept separate).
- **Empty Placeholders (Test Case F)** → Zero-byte files with different extensions/names must not merge → **PASS** (Kept separate).
- **Prefix Accumulation (Test Case C)** → Running the script twice must not result in filenames starting with `★최종★_★최종★_` → **PASS** (Single prefix preserved).
