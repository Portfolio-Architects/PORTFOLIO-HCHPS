# Similarity-Based Duplicate File Detection Mechanism - Design Specification

This document details the architectural design for introducing a similarity-based duplicate file detection mechanism into the `scratch/organize-files.py` script. The goal is to detect near-duplicate and exact-duplicate documents during the archiving process and segregate them into bottom-level `_Duplicates` subdirectories to keep the primary folders clean and organized.

---

## 1. Current Behavior of `organize-files.py`

Before modifying the script, it is essential to understand the current behavior and how it manages file flow and caching.

### File Listing and Sequencing
- **Method**: The script uses `os.walk(ROOT_DIR)` to recursively find all files in the archive.
- **Filtering**: It ignores `.search_cache.json` and `desktop.ini`.
- **Processing Order**: The listing is currently unsorted, processing files in the arbitrary order returned by the file system.

### File Processing and Classification
- **Date & Content Extraction**: For each file, `get_inferred_date_and_content()` retrieves the text content (first 2,000 characters) and infers the document date using file names or text regex patterns.
- **Classification**:
  - **Theme (1st/2nd Tier)**: `get_theme_folder()` assigns the file to a theme directory (e.g. `01_강남_AI_메디헬스_센터/01-2_헬스체크업`).
  - **Year (Tier 2.5)**: Extracted year string (e.g. `2026년`).
  - **Work Domain (3rd Tier)**: `get_work_domain()` maps the file to a domain subfolder (e.g. `01_수의계약`).
- **Renaming and Summarization**: Standardizes the filename with a `YYYYMMDD_` prefix and appends a parenthesized AI summary (e.g. `20260715_contract(Maple).pdf`).

### Collision Resolution
- **Collision check**: If `dest_dir/filename` already exists, the script calls `resolve_filename_collision(dest_dir, filename)`.
- **Handling**: It appends a sequential index suffix (`_1`, `_2`, etc.) before the file extension until a unique filename is found.

### Cache Management (`.search_cache.json`)
- **Key**: Absolute path of the file.
- **Value**: A dictionary containing `mtime` (last modified timestamp in ms), `size` (file size in bytes), and `content` (first 2,000 characters of extracted text).
- **Integrity**: During execution, the script populates a fresh dictionary `updated_cache`. When a file is moved to `final_dest_path`, its entry is migrated to the new absolute path key. At the end of the script, `global_cache` is replaced by `updated_cache` and written to disk, automatically pruning orphaned entries of moved/deleted files.

---

## 2. Similarity-Based Duplicate Detection Logic

To detect duplicates, we will perform a multi-tiered comparison between the candidate file being processed and the files already residing in the target `dest_dir`.

### Match Criteria
A file is classified as a duplicate if it matches any of the following criteria:

| Tier | File Type | Match Condition | Metric / Algorithm |
| :--- | :--- | :--- | :--- |
| **Tier 1** | All Files | Exact content match | SHA-256 Hash equality |
| **Tier 2** | Text Files | High content similarity | Cosine Similarity $\ge$ 80% |
| **Tier 3** | Text Files | Name similarity + Moderate content similarity | SequenceMatcher ratio $\ge$ 80% **AND** Cosine Similarity $\ge$ 50% |
| **Tier 4** | Binary Files | Name similarity + Size similarity | SequenceMatcher ratio $\ge$ 80% **AND** Size difference $\le$ 5% |

### Python Implementation of Algorithms (Built-in only)

#### 1. Exact Hash Match (SHA-256)
A SHA-256 hash is computed in chunks for memory safety, especially for large PDFs or ZIP archives.
```python
import hashlib

def get_file_hash(filepath: str) -> str:
    """Compute the SHA-256 hash of a file in chunks."""
    hash_sha256 = hashlib.sha256()
    try:
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()
    except Exception:
        return ""
```

#### 2. Text Content Cosine Similarity
Extracts word frequency vectors from text (Korean/English/Alphanumeric) and calculates the cosine of the angle between them.
```python
import re
import math

def calculate_cosine_similarity(text1: str, text2: str) -> float:
    """Calculate the cosine similarity between two text strings."""
    if not text1 or not text2:
        return 0.0
    
    # Tokenize words (letters, numbers, and Korean characters)
    words1 = re.findall(r'[가-힣\w]+', text1.lower())
    words2 = re.findall(r'[가-힣\w]+', text2.lower())
    if not words1 or not words2:
        return 0.0
    
    # Build term frequency dictionaries
    tf1 = {}
    tf2 = {}
    for w in words1:
        tf1[w] = tf1.get(w, 0) + 1
    for w in words2:
        tf2[w] = tf2.get(w, 0) + 1
        
    all_words = set(tf1.keys()).union(set(tf2.keys()))
    
    dot_product = 0.0
    sum_sq1 = 0.0
    sum_sq2 = 0.0
    
    for w in all_words:
        val1 = tf1.get(w, 0)
        val2 = tf2.get(w, 0)
        dot_product += val1 * val2
        sum_sq1 += val1 * val1
        sum_sq2 += val2 * val2
        
    if sum_sq1 == 0 or sum_sq2 == 0:
        return 0.0
        
    return dot_product / (math.sqrt(sum_sq1) * math.sqrt(sum_sq2))
```

#### 3. Filename Similarity Matcher
We clean filenames by stripping dates and AI summaries before comparison to avoid false negatives.
```python
import difflib

def get_filename_similarity(name1: str, name2: str) -> float:
    """Calculate SequenceMatcher similarity on cleaned filenames."""
    n1 = os.path.splitext(name1)[0].lower()
    n2 = os.path.splitext(name2)[0].lower()
    
    # Strip standard date prefixes (YYYYMMDD_)
    n1_clean = re.sub(r"^\d{8}_", "", n1)
    n2_clean = re.sub(r"^\d{8}_", "", n2)
    
    # Strip parenthesized AI summaries, e.g. (Summary)
    n1_clean = re.sub(r"\([^)]+\)$", "", n1_clean)
    n2_clean = re.sub(r"\([^)]+\)$", "", n2_clean)
    
    return difflib.SequenceMatcher(None, n1_clean, n2_clean).ratio()
```

---

## 3. Duplicate Directory Transfer & Collision Policies

### Directory Structure
If a candidate file is classified as a duplicate, it must be redirected to a `_Duplicates` subdirectory inside the targeted `dest_dir`.
- **Target folder**: `dest_dir = os.path.join(ROOT_DIR, target_theme, year_str, target_work)`
- **Duplicate folder**: `dup_dest_dir = os.path.join(dest_dir, "_Duplicates")`
- **Action**: Create `dup_dest_dir` using `os.makedirs(dup_dest_dir, exist_ok=True)` and set it as the new target directory.

### Collision Handling in `_Duplicates`
If the duplicate directory already contains a file with the same standardized name (e.g. due to previous runs or multiple duplicates), we use the existing `resolve_filename_collision()` helper:
```python
final_filename = resolve_filename_collision(dup_dest_dir, clean_file)
final_dest_path = os.path.join(dup_dest_dir, final_filename)
```
This ensures files are never overwritten and safely appends `_1`, `_2` as needed.

---

## 4. Cache Integrity & Migration Logic

To optimize performance and prevent recalculating hashes, we will integrate `hash` values into the search cache.

### Cache Schema Enhancement
Each cache item will now include a `"hash"` field:
```json
{
  "F:\\부엉이_정리됨\\01_강남_AI_메디헬스_센터\\01-2_헬스체크업\\2026년\\01_수의계약\\20260715_contract.pdf": {
    "mtime": 1782381280000,
    "size": 125040,
    "content": "본문...",
    "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
}
```

### Metadata Retrieval Adaptation
We will update `get_inferred_date_and_content()` to also return/manage the file hash.
1. Try to read `content` and `hash` from cache if the `mtime` and `size` match.
2. If `hash` is missing in the cache entry (for files cached in previous runs), compute the SHA-256 hash and immediately insert it into the cache entry.
3. If cache is invalid or missing, compute the SHA-256 hash and parse text content, storing both in `global_cache`.

### Migration of Keys
When a file is moved to `dup_dest_dir`, its final path is `final_dest_path`.
- We register the cache entry under `os.path.abspath(final_dest_path)` in `updated_cache`.
- The old path key is naturally excluded from `updated_cache`, preserving integrity and cleaning up the cache automatically.

---

## 5. Precise Execution Flow and Prioritization

To ensure that structured files (already in their correct locations) are processed *before* unsorted/duplicate files (often in the root folder or temporary directories), we must sort `all_files_info` by path depth.

```python
# Sort files by directory depth descending.
# Files deep in subdirectories (already organized) are processed first.
# Unsorted files in root or shallow folders are processed last and marked as duplicates.
all_files_info.sort(key=lambda x: x[0].count(os.sep), reverse=True)
```

---

## 6. Implementation Plan / Proposed Code Changes

The implementation will insert the following modifications into `scratch/organize-files.py`.

### A. Add Helpers for Hashing and Similarity (Lines ~70 onwards)
```python
import hashlib
import math
import difflib

def get_file_hash(filepath: str) -> str:
    """Compute the SHA-256 hash of a file in chunks."""
    hash_sha256 = hashlib.sha256()
    try:
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()
    except Exception:
        return ""

def calculate_cosine_similarity(text1: str, text2: str) -> float:
    """Calculate the cosine similarity between two text strings."""
    if not text1 or not text2:
        return 0.0
    words1 = re.findall(r'[가-힣\w]+', text1.lower())
    words2 = re.findall(r'[가-힣\w]+', text2.lower())
    if not words1 or not words2:
        return 0.0
    
    tf1 = {}
    tf2 = {}
    for w in words1:
        tf1[w] = tf1.get(w, 0) + 1
    for w in words2:
        tf2[w] = tf2.get(w, 0) + 1
        
    all_words = set(tf1.keys()).union(set(tf2.keys()))
    dot_product = 0.0
    sum_sq1 = 0.0
    sum_sq2 = 0.0
    for w in all_words:
        val1 = tf1.get(w, 0)
        val2 = tf2.get(w, 0)
        dot_product += val1 * val2
        sum_sq1 += val1 * val1
        sum_sq2 += val2 * val2
    if sum_sq1 == 0 or sum_sq2 == 0:
        return 0.0
    return dot_product / (math.sqrt(sum_sq1) * math.sqrt(sum_sq2))

def get_filename_similarity(name1: str, name2: str) -> float:
    """Calculate SequenceMatcher similarity on cleaned filenames."""
    n1 = os.path.splitext(name1)[0].lower()
    n2 = os.path.splitext(name2)[0].lower()
    
    n1_clean = re.sub(r"^\d{8}_", "", n1)
    n2_clean = re.sub(r"^\d{8}_", "", n2)
    
    n1_clean = re.sub(r"\([^)]+\)$", "", n1_clean)
    n2_clean = re.sub(r"\([^)]+\)$", "", n2_clean)
    
    return difflib.SequenceMatcher(None, n1_clean, n2_clean).ratio()
```

### B. Update `get_inferred_date_and_content` to manage hashes
```python
def get_inferred_date_and_content(filepath: str, filename: str) -> (str, str, str):
    """Cache-linked date, content, and SHA-256 hash retrieval."""
    global global_cache
    ext = os.path.splitext(filename)[1].lower()
    clean_filename = re.sub(r"^\d{8}_", "", filename)
    
    content = ""
    hash_val = ""
    use_cache = False
    
    try:
        stat = os.stat(filepath)
        mtime_ms = int(stat.st_mtime * 1000)
        size = stat.st_size
        abs_path = os.path.abspath(filepath)
        
        if abs_path in global_cache:
            cache_item = global_cache[abs_path]
            if cache_item.get("mtime") == mtime_ms and cache_item.get("size") == size:
                content = cache_item.get("content", "")
                hash_val = cache_item.get("hash", "")
                use_cache = True
    except Exception:
        pass

    if not use_cache or not hash_val:
        hash_val = get_file_hash(filepath)

    if not use_cache:
        if ext == '.pdf':
            content = parse_pdf_text(filepath)
        elif ext == '.hwpx':
            content = parse_hwpx_text(filepath)
        
        try:
            global_cache[abs_path] = {
                "mtime": mtime_ms,
                "size": size,
                "content": content,
                "hash": hash_val
            }
        except Exception:
            pass

    # [Existing date inference sequence remains unchanged...]
    # ...
    date_str = extract_date_from_filename(clean_filename)
    if date_str:
        return date_str, content, hash_val
    # ...
    # [At the end, return the inferred date, content, and hash]
    return "20260101", content, hash_val
```

### C. Update processing loop in `main()`
We will sort the scanned files by depth, perform the duplicate detection check, redirect destinations to `_Duplicates` if similarity thresholds are met, and update the cache accordingly.
```python
    # 1. Sort files by depth (descending) to process structured files first
    all_files_info.sort(key=lambda x: x[0].count(os.sep), reverse=True)

    # 2. Iterate and check duplicate status
    for filepath, file in all_files_info:
        if not os.path.exists(filepath):
            continue

        abs_orig_path = os.path.abspath(filepath)
        has_prefix = re.match(r"^202\d{5}_", file) is not None
        inferred_date, content, hash_val = get_inferred_date_and_content(filepath, file)
        year_str = inferred_date[:4]

        # Determine target paths
        target_theme = get_theme_folder(file, content)
        target_work = get_work_domain(file, content)

        # Standardize name ...
        # [Existing renaming & summary append logic...]

        # Determine default dest_dir
        if target_theme == "01_강남_AI_메디헬스_센터":
            sub_theme = "01-1_서울체력장" if ... else "01-2_헬스체크업" # existing logic
            dest_dir = os.path.join(ROOT_DIR, target_theme, sub_theme, f"{year_str}년", target_work)
        else:
            dest_dir = os.path.join(ROOT_DIR, target_theme, f"{year_str}년", target_work)

        # DUPLICATE DETECTION LOGIC
        is_duplicate = False
        duplicate_reason = ""
        matched_original = ""

        if os.path.exists(dest_dir):
            # Only list files (directories are not duplicates)
            existing_files = [f for f in os.listdir(dest_dir) if os.path.isfile(os.path.join(dest_dir, f))]
            for ef in existing_files:
                ef_path = os.path.join(dest_dir, ef)
                abs_ef_path = os.path.abspath(ef_path)
                
                # Retrieve from updated or global cache
                ef_meta = updated_cache.get(abs_ef_path) or global_cache.get(abs_ef_path)
                if not ef_meta:
                    try:
                        ef_size = os.path.getsize(ef_path)
                        ef_hash = get_file_hash(ef_path)
                        ef_content = ""
                        if ef.lower().endswith('.pdf'):
                            ef_content = parse_pdf_text(ef_path)
                        elif ef.lower().endswith('.hwpx'):
                            ef_content = parse_hwpx_text(ef_path)
                    except Exception:
                        continue
                else:
                    ef_size = ef_meta.get("size", 0)
                    ef_hash = ef_meta.get("hash", "")
                    ef_content = ef_meta.get("content", "")

                # A. SHA-256 Hash check
                if hash_val and ef_hash and hash_val == ef_hash:
                    is_duplicate = True
                    duplicate_reason = f"Identical file content (SHA-256: {hash_val[:8]})"
                    matched_original = ef
                    break

                # B. Text content similarity check
                if content and ef_content:
                    cosine_sim = calculate_cosine_similarity(content, ef_content)
                    if cosine_sim >= 0.80:
                        is_duplicate = True
                        duplicate_reason = f"High content similarity ({cosine_sim*100:.1f}%)"
                        matched_original = ef
                        break
                    elif cosine_sim >= 0.50:
                        fn_sim = get_filename_similarity(clean_file, ef)
                        if fn_sim >= 0.80:
                            is_duplicate = True
                            duplicate_reason = f"Filename similarity ({fn_sim*100:.1f}%) & Content similarity ({cosine_sim*100:.1f}%)"
                            matched_original = ef
                            break
                else:
                    # C. Non-text files: Name & size similarity
                    fn_sim = get_filename_similarity(clean_file, ef)
                    if fn_sim >= 0.80:
                        try:
                            cand_size = os.path.getsize(filepath)
                        except Exception:
                            cand_size = stat.st_size
                        
                        size_diff = abs(cand_size - ef_size)
                        max_size = max(cand_size, ef_size)
                        size_sim = 1.0 - (size_diff / max_size) if max_size > 0 else 1.0
                        if size_sim >= 0.95:
                            is_duplicate = True
                            duplicate_reason = f"Filename similarity ({fn_sim*100:.1f}%) & Size similarity ({size_sim*100:.1f}%)"
                            matched_original = ef
                            break

        # If duplicate, adjust destination directory
        if is_duplicate:
            dest_dir = os.path.join(dest_dir, "_Duplicates")
            print(f"⚠️  중복 파일 발견: '{clean_file}' -> '{matched_original}' ({duplicate_reason})")

        os.makedirs(dest_dir, exist_ok=True)
        final_filename = resolve_filename_collision(dest_dir, clean_file)
        final_dest_path = os.path.join(dest_dir, final_filename)
        abs_dest_path = os.path.abspath(final_dest_path)

        # Perform move and cache updates...
        # [Existing move logic remains unchanged, as it uses dest_dir and final_dest_path correctly!]
```

---

## 7. Verification Method

To verify the correct operation of this design, the following test scenarios should be executed.

### Test 1: Exact Duplicate Detection (Binary / Text)
1. Place two identical PDF files (e.g. `file_orig.pdf` and `file_copy.pdf` with the same content and metadata) in the unsorted directory.
2. Run the script.
3. **Expected result**: `file_orig.pdf` is moved to the target directory. `file_copy.pdf` is moved to the target directory's `_Duplicates` subfolder.
4. **Verification**: Inspect `.search_cache.json` to check that both entries are registered under their final paths and contain identical `"hash"` values.

### Test 2: Text Similarity ($\ge 80\%$)
1. Create `doc1.pdf` and `doc2.pdf`. `doc2.pdf` has different metadata and slightly modified text, but retains $\ge 80\%$ similarity (e.g. same body text with a different date written at the top).
2. Run the script.
3. **Expected result**: `doc2.pdf` is identified as a duplicate and transferred to `_Duplicates`.

### Test 3: Versioning Safety (Low Similarity)
1. Create `doc_v1.pdf` and `doc_v2.pdf` with the same filename prefix but significantly different body contents ($< 50\%$ similarity).
2. Run the script.
3. **Expected result**: Both files are preserved in the main target directory with sequential naming suffixes (e.g. `doc_v1.pdf` and `doc_v1_1.pdf`) and are **not** moved to `_Duplicates`.
