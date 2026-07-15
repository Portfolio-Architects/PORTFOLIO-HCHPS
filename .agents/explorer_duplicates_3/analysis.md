# Design Strategy: Filename Format Upgrade and Cache Synchronization

## 1. Overview
This design strategy addresses the requirements to upgrade the filename format of designated "final" files within duplicate/similar-duplicate groups to optimize for Windows Explorer sorting and search functionality. 
Specifically, it focuses on two main upgrades:
1. **R1**: Replacing the old `[최종] ` prefix with `★최종★_` to ensure that final files sort to the very top when sorted alphabetically in Windows Explorer.
2. **R2**: Extracting the top 4 most frequent Korean keywords from the document body (PDF/HWPX) and appending them in the format `_(keyword1, keyword2, keyword3, keyword4)` before the extension, to facilitate quick instant searching (Ctrl+F) inside Windows Explorer.
3. **R3**: Maintaining real-time caching and synchronization within `.search_cache.json`.
4. **Verification**: Updating `scratch/verify-duplicates.py` to assert the new format and keyword behaviors.

---

## 2. R1: ★최종★_ Prefix Implementation

### 2.1 Prefix Normalization and Stripping
To ensure backward compatibility and prevent duplicate prefix accumulation (e.g., `★최종★_★최종★_파일명.ext`) on multiple runs, we modify `clean_final_tag` to strip both the old `[최종] ` prefix and the new `★최종★_` prefix.

**Proposed Change in `scratch/organize-files.py`:**
```python
def clean_final_tag(filename: str) -> (str, bool):
    """Strip [최종] or ★최종★_ prefix if present, return cleaned filename and a boolean indicator."""
    has_final_tag = False
    name = filename
    # Matches either old [최종] or new ★최종★_ prefix followed by spaces/underscores/hyphens
    match = re.match(r"^(?:\[최종\]|★최종★_)[\s_\-]*", name)
    if match:
        has_final_tag = True
        name = name[match.end():]
    return name, has_final_tag
```

---

## 3. R2: Keyword Extraction & Tag Injection

### 3.1 Robust Frequency Analysis Algorithm
Since the code runs in a standard Python environment without heavy third-party natural language processing (NLP) libraries (such as KoNLPy or Mecab), a lightweight, robust, pure Python frequency extraction algorithm is designed:
1. **Tokenization**: Extract all continuous Hangul sequences using `re.findall(r'[가-힣]+', content)`.
2. **Particle Stripping**: Strip common Korean particles (조사) from the end of each word. Stripping is only applied if the resulting word remains at least 2 characters long to avoid corrupting short nouns (e.g. "어린이" -> "어린" or "가구" -> "구").
3. **Stopword Filtering**: Filter out common administrative terms, verbs, and connective particles using a pre-defined set of stopwords.
4. **Frequency Counting**: Build a frequency dictionary and extract up to 4 most frequent keywords.

### 3.2 Particle Regex & Stopwords Design
- **Particles to strip (ordered by length descending):**
  - Length 3: `은커녕`
  - Length 2: `에서`, `에게`, `한테`, `으로`, `부터`, `까지`, `이랑`, `이나`, `이든`, `와서`, `하고`, `하며`, `해서`, `이며`, `이고`, `이다`, `하는`, `됐다`, `했다`, `한다`
  - Length 1: `은`, `는`, `이`, `가`, `을`, `를`, `의`, `에`, `과`, `와`, `로`, `고`, `께`
- **Stopwords Set**:
  Common structural/administrative words like `및`, `등`, `것`, `수`, `대한`, `통해`, `위해`, `사업`, `계획`, `보고`, `실적`, `내용`, `결과`, `보고서`, `계획서`, `업무`, `현황`, `추진`, `운영`, `작성`, `최종`, `수정`, `완료`, `제출`, `배포`, `첨부` etc.

**Proposed Keyword Extraction Code:**
```python
def extract_korean_keywords(content: str) -> List[str]:
    """Extract up to 4 most frequent meaningful Korean noun keywords from content."""
    if not content:
        return []
    
    # Extract all Hangul sequences
    words = re.findall(r'[가-힣]+', content)
    
    # Define particles to strip (order by length descending to match longest first)
    particles = [
        "은커녕", "에서", "에게", "한테", "으로", "부터", "까지", "이랑", "이나", 
        "이든", "와서", "하고", "하며", "해서", "이며", "이고", "이다", "하는", 
        "됐다", "했다", "한다", "은", "는", "이", "가", "을", "를", "의", "에", 
        "과", "와", "로", "고", "께"
    ]
    # Build particle regex
    particle_regex = re.compile(r'(' + '|'.join(particles) + r')$')
    
    # Define stopwords
    stopwords = {
        "및", "등", "것", "그", "이", "저", "수", "등의", "대한", "통해", "위해", 
        "통한", "따른", "대해", "위한", "관련", "사업", "계획", "보고", "실적", 
        "내용", "경우", "결과", "개선", "올해", "오늘", "또한", "매우", "함께", 
        "가장", "모든", "일부", "먼저", "최종", "수정", "완료", "제출", "배포", 
        "첨부", "제공", "진행", "확인", "작성", "회의", "업무", "현황", "추진", 
        "운영", "보고서", "계획서", "실무", "안내", "요청", "사항", "지원", 
        "관리", "대상", "기준", "방법", "개최", "참석", "내역", "금액", "첨부파일", 
        "참고", "붙임", "이하", "이상", "이전", "이후", "통하여", "대하여", "위하여"
    }
    
    counts = {}
    for word in words:
        cleaned = word
        # Strip trailing particles if the word would remain at least 2 characters long
        match = particle_regex.search(word)
        if match:
            stripped = word[:-len(match.group(1))]
            if len(stripped) >= 2:
                cleaned = stripped
        
        # Check constraints: length >= 2 and not in stopwords
        if len(cleaned) >= 2 and cleaned not in stopwords:
            counts[cleaned] = counts.get(cleaned, 0) + 1
            
    # Sort by frequency descending
    sorted_keywords = sorted(counts.items(), key=lambda item: item[1], reverse=True)
    
    # Return top 4 keywords
    return [word for word, freq in sorted_keywords[:4]]
```

### 3.3 Base Name Cleansing and Suffix Handling
To properly extract keywords and prevent appending tags repeatedly, we modify `get_clean_base_filename` to strip existing keyword tags `_(...)` or generic summaries `(...)` before deduplication comparison.

**Proposed Change in `get_clean_base_filename`:**
```python
def get_clean_base_filename(filename: str) -> str:
    """Repeatedly strip draft/version/final/duplicate/copy suffixes from the end of the filename,
    handling any trailing parenthesized summary or keyword tag."""
    name, ext = os.path.splitext(filename)
    
    # Clean the trailing keyword tag like _(키워드1, 키워드2, ...) or generic summary (...)
    tag_match = re.search(r"(_\([^)]+\))$", name)
    if tag_match:
        name = name[:-len(tag_match.group(1))]
    else:
        summary_match = re.search(r"(\([^)]+\))$", name)
        if summary_match:
            name = name[:-len(summary_match.group(1))]
            
    while True:
        prev = name
        # Strip trailing final keywords (case-insensitive, including English variants)
        name = re.sub(r"[\s_\-]+(?:최종안?|수정완료|제출용|배포용|복사본|copy|final|submit|dist)$", "", name, flags=re.IGNORECASE)
        # Strip trailing numbers with optional leading 'v'
        name = re.sub(r"[\s_\-]+(?:v)?\d+$", "", name, flags=re.IGNORECASE)
        name = re.sub(r"[\s_\-]+$", "", name)
        if name == prev:
            break
            
    return name + ext
```

### 3.4 Rename/Move Logic inside Deduplication Block
In Pass 2, when the chosen "final" file of a cluster is processed, it is renamed as follows:
```python
                # Move/Rename final file in dest_dir
                os.makedirs(dest_dir, exist_ok=True)
                clean_base = get_clean_base_filename(final_info["std_name"])
                base_no_ext, ext_part = os.path.splitext(clean_base)
                
                # Extract keywords from the final file's content (already loaded/cached)
                keywords = extract_korean_keywords(final_info["content"])
                if keywords:
                    keyword_tag = f"_({', '.join(keywords)})"
                    proposed_final_name = f"★최종★_{base_no_ext}{keyword_tag}{ext_part}"
                else:
                    proposed_final_name = f"★최종★_{clean_base}"
                
                resolved_final_name = resolve_filename_collision(dest_dir, proposed_final_name, final_info["orig_path"])
                final_dest_path = os.path.join(dest_dir, resolved_final_name)
```

---

## 4. R3: Cache Synchronization

The existing cache synchronization structure is highly robust and performs key updates immediately upon moving/renaming:
1. `sync_cache_move(old_abs_path, new_abs_path, file_meta)` pops the old path key and assigns the metadata to the new path key.
2. It fetches the new file's `mtime` and `size` from the disk (or falls back to metadata values if stat fails).
3. At the end of `main()`, `stale_keys` (paths that no longer exist) are persisted once via `save_search_cache()`.

Since `sync_cache_move` is called immediately in both unique file moves and duplicate resolution final/duplicate moves, the new filename formats are synchronized dynamically to `.search_cache.json` without any extra changes needed for the caching layer.

---

## 5. Updates to `scratch/verify-duplicates.py`

To verify the new prefix and tag injection formatting, the test suite in `scratch/verify-duplicates.py` is updated.

### 5.1 Asserting the `★최종★_` Prefix & Keyword Tag Injection
The assertions in the test cases are updated as follows:

```python
# 1. Update Test Case A Assertion
f_a_final = find_file(all_moved_files_1, dir_a_root, "★최종★_20260715_주요업무보고")
f_a_dup = find_file(all_moved_files_1, os.path.join(dir_a_root, "_Duplicates"), "20260715_주요업무보고_1.hwpx")

assert f_a_final is not None, "Test Case A failed: final file starting with ★최종★_20260715_주요업무보고 not found in root"
assert f_a_dup is not None, "Test Case A failed: duplicate 20260715_주요업무보고_1.hwpx not found in _Duplicates"

# Verify Keyword Injection for Test Case A
assert "_(" in f_a_final and f_a_final.endswith(").hwpx"), f"Test Case A failed: final file name doesn't contain keyword tag: {f_a_final}"
expected_keywords_a = ["주간", "주요업무보고", "강남", "메디헬스"]
for kw in expected_keywords_a:
    assert kw in f_a_final, f"Test Case A failed: keyword '{kw}' not injected in filename: {f_a_final}"
print("✓ Test Case A (Keyword Priority & Tag Injection) Passed.")

# 2. Update Test Case B Assertion
f_b_final = find_file(all_moved_files_1, dir_b_root, "★최종★_20260715_체력인증계획")
f_b_dup = find_file(all_moved_files_1, os.path.join(dir_b_root, "_Duplicates"), "20260715_체력인증계획_2.hwpx")

assert f_b_final is not None, "Test Case B failed: final file starting with ★최종★_20260715_체력인증계획 not found in root"
assert f_b_dup is not None, "Test Case B failed: duplicate 20260715_체력인증계획_2.hwpx not found in _Duplicates"

# Verify Keyword Injection for Test Case B
assert "_(" in f_b_final and f_b_final.endswith(").hwpx"), f"Test Case B failed: final file name doesn't contain keyword tag: {f_b_final}"
expected_keywords_b = ["서울체력장", "방침서"]
for kw in expected_keywords_b:
    assert kw in f_b_final, f"Test Case B failed: keyword '{kw}' not injected in filename: {f_b_final}"
print("✓ Test Case B (Most Recent mtime Tie-Breaker & Tag Injection) Passed.")
```

### 5.2 Asserting Prefix Accumulation & Suffix Cleaning on Rerun
The assertion for prefix accumulation in Test Case C is updated to check for `★최종★_`:
```python
# Verify no duplicate prefix '★최종★_★최종★_...'
for f in all_moved_files_2:
    base = os.path.basename(f)
    assert not base.startswith("★최종★_★최종★_"), f"Prefix accumulation detected: {base}"
    if base.startswith("★최종★_"):
        assert base.count("★최종★_") == 1, f"Multiple '★최종★_' tags in filename: {base}"
```

Also, Test Case G assertion is updated:
```python
# Verify Case G suffix cleaning
f_final_g = [f for f in all_moved_files_g if "★최종★_20260715_바른자세_보고서" in f.replace('\\', '/')]
assert len(f_final_g) == 1, "Test Case G failed: Suffixes were not cleaned correctly into ★최종★_20260715_바른자세_보고서"
```
