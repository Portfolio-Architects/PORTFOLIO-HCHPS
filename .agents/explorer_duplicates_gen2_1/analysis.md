# Duplicate Resolution Design Analysis Report

This analysis report outlines the design, findings, and recommended strategy to enhance the duplicate processing engine (`scratch/organize-files.py`) and its automated verification suite (`scratch/verify-duplicates.py`).

---

## 1. Analysis of Current Implementation & Core Flaws

In the current version of `scratch/organize-files.py`:
1. **Iterative On-the-Fly Processing**: Files are processed one-by-one inside a single loop. For each file, the script identifies the target destination directory, scans the *already organized* files inside it, and classifies the current file as a duplicate if it matches any of the already-moved files.
2. **Lack of Grouping**: Because files are compared only against files already present in the target directory, the processing sequence dictates which file is preserved in the root.
3. **No "Final Version" Identification**: Whichever file is processed first (often an older draft or an un-renamed version) is placed in the category root. Subsequent newer files or files explicitly labeled with final keywords (e.g., "최종") are classified as duplicates and moved to the `_Duplicates/` subfolder.
4. **No Visual Denotation**: The final files are not marked or standardized in any way, making it difficult for the user or the search engine to identify them immediately.

### Proposed Solution: Group-Before-Organize
To resolve these flaws, the script must adopt a **two-pass batch processing model**:
- **Pass 1 (Scan & Grouping)**: Scan all files, standardize their names, determine their target destination categories, and group them by destination category. Within each category, cluster files into duplicate groups using the 4 Tiers of similarity.
- **Pass 2 (Resolution & Migration)**: For each duplicate group, identify the single "final" file. Prepend `[최종] ` to its name and keep it in the root folder of its category. Move all other files in the group to the `_Duplicates/` subfolder without the `[최종] ` prefix. Update the search cache in real-time on disk.

---

## 2. Recommended Strategy & Detailed Design

### 1. Final File Identification Design
Within each duplicate group (cluster), we must identify exactly one "final" file based on:
1. **Keyword Presence**: Check if the original filename contains any of the target keywords: `'최종'`, `'수정완료'`, `'제출용'`, `'배포용'`.
2. **Modification Time (mtime) Tie-Breaker**:
   - If multiple files contain final keywords, select the one with the most recent `mtime`.
   - If no files contain final keywords, select the one with the most recent `mtime`.

#### Handling Re-Runs (Prefix Stripping)
To prevent accumulative prefixes (e.g., `[최종] [최종] ...`) when running the script multiple times:
- At the start of scanning, check if the filename starts with `[최종] ` (or `[최종]_`, `[최종]-`).
- Strip this prefix to obtain a clean name for analysis, and set a flag `had_final_tag = True`.
- Files with `had_final_tag = True` are treated as having the keyword `'최종'` for ranking purposes.

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

---

### 2. Grouping & Similarity Clustering (Tiers 1-4)
Before performing any disk movements or renames, files are grouped by their target category directory. Within each directory, files are clustered into similarity groups using a **connected components (graph-based) algorithm**.

#### The 4 Similarity Tiers:
- **Tier 1 (Exact SHA-256 Match)**: File contents match exactly.
- **Tier 2 (High Text Similarity)**: Cosine similarity of extracted texts $\ge 80\%$.
- **Tier 3 (Medium Text & High Name Similarity)**: Cosine similarity $\ge 50\%$ AND SequenceMatcher filename similarity $\ge 80\%$.
- **Tier 4 (Non-Text name & size similarity)**: Filename similarity $\ge 80\%$ AND file size difference $\le 5\%$.

#### Clustering Algorithm:
1. Treat each file in the target category as a node in a graph.
2. Compare all pairs of files in the category. If they satisfy any of Tiers 1-4, add an undirected edge between their nodes.
3. Compute the connected components of the graph. Each component represents a duplicate group.
4. Singletons (components of size 1) represent unique files that have no duplicates.

---

### 3. File Renaming & Folder Placement
Once duplicate groups are resolved:
- **The Final File**:
  - Prepend `[최종] ` to its name (separated by a single space, e.g., `[최종] 20260715_보고서.hwpx`).
  - Strip any duplicate or version suffixes (e.g., `_수정완료`, `_1`, `_v2`, `_copy`) from the base name before prepending `[최종] `.
  - Keep the file in the root of its target category folder.
- **Duplicate Files**:
  - Keep their standardized names (date prefix + content summary if applicable, but without `[최종] ` prefix).
  - Move them to the `_Duplicates/` subfolder under the target category.

#### Base Filename Cleaning Regex:
```python
def get_clean_base_filename(filename: str) -> str:
    name, ext = os.path.splitext(filename)
    # Repeatedly strip version/final suffixes from the end of the filename
    while True:
        prev = name
        # Strip trailing final keywords
        name = re.sub(r"[\s_\-]+(?:최종안?|수정완료|제출용|배포용|복사본|copy)$", "", name)
        # Strip trailing numbers with optional leading 'v'
        name = re.sub(r"[\s_\-]+(?:v)?\d+$", "", name)
        name = re.sub(r"[\s_\-]+$", "", name)
        if name == prev:
            break
    return name + ext
```

---

### 4. Real-Time Cache Synchronization
To keep the search engine fully synchronized even if the execution is interrupted:
- For every file rename or move, the script must update `global_cache` in-memory and write it to `.search_cache.json` on disk **immediately**.
- Update the cache keys from the old absolute path to the new absolute path.
- Compute new stat values (mtime and size) of the moved file to update cache metadata.

```python
def sync_cache_move(old_abs_path: str, new_abs_path: str, file_meta: dict):
    global global_cache
    
    # Extract metadata from source cache if it exists, otherwise use current info
    metadata = global_cache.pop(old_abs_path, {})
    
    try:
        stat = os.stat(new_abs_path)
        metadata["mtime"] = int(stat.st_mtime * 1000)
        metadata["size"] = stat.st_size
    except Exception:
        metadata["mtime"] = file_meta.get("mtime", 0)
        metadata["size"] = file_meta.get("size", 0)
        
    metadata["content"] = file_meta.get("content", "")
    metadata["hash"] = file_meta.get("hash_val", "")
    
    global_cache[new_abs_path] = metadata
    save_search_cache()
```

---

### 5. Zero Deletion Guard (Collision Resolution)
- **No File Deletions**: Never call `os.remove` or `os.unlink` on any user files (only empty folders, or temporary `.tmp` cache files during atomic write).
- **Collision Resolution**: If a file is being moved to a path that already exists (e.g., due to duplicate names or another file already placed there), call `resolve_filename_collision` to append an incremental suffix (`_1`, `_2`, etc.) before the extension.

---

## 3. Recommended Automated Test Cases

The test script `scratch/verify-duplicates.py` must be updated to cover the following test cases in `scratch/test_env/`:

### Test Case A: Final File Keyword Priority
* **Scenario**: A duplicate group where one file has a final keyword and another is newer but has no keyword.
* **Mock Setup**:
  - File 1: `20260715_주요업무보고_1.hwpx` (mtime: older, content: `text_orig`)
  - File 2: `20260715_주요업무보고_수정완료.hwpx` (mtime: newer, content: `text_sim_high`)
* **Expected Result**:
  - `[최종] 20260715_주요업무보고.hwpx` is kept in the root folder: `09_주간 및 월간 계획/2026년/07_주간 및 월간 계획/`.
  - `20260715_주요업무보고_1.hwpx` is moved to: `09_주간 및 월간 계획/2026년/07_주간 및 월간 계획/_Duplicates/`.

### Test Case B: Most Recent mtime Tie-Breaker
* **Scenario**: A duplicate group where no files contain final keywords.
* **Mock Setup**:
  - File 1: `20260715_체력인증계획_1.hwpx` (mtime: newer, content: `text_gym_1`)
  - File 2: `20260715_체력인증계획_2.hwpx` (mtime: older, content: `text_gym_2`)
* **Expected Result**:
  - `[최종] 20260715_체력인증계획.hwpx` is kept in the root folder: `01_강남_AI_메디헬스_센터/01-1_서울체력장/2026년/04_계획 및 방침/`.
  - `20260715_체력인증계획_2.hwpx` is moved to: `01_강남_AI_메디헬스_센터/01-1_서울체력장/2026년/04_계획 및 방침/_Duplicates/`.

### Cache and Zero Deletion Assertions
- Verify that both final paths and duplicate paths are mapped correctly inside `.search_cache.json` with valid hash values.
- Verify that no source file has been deleted and all file contents are preserved.
