# Duplicate and Similarity Consolidation Design Report

## Executive Summary
This report presents a robust and mathematically rigorous design for the duplicate resolution and file organization engine in `scratch/organize-files.py`. The proposed design transitions the file processing from an online, one-by-one approach to a **Group-First Consolidation Pipeline**. This guarantees that within any duplicate/similarity cluster, the most appropriate "final" version is identified, prepended with `[최종]`, and placed in the category root directory, while all other version drafts are safely moved to the `_Duplicates` subfolder. The entire process complies with the **Zero Deletion Guard** and maintains real-time synchronization of the `.search_cache.json` index.

---

## 1. Analysis of Current Implementation & Core Flaws

In the current `scratch/organize-files.py` script:
1. **Depth-Sorted On-the-Fly Processing**: Files are processed one by one. The script checks for duplicates by scanning only files *already present* in the destination directory.
2. **Order-Dependent Selection**: Because it does not cluster files before moving them, whichever file is processed first (often based on its path depth in the source tree) is kept in the category root. 
3. **No "Final" Tagging**: The script does not look for keywords like "최종" or compare modification times (`mtime`) globally across all versions of a file to find the best candidate. As a result, the actual final version often ends up relegated to the `_Duplicates` folder while an older draft occupies the category root.
4. **Cache Drift**: While the cache is saved at the end, if the process is terminated mid-way, the cache file may refer to stale paths, causing search index inconsistency.

---

## 2. Proposed Group-First Consolidation Design

To resolve these limitations, we implement a **two-pass batch processing strategy**:

```
[Pass 1: Scan & Map]
Scan all files -> Infer dates/themes/work -> Standardize name -> Group by target 'dest_dir'
                                                                         |
                                                                         v
[Pass 2: Cluster & Consolidate]
For each 'dest_dir':
  1. Build similarity graph (Tiers 1-4 edges)
  2. Find Connected Components (duplicate clusters)
  3. Sort cluster by Final File Score: (has_keyword, mtime)
  4. Select index 0 as Final File -> Prepend `[최종]` -> Place in category root
  5. Select indices 1..N-1 as Duplicates -> Strip `[최종]` -> Place in `_Duplicates/`
  6. Execute moves sequentially with Zero Deletion Guard & real-time cache sync
```

### A. Final File Identification Design
To identify the definitive version in a group of duplicates, we define a scoring system:
1. **Keyword Match**: Filename contains any keyword from `['최종', '수정완료', '제출용', '배포용']`.
2. **mtime Tie-Breaker**: The file with the most recent modification time (`mtime`) is selected.

#### Repeat-Run Safety (Tag Stripping)
To prevent accumulative prefixes like `[최종][최종]20260715_...` during multiple runs:
- At the start of scanning, we strip the `[최종]` prefix and record `had_final_tag = True`.
- Files with `had_final_tag = True` are treated as having the keyword `'최종'` for scoring purposes.

```python
def clean_final_tag(filename: str) -> (str, bool):
    """Strip [최종] prefix if present, return cleaned filename and tag status."""
    has_final_tag = False
    name = filename
    # Matches [최종] at the beginning, followed by optional spaces, underscores, or hyphens
    match = re.match(r"^\[최종\][\s_\-]*", name)
    if match:
        has_final_tag = True
        name = name[match.end():]
    return name, has_final_tag
```

### B. Grouping & Similarity Clustering (Tiers 1-4)
All scanned files are grouped by their target category directory (`dest_dir`). If a file is currently in a `_Duplicates` subfolder, its `dest_dir` is mapped to the parent category root so that it is re-evaluated with the others.

Within each `dest_dir`, duplicate groups are constructed using a graph-based **Connected Components** approach:
- **Nodes**: All candidate files (both existing in `dest_dir` and incoming).
- **Edges**: An edge exists between file $A$ and file $B$ if they satisfy any of the four similarity tiers:
  - **Tier 1 (Exact SHA-256 Match)**: `hash_a == hash_b`
  - **Tier 2 (High Text Similarity)**: Cosine similarity of parsed text $\ge 80\%$.
  - **Tier 3 (Medium Text & High Name Similarity)**: Cosine similarity $\ge 50\%$ AND SequenceMatcher filename similarity $\ge 80\%$.
  - **Tier 4 (Non-Text / Binary Similarity)**: SequenceMatcher filename similarity $\ge 80\%$ AND size difference $\le 5\%$.

#### Connected Components Algorithm:
```python
def find_duplicate_groups(file_records: List[dict]) -> List[List[dict]]:
    n = len(file_records)
    visited = [False] * n
    groups = []
    
    # Adjacency list representation
    adj = {i: [] for i in range(n)}
    for i in range(n):
        for j in range(i + 1, n):
            is_dup, _ = are_files_duplicate(file_records[i], file_records[j])
            if is_dup:
                adj[i].append(j)
                adj[j].append(i)
                
    for i in range(n):
        if not visited[i]:
            component = []
            queue = [i]
            visited[i] = True
            while queue:
                curr = queue.pop(0)
                component.append(file_records[curr])
                for neighbor in adj[curr]:
                    if not visited[neighbor]:
                        visited[neighbor] = True
                        queue.append(neighbor)
            groups.append(component)
    return groups
```

### C. File Renaming & Placement Rules
For each duplicate group:
- **Final File (Index 0)**:
  - Prepend `[최종]` directly to its name (e.g., `[최종]20260715_report.pdf`).
  - To keep the root directory neat, we strip draft/version suffixes (such as `_최종`, `_수정완료`, `_1`, `_copy`) from the base name before prepending `[최종]`.
  - Keep the file in `dest_dir` (category root).
- **Duplicate Files (Indices 1..N-1)**:
  - Strip any leading `[최종]` tag from their names to prevent misleading labels.
  - Retain their original draft/version suffixes (so they remain distinct).
  - Move them to the `dest_dir/_Duplicates` subfolder.
- **Unique Files (Groups of size 1)**:
  - Strip any leading `[최종]` tag (unless specifically desired) to maintain clean naming, and place in `dest_dir`.

---

## 3. Safe Operations & Cache Synchronization

### A. Zero Deletion Guard
- **Strict Prohibition**: The script must never call `os.remove` or `os.unlink` on any user files. 
- **Collision Resolution**: If a destination path already exists, the script calls `resolve_filename_collision(target_dir, filename, src_path)` to append incremental numeric suffixes (`_1`, `_2`, etc.) before the extension, preserving every file version.

### B. Real-Time Cache Synchronization
To ensure search index consistency and survive unexpected process termination, the `.search_cache.json` index must be updated on disk **immediately** after each file move or rename.

```python
def sync_cache_move(old_path: str, new_path: str, record: dict):
    global global_cache
    old_abs = os.path.abspath(old_path)
    new_abs = os.path.abspath(new_path)
    
    # Fetch existing cache entry or initialize a new one
    entry = global_cache.pop(old_abs, {})
    try:
        stat = os.stat(new_path)
        entry["mtime"] = int(stat.st_mtime * 1000)
        entry["size"] = stat.st_size
    except Exception:
        entry["mtime"] = record.get("mtime", 0)
        entry["size"] = record.get("size", 0)
        
    entry["content"] = record.get("content", "")
    entry["hash"] = record.get("hash", "")
    
    global_cache[new_abs] = entry
    save_search_cache()
```
At the end of the script, the cache is pruned of any stale absolute paths that no longer exist on disk.

---

## 4. Test Case Design in `verify-duplicates.py`

The test suite in `scratch/verify-duplicates.py` will be updated to validate the group-first logic.

### A. New Test Scenarios to Implement

#### 1. Keyword Priority Test
- **Setup**: Create two similar files:
  - `20260715_proposal_draft.txt` (mtime: newer, content: `test_proposal_abc`)
  - `20260715_proposal_최종.txt` (mtime: older, content: `test_proposal_abc`)
- **Assertion**:
  - The final file in the category root must be `[최종]20260715_proposal_최종.txt`.
  - `20260715_proposal_draft.txt` must be in the `_Duplicates` folder.

#### 2. Modification Time (mtime) Tie-Breaker Test
- **Setup**: Create two similar files with no keywords:
  - `20260715_report_A.txt` (mtime: older, content: `test_report_123`)
  - `20260715_report_B.txt` (mtime: newer, content: `test_report_123`)
- **Assertion**:
  - The final file in the category root must be `[최종]20260715_report_B.txt`.
  - `20260715_report_A.txt` must be in the `_Duplicates` folder.

#### 3. Repeat-Run Accumulation Prevention Test
- **Setup**: Create a file starting with `[최종]`:
  - `[최종]20260715_report_B.txt` (mtime: newer, content: `test_report_123`)
- **Assertion**:
  - Ensure the file name is not double-prefixed as `[최종][최종]20260715_report_B.txt`. It must remain `[최종]20260715_report_B.txt`.

#### 4. Cache Integrity & Stale Key Pruning Test
- **Setup**: Inspect the generated cache file `.search_cache.json`.
- **Assertion**:
  - Assert that all post-migration paths (root and `_Duplicates` files) exist as keys in the cache.
  - Assert that all obsolete paths are successfully pruned (removed) from the cache keys.
