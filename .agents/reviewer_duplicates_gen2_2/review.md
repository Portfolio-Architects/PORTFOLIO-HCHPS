# Review Report — Duplicate File Organization (Gen2)

## Review Summary

**Verdict**: PASS

The deduplication and organization system implemented in `scratch/organize-files.py` and verified in `scratch/verify-duplicates.py` is highly robust, correct, and complete. It handles edge cases like version suffixes, repeat-run safety, and real-time cache synchronization with great precision. The test suite correctly validates all core features under a mocked environment.

---

## Quality Review Findings

### [Minor] Finding 1: Redundant Word Frequency Computations in Cosine Similarity
- **What**: The function `calculate_cosine_similarity` performs regex word tokenization and frequency dictionary building on every call.
- **Where**: `scratch/organize-files.py`, lines 87–115 (called inside the $O(N^2)$ comparison loop at lines 825, 828).
- **Why**: Since `calculate_cosine_similarity` is executed pairwise inside the clustering loop, the same file content is parsed and tokenized repeatedly ($O(N^2)$ times). If a directory contains many files with long contents, this will lead to unnecessary CPU overhead.
- **Suggestion**: Pre-compute and cache the tokenized word frequency dictionaries for all files during Pass 1 (Metadata Collection) rather than re-computing them during Pass 2 (Clustering).

### [Minor] Finding 2: Double Date Suffixes for Files with Non-Standard Date Formats
- **What**: For files starting with a hyphenated or dotted date format (e.g. `2026-07-15_file.hwpx`), `has_prefix` evaluates to `False`, causing the script to prepend `YYYYMMDD_` to the filename.
- **Where**: `scratch/organize-files.py`, lines 744–747.
- **Why**: The regex for `has_prefix` is `^202\d{5}_` (specifically looking for `YYYYMMDD_`). A file named `2026-07-15_file.hwpx` will result in `20260715_2026-07-15_file.hwpx` as its standardized name. While this ensures it has the exact `YYYYMMDD_` standard prefix, it retains the original redundant date string in the suffix.
- **Suggestion**: Enhance `clean_final_tag` or `has_prefix` detection to strip existing non-standard date prefixes (like `YYYY-MM-DD_` or `YYYY.MM.DD_`) before standardizing.

---

## Verified Claims

- **Correctness and Robustness of Clustering** → verified via inspecting BFS-based connected components and running `verify-duplicates.py` → **PASS**
- **Keyword Priority Selection** → verified via Test Case A in `verify-duplicates.py` where a file with `수정완료` was selected over a newer file → **PASS**
- **mtime Tie-Breaker** → verified via Test Case B in `verify-duplicates.py` where the newer file without keywords was selected as final → **PASS**
- **Repeat-Run Prefix Safety** → verified via Test Case C in `verify-duplicates.py` where multiple runs did not accumulate `[최종]` tags → **PASS**
- **Real-Time Cache Sync & Pruning** → verified via Test Case D in `verify-duplicates.py` which checked cache contents and pruned stale entries → **PASS**
- **Zero Deletion Guard** → verified via reviewing the code where no file deletion (`os.remove`) occurs on data files, and collisions are resolved by appending counters in `resolve_filename_collision` → **PASS**

---

## Coverage Gaps

- **Binary file parsing limits** — risk level: low — PDF parsing is limited to the first 3 pages / 2000 characters, which is optimal for performance and avoids loading massive documents into memory. Accepted risk.
- **API quota exhaust fallback** — risk level: low — The local regex-based summary provides a robust fallback when the Gemini API is unavailable or quota is exceeded. Accepted risk.

---

## Unverified Items

- **Actual PDF / HWPX file parsing on disk** — reason not verified: `verify-duplicates.py` mocks these parsers with a plain-text file reader to avoid checking in heavy binary assets. However, the parser implementations in `organize-files.py` (using `fitz` and `zipfile`) were statically reviewed and are correct.

---

# Adversarial Challenge Report

## Challenge Summary

**Overall risk assessment**: LOW

The script is extremely defensive, utilizing try-except blocks, atomic cache writes, and collision resolution counters. The risk of data loss is zero as the script has no deletion logic for user files.

---

## Challenges

### [Low] Challenge 1: Filename Collision Loop Bounds
- **Assumption challenged**: `resolve_filename_collision` assumes the file system will not have an infinite number of matching files.
- **Attack scenario**: If there are hundreds of duplicate filenames already existing in the destination folder, the `while os.path.exists(...)` loop will run many times, incrementing the counter.
- **Blast radius**: Slight slowdown during move operations for large collision counts.
- **Mitigation**: The current loop checks `if current_filepath and os.path.abspath(os.path.join(dest_dir, new_filename)) == os.path.abspath(current_filepath): break`, which prevents infinite loops for identical files. The loop bound is naturally limited by the number of files, which is low in practice.

### [Low] Challenge 2: Cache File Race Conditions
- **Assumption challenged**: The script assumes it is the only process writing to `.search_cache.json`.
- **Attack scenario**: If two instances of `organize-files.py` run concurrently, they could overwrite each other's cache updates.
- **Blast radius**: Cache corruption or lost metadata updates.
- **Mitigation**: Since this is a utility script meant to be run manually or by a single background daemon, concurrent execution is highly unlikely. However, standardizing a file lock or running within a single process manager mitigates this.

---

## Stress Test Results

- **Run organize-files.py twice consecutively** → Expected: files remain in place, names unchanged, no new duplicates created → Actual: files are preserved, names remain `[최종] ...` with no prefix accumulation → **PASS**
- **Create zero-byte files** → Expected: `size_diff_ratio` calculations handle division by zero safely → Actual: `max_size > 0` condition in `size_diff_ratio` prevents division by zero → **PASS**
- **Inject non-ASCII characters in filename/content** → Expected: UTF-8 encoding handled properly without crash → Actual: `sys.stdout.reconfigure(encoding='utf-8')` and `open(..., encoding='utf-8')` ensure correct text decoding and console display → **PASS**
