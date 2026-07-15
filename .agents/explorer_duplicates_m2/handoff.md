# Handoff Report: Similarity-Based Duplicate File Detection Design

## 1. Observation
We examined the codebase in `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL` and identified the following files and structural patterns:
- **File System Organizer**: The script `scratch/organize-files.py` contains the logic for scanning and restructuring documents. Specifically:
  - Line 23: `ROOT_DIR = r"F:\부엉이_정리됨"` defines the archive root.
  - Line 24: `CACHE_PATH = os.path.join(ROOT_DIR, ".search_cache.json")` defines the caching file location.
  - Line 186: `def get_inferred_date_and_content(filepath: str, filename: str) -> (str, str):` retrieves the date and cached or parsed content.
  - Line 546: `def resolve_filename_collision(dest_dir: str, filename: str) -> str:` appends numeric suffixes to resolve file name collisions.
  - Line 569: `for root, _, files in os.walk(ROOT_DIR):` recursively walks the entire archive.
  - Line 660: `shutil.move(filepath, final_dest_path)` performs the physical migration.
- **Caching Mechanism**: The `.search_cache.json` tracks the `mtime`, `size`, and `content` for each absolute path. Entries are rewritten incrementally using `updated_cache` to prune dead references.

---

## 2. Logic Chain
1. **Scope Restriction**: By comparing candidate files only with existing files in the mapped `dest_dir` (instead of comparing globally), we reduce comparisons from $O(N^2)$ globally to $O(M)$ per file, where $M$ is the number of files in that specific destination folder (typically small).
2. **Prioritization of Structured Files**: Since the order of recursive listing is arbitrary, processing an unsorted file before a pre-existing structured file would place the duplicate in the main folder and move the original to `_Duplicates`. By sorting files by path depth (e.g. `all_files_info.sort(key=lambda x: x[0].count(os.sep), reverse=True)`), we guarantee that pre-existing structured files (deeper paths) are processed first and remain as the "original" copy.
3. **Multi-tiered Matching**:
   - For exact content, SHA-256 hashing is $100\%$ reliable and computationally trivial when cached.
   - For text-extractable documents, Cosine Similarity on token frequency vectors represents semantic overlap accurately without external libraries.
   - For binary files (e.g., images), combining a stripped filename similarity check (via `SequenceMatcher`) with a strict size tolerance constraint (e.g., $\le 5\%$ difference) catches duplicate assets while avoiding false positives.
4. **Cache Integration**: Including the file hash in the cache ensures we do not repeat expensive disk-reading and hashing operations on subsequent runs.
5. **Conflict Resolution**: Storing duplicates in `os.path.join(dest_dir, "_Duplicates")` isolates them from main lists. Standard collision handling in this subdirectory prevents files from being overwritten.

---

## 3. Caveats
- **Non-Text Similarity**: Similarity for images or audio files is limited to filename similarity and size similarity, which may result in minor false positives if files have the exact same size and similar names. A strict size match (e.g. exact byte match) or hash match is recommended to confirm binary duplicates.
- **Large Directories**: If a directory contains hundreds of files, comparing text content on every run might introduce brief delays. However, since content is cached, memory-based calculations are sub-millisecond and highly scalable.

---

## 4. Conclusion
The proposed design is fully self-contained, using only Python's standard library (built-ins: `difflib`, `math`, `re`, `hashlib`), and seamlessly integrates into the current script. It ensures that duplicate files are cleanly redirected to a bottom-level `_Duplicates` subdirectory under their respective category folders, avoids overwriting files, sorts processing to prioritize structured files, and updates `.search_cache.json` without breaking backward compatibility.

---

## 5. Verification Method
1. **Inspect Design Report**: Check `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_duplicates_m2\design.md` for the exact code-modification details.
2. **Implementation Verification**:
   - Once implemented by the implementation agent, run `python scratch/organize-files.py` on a mock directory.
   - Verify that exact duplicates and $\ge 80\%$ content-similar files are moved to `_Duplicates` with appropriate `_1`, `_2` suffixes if there are collisions.
   - Verify that `.search_cache.json` contains correct paths inside `_Duplicates` and includes the new `"hash"` key.
