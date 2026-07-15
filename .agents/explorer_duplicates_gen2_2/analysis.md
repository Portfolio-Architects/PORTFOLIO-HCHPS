# Duplicate & Similarity Reorganization Design Report

This report outlines the design for identifying the final (최종안) file within duplicate/similar file clusters and organizing them into Tiers 1-4. It details how files are grouped prior to movement, how the final file is tagged and positioned, how the search cache is synchronized in real-time, and how the Zero Deletion Guard prevents any loss of data.

---

## 1. Analysis of Current Implementation

### Current Strategy & Limitations
In the current `scratch/organize-files.py` script:
1. Files are processed in a single pass using a flat loop sorted by path depth descending.
2. Duplicate checking is performed **on-the-fly** during file processing. For each scanned file, it determines the destination folder (`dest_dir`) and scans the *existing* files in that directory to detect duplicates.
3. If a duplicate is detected, the current file is immediately rerouted to `_Duplicates` without comparing it to other files that have not yet been moved to the destination folder.
4. **No "Final File" evaluation** is performed. Whichever duplicate happens to be processed first ends up in the category root, and subsequent duplicates are sent to `_Duplicates`. This leads to suboptimal organization where older drafts or unlabelled versions remain in the root while the actual final version (e.g. marked with "최종" or having a newer modification time) is hidden away in `_Duplicates`.

### Need for Group-Before-Organize Design
To guarantee that the correct "final" version is kept in the root folder of its category directory and tagged with `[최종]`, we must shift from the online, one-by-one check to a **group-before-organize batch strategy**.
By grouping files by their target destination category directory and clustering them based on Tiers 1-4 similarity before performing any file movements, we can:
- Compare all versions of a file simultaneously.
- Apply ranking rules (keyword priority and modification time) across the entire cluster.
- Properly rename the selected final file (prepend `[최종]`) and direct all other duplicates to the `_Duplicates` folder.

---

## 2. Proposed Architecture & Design

### A. Pre-Processing & Filename Cleaning
Before grouping, we must normalize filenames and extract relevant metadata. To prevent double-tagging if the script is run multiple times, we clean any existing `[최종]` tag from filenames at the start.
- **Tag Stripping**: Check if a filename starts with `[최종]` (and optional separators like spaces or underscores) and strip it. We record `had_final_tag = True` if it was present.
- **Date Prefix Check**: Once stripped, we run the standard prefix check (`has_prefix = re.match(r"^202\d{5}_", file) is not None`) and date inference.
- **Theme and Work Classification**: Determine the target theme and work domain for each file.

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

### B. Grouping by Destination Category Directory
We calculate the target destination folder (`dest_dir`) for each file:
`dest_dir = os.path.join(ROOT_DIR, target_theme, [sub_theme], f"{year_str}년", target_work)`
We group all scanned files into a mapping of destination folders:
`category_groups: Dict[str, List[dict]]` where each item in the list is a dictionary containing:
- `original_path`: current absolute path.
- `filename`: original filename.
- `clean_name`: standardized name (date prefix + text summary, stripped of `[최종]`).
- `had_final_tag`: boolean flag.
- `content`: parsed text content.
- `hash_val`: SHA-256 hash.
- `size`: file size in bytes.
- `mtime`: file modification time.

### C. Similarity Clustering (Tiers 1-4)
For each category directory, we cluster files into similarity groups. We initialize an empty list of groups `groups = []` for the category. For each candidate file `f`:
- We compare it against the representative of each existing group (the first file in the group) using the Tier 1-4 checks:
  - **Tier 1**: Hash equality.
  - **Tier 2**: Cosine similarity of text contents >= 80%.
  - **Tier 3**: Cosine similarity of text contents >= 50% AND filename similarity >= 80%.
  - **Tier 4**: Filename similarity >= 80% AND size difference <= 5% (for non-text/binary files).
- If it matches a group, it is added to it.
- Otherwise, a new group is created.

### D. Final File Selection & Destination Assignment
Within each duplicate/similarity group of size $\ge 2$:
- We rank the files to determine which is the "final" file using the following criteria in order:
  1. **Keyword Priority**: Files containing any of the keywords `'최종'`, `'수정완료'`, `'제출용'`, `'배포용'` in their original name or having `had_final_tag == True`.
  2. **Modification Time (mtime)**: The most recently modified file.
- We sort the group descending using the key:
  `key = (has_final_keyword, mtime)`
- The top file in the sorted group (`group[0]`) is the **Final File**.
  - Its target destination remains `dest_dir`.
  - Its target name is `[최종] {clean_name}`.
- All other files in the group (indices `1` to `N-1`) are **Duplicates**.
  - Their target destination is changed to `os.path.join(dest_dir, "_Duplicates")`.
  - Their target name is their `clean_name`.

If a group has size $1$, it has no duplicates:
- Its target destination is `dest_dir`.
- Its target name is its `clean_name` (no `[최종]` prepended, unless it already had one, which we can optionally preserve or remove to avoid cluttering non-duplicate files).

---

## 3. Real-Time Cache Synchronization & Zero Deletion Guard

### A. Real-Time Cache Synchronization
To ensure that `.search_cache.json` is always in sync even if the execution is aborted mid-way, the cache file must be updated and written to disk **immediately** after any file operation (rename or move).
We use the global `global_cache` dictionary and a helper function `sync_cache_move`:

```python
def sync_cache_move(old_abs_path: str, new_abs_path: str, file_info: dict):
    """
    Update the cache in memory and serialize to disk in real-time.
    Removes the old path key, updates the new path with fresh stats, and writes to disk.
    """
    global global_cache
    
    # Extract metadata from source cache if it exists, otherwise use current info
    metadata = global_cache.pop(old_abs_path, {})
    
    # Update size and mtime based on the file's post-move status
    try:
        stat = os.stat(new_abs_path)
        metadata["mtime"] = int(stat.st_mtime * 1000)
        metadata["size"] = stat.st_size
    except Exception:
        metadata["mtime"] = file_info.get("mtime", 0)
        metadata["size"] = file_info.get("size", 0)
        
    metadata["content"] = file_info.get("content", "")
    metadata["hash"] = file_info.get("hash_val", "")
    
    global_cache[new_abs_path] = metadata
    save_search_cache()
```

At the very end of the execution, we prune stale keys (paths that no longer exist) from `global_cache` and perform a final save.

### B. Zero Deletion Guard (Collision Resolution)
To prevent any data deletion or file overwrites, the script must handle name collisions dynamically during movement.
- If the target path for a file already exists, we append an incremental suffix (e.g. `_1`, `_2`) before the extension.
- This applies to both the root of the category directory and the `_Duplicates` folder.
- The `resolve_filename_collision` function is called right before the move:
  ```python
  final_filename = resolve_filename_collision(target_dir, desired_name, src_path)
  final_dest_path = os.path.join(target_dir, final_filename)
  ```

---

## 4. Test Case Updates in `verify-duplicates.py`

To verify the correct execution of the new design, the test suite in `scratch/verify-duplicates.py` must be updated.

### A. Updating Existing Assertions
Because final files will now have `[최종]` prepended, we must update the assertions for the moved files:
- For Test Case 1 (Exact Binary Duplicate):
  - Verify that the final file is renamed to start with `[최종]`.
  - Verify that the duplicate file is moved to `_Duplicates` and does not have `[최종]`.
- For Test Case 2 (Text Similarity):
  - Verify that the final file (identified by keyword or newer mtime) has `[최종]` prepended and is in the root directory.
  - Verify that all other similar files are in the `_Duplicates` folder.

### B. Introducing Dedicated Final-File Scenarios
We will add three new test cases to verify the ranking rules:

1. **Test Case 5: Keyword Priority over mtime**
   - Create File A: `20260715_draft.txt` with mtime = `1700000000` (newer), content = `test_content`.
   - Create File B: `20260715_draft_최종.txt` with mtime = `1600000000` (older), content = `test_content` (same or highly similar).
   - Expected: File B is chosen as final because of the keyword `'최종'`, resulting in `[최종] 20260715_draft_최종.txt` in the root, and File A is moved to `_Duplicates`.

2. **Test Case 6: Mtime Tie-Breaker (No Keywords)**
   - Create File C: `20260715_notes.txt` with mtime = `1600000000` (older).
   - Create File D: `20260715_notes_v2.txt` with mtime = `1700000000` (newer).
   - Content for both is identical.
   - Expected: File D is chosen as final because it is newer, resulting in `[최종] 20260715_notes_v2.txt` in the root, and File C is moved to `_Duplicates`.

3. **Test Case 7: Collision Resolution in Duplicates Folder**
   - Create two files with different contents but names that would collide, e.g., both named `20260715_asset_duplicate.bin` inside different temporary locations.
   - Force them into the same destination `_Duplicates` folder.
   - Expected: One file is placed as `20260715_asset_duplicate.bin` and the other as `20260715_asset_duplicate_1.bin`. Neither is deleted or overwritten.

4. **Test Case 8: Real-Time Cache Sync Validation**
   - We will assert that during the file migration loop, the cache file `.search_cache.json` on disk is written to and updated after each individual file move.
