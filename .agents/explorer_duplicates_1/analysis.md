# Detailed Design Strategy for Duplicate File Optimization

This document outlines the design strategy for enhancing the duplicate file organization engine (`scratch/organize-files.py`) and its corresponding test suite (`scratch/verify-duplicates.py`).

---

## 1. R1: Replacing "[최종] " with "★최종★_" Prefix

To ensure that final files are listed at the very top of Windows Explorer folder listings, the prefix must be updated from `[최종] ` to `★최종★_`.

### Code Modification Points

#### 1.1 `clean_final_tag(filename)` (Line 130 in `organize-files.py`)
This function strips final tags from files during the scanning phase to reconstruct the clean, normalized base filename. It must recognize both the legacy `[최종] ` tag and the new `★최종★_` tag to remain backwards compatible and robust against multiple runs.

*Proposed change:*
```python
def clean_final_tag(filename: str) -> (str, bool):
    """Strip [최종] or ★최종★_ prefix if present, return cleaned filename and a boolean indicator."""
    has_final_tag = False
    name = filename
    # Match either legacy "[최종]" or new "★최종★" prefix followed by spaces/hyphens/underscores
    match = re.match(r"^(?:\[최종\]|★최종★)[\s_\-]*", name)
    if match:
        has_final_tag = True
        name = name[match.end():]
    return name, has_final_tag
```

#### 1.2 Final File Selection and Naming (Line 957 in `organize-files.py`)
When a file is identified as the final version in a duplicate cluster, the prefix must be prepended.

*Proposed change:*
```python
# Move/Rename final file in dest_dir
os.makedirs(dest_dir, exist_ok=True)
clean_base = get_clean_base_filename(final_info["std_name"])
# Prepend ★최종★_ instead of legacy "[최종] "
proposed_final_name = "★최종★_" + clean_base
resolved_final_name = resolve_filename_collision(dest_dir, proposed_final_name, final_info["orig_path"])
final_dest_path = os.path.join(dest_dir, resolved_final_name)
```

---

## 2. R2: Document Body Keyword Extraction & Injection

For final files that are text-extractable (PDF and HWPX formats), the engine will extract up to 4 most frequent Korean nouns from the document body and append them as a tag to the end of the filename in the format `_(keyword1, keyword2, keyword3, keyword4)`.

### 2.1 Keyword Extraction Algorithm Design

To extract meaningful keywords without relying on heavy, non-standard external Korean natural language processing (NLP) libraries (such as KoNLPy), a rule-based statistical approach will be implemented.

#### Step-by-Step Methodology:
1. **Word Extraction:** Use regex `[가-힣]+` to extract all sequences of Korean characters.
2. **Agglutinative Particle and Suffix Stripping:** Korean particles (Josa) and common verb endings are attached directly to nouns. We define a list of particles and suffixes ordered descending by length:
   ```python
   suffixes = ["합니다", "됩니다", "했다", "됐다", "하는", "되는", "하여", "되어", "하다", "되다", "으로", "에서", "에게", "한테", "이며", "하고", "은", "는", "이", "가", "을", "를", "의", "에", "과", "와", "로", "등"]
   ```
   For each word, we iteratively strip trailing suffixes **only if** the resulting word length is at least 2 characters. This guards against over-stripping valuable two-character nouns (e.g. keeping `성과` intact instead of stripping `과` to leave `성` which would be discarded).
3. **Stopwords Filtering:** Words that are too short (length < 2) or belong to a defined set of administrative/non-noun terms (e.g., `실적`, `계획`, `보고`) are filtered out.
4. **Stable Sorting & Selection:** Count frequency of each remaining word. Sort them by:
   - Frequency (descending)
   - Word string representation (alphabetical, ascending) to guarantee deterministic tie-breaking.
   Select the top 4 words.

*Proposed Helper Function:*
```python
def extract_keywords_from_content(content: str) -> List[str]:
    if not content:
        return []
        
    # 1. Extract Korean words
    words = re.findall(r'[가-힣]+', content)
    if not words:
        return []
        
    # Suffixes ordered by length descending
    suffixes = [
        "합니다", "됩니다", "했다", "됐다", "하는", "되는", "하여", "되어", 
        "하다", "되다", "으로", "에서", "에게", "한테", "이며", "하고", 
        "은", "는", "이", "가", "을", "를", "의", "에", "과", "와", "로", "등"
    ]
    
    # Non-noun or non-meaningful terms
    STOPWORDS = {
        "실적", "계획", "보고", "보고서", "관련", "사업", "추진", "운영", "결과", "회의", 
        "대한", "통해", "위해", "따른", "있습니다", "하는", "하여", "경우", "또한", 
        "모든", "다음", "아래", "내용", "일정", "첨부", "제출", "작성", "확인", "의견", 
        "검토", "진행", "일시", "장소", "대상", "내역", "기타", "사항", "개최", "안내", 
        "실시", "알림", "현황", "목적", "개요", "요청", "제공", "선정", "지원", "관리", 
        "기준", "부엉이", "최종", "수정", "첨부파일", "다운로드", "업무", "주요", "제출용", 
        "배포용", "수정완료", "문서", "파일", "이후", "사전", "기획", "안건", "내용입니다", 
        "합니다", "됩니다", "있음", "없음"
    }
    
    cleaned_counts = {}
    for word in words:
        # Strip suffixes recursively from the end, keeping length >= 2
        changed = True
        while changed:
            changed = False
            for s in suffixes:
                if word.endswith(s) and (len(word) - len(s)) >= 2:
                    word = word[:-len(s)]
                    changed = True
                    break
        
        if len(word) >= 2 and word not in STOPWORDS:
            cleaned_counts[word] = cleaned_counts.get(word, 0) + 1
            
    # Sort: highest frequency first, then alphabetical (ascending) for stable tie-breaks
    sorted_words = sorted(cleaned_counts.items(), key=lambda x: (-x[1], x[0]))
    return [w for w, c in sorted_words[:4]]
```

### 2.2 Suffix Injection & Repeat-Run Protection

To append keywords to the final filename, we extract them from the body content and format them as `_(keyword1, keyword2, keyword3)`.

*Proposed changes inside deduplication loop (Pass 2):*
```python
# Extract clean base filename and the normal summary
clean_base = get_clean_base_filename(final_info["std_name"])
name_part, ext_part = os.path.splitext(clean_base)

# Extract keywords if content is available
keywords = extract_keywords_from_content(final_info["content"])
keyword_tag = f"_({', '.join(keywords)})" if keywords else ""

# Combine base name, standard summary, and keyword tag
proposed_final_name = "★최종★_" + name_part + keyword_tag + ext_part
```

#### Idempotence (Repeat-Run Protection)
If the file organizer is run repeatedly, the keyword tags could accumulate. To prevent this, `get_clean_base_filename` must strip the existing `_(keyword1, keyword2...)` tag before restoring clean names.

*Proposed change to `get_clean_base_filename(filename)`:*
```python
def get_clean_base_filename(filename: str) -> str:
    name, ext = os.path.splitext(filename)
    
    # 1. Strip any existing keyword tags: _(kw1, kw2, kw3)
    keyword_match = re.search(r"_(\([^)]+\))$", name)
    if keyword_match:
        name = name[:-len(keyword_match.group(0))]
        
    # 2. Strip standard parenthesized summaries (e.g. (ai_summary))
    summary_match = re.search(r"(\([^)]+\))$", name)
    summary = ""
    if summary_match:
        summary = summary_match.group(1)
        name = name[:-len(summary)]
        
    while True:
        prev = name
        name = re.sub(r"[\s_\-]+(?:최종안?|수정완료|제출용|배포용|복사본|copy|final|submit|dist)$", "", name, flags=re.IGNORECASE)
        name = re.sub(r"[\s_\-]+(?:v)?\d+$", "", name, flags=re.IGNORECASE)
        name = re.sub(r"[\s_\-]+$", "", name)
        if name == prev:
            break
            
    return name + summary + ext
```

---

## 3. R3: Real-Time Cache Synchronization (`.search_cache.json`)

The engine uses `.search_cache.json` (keys are absolute file paths) to cache file metadata (mtime, size, content, hash). When files are renamed or moved, the cache must be updated.

### Real-Time Update Logic
The function `sync_cache_move(old_abs_path, new_abs_path, file_meta)` acts as the cache synchronizer:
1. It pops the entry for the old file path from the cache map.
2. It queries filesystem metadata (mtime, size) of the new path.
3. It inserts the content, hash, and metadata under the new path key.

Because `sync_cache_move` is called synchronously after every `shutil.move` operation, cache synchronization is instantaneous. 

### Why This Remains Robust for the New Format
- The cache keys are updated from `.../[최종] YYYYMMDD_파일명.ext` to `.../★최종★_YYYYMMDD_파일명_(keyword1, keyword2).ext`.
- Subsequent runs of `organize-files.py` will read `★최종★_...` files directly, matching the new absolute paths in the cache.
- The `get_clean_base_filename` and `clean_final_tag` modifications ensure that the engine can read the renamed files, restore them to clean base names, compute similarity, and match them with the cache successfully without recalculation.

---

## 4. Updates to `scratch/verify-duplicates.py`

All existing tests in `scratch/verify-duplicates.py` that check for `[최종]` must be updated to expect `★최종★_` and the keyword suffix.

### 4.1 Modifying Existing Test Cases
- **Test Case A:** Update assertions to expect `★최종★_20260715_주요업무보고_(강남, 메디헬스, 센터, 예산).hwpx` or search for `★최종★_` and the keywords.
- **Test Case B:** Update assertions to expect `★최종★_20260715_체력인증계획_(방침서, 서울체력장, 추가).hwpx` or search for `★최종★_` and the keywords.
- **Test Case C:** Update prefix accumulation check to assert that `★최종★_` is not repeated (i.e. not `★최종★_★최종★_...`).
- **Test Case G:** Update assertion to expect `★최종★_20260715_바른자세_보고서.txt` (or with keywords if the text is long enough).

### 4.2 Adding a New Dedicated Keyword Extraction Test Case
A new test case (e.g. `Test Case I`) should be added to explicitly verify keyword extraction behavior under edge cases:
- Verifying that particles are stripped correctly.
- Verifying that the 2-character particle stripping guard works (e.g., `성과` is not reduced to `성`).
- Verifying that keywords are sorted by frequency (descending) and alphabetically (ascending) for ties.
- Verifying formatting: brackets, comma, space, and underscore.

#### Example Test Case Implementation Sketch:
```python
# -------------------------------------------------------------
# Test Case I: Korean Keyword Extraction and Injection
# -------------------------------------------------------------
print("\n--- Test Case I: Korean Keyword Extraction and Injection ---")
if os.path.exists(TEST_ROOT):
    shutil.rmtree(TEST_ROOT)
os.makedirs(TEST_ROOT, exist_ok=True)
org.global_cache = {}

# Text designed to have specific word frequencies
# "성과" (freq 3), "체력장" (freq 2), "바른자세" (freq 2), "인바디" (freq 1)
# Note: "계획" and "보고" are stopwords and should be ignored.
text_i = "성과 성과 성과 체력장 체력장 바른자세 바른자세 인바디 계획 보고"
create_mock_file("20260715_통합테스트_1.hwpx", text_i, mtime_offset=0)
create_mock_file("20260715_통합테스트_2.hwpx", text_i, mtime_offset=10)

org.main()

all_moved_files_i = list_all_files(TEST_ROOT)
print("Files after Test Case I:")
for f in all_moved_files_i:
    print(f"  {f}")

# Target: 09_주간 및 월간 계획/2026년/06_기타서류 (default mapping)
# Keywords: "성과" (3), "바른자세" (2), "체력장" (2), "인바디" (1)
# Tie-breaker for 2: "바른자세" comes before "체력장" alphabetically.
# Expected tag: _(성과, 바른자세, 체력장, 인바디)
expected_final_name = "★최종★_20260715_통합테스트_(성과, 바른자세, 체력장, 인바디).hwpx"
f_final_i = find_file(all_moved_files_i, "09_주간 및 월간 계획/2026년/06_기타서류", expected_final_name)

assert f_final_i is not None, f"Test Case I failed: Expected final file '{expected_final_name}' not found."
print("✓ Test Case I (Keyword Extraction & Tie-Breaking) Passed.")
```
