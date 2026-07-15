# Design Strategy: Duplicate File Redirection & Keyword Tagging

This document provides a detailed design strategy for implementing the requirements outlined in the follow-up request dated 2026-07-15:
1. **R1**: Transitioning from `[최종] ` prefix to `★최종★_` prefix for final files.
2. **R2**: Extracting up to 4 most frequent Korean keywords from the document body (PDF/HWPX) and appending them as `_(keyword1, keyword2, ...)` before the extension.
3. **R3**: Guaranteeing real-time synchronization in `.search_cache.json` for the new filename format.
4. **Test Suite Updates**: Modifying `scratch/verify-duplicates.py` with updated assertions and a new test case for R1 & R2 validation.

---

## 1. R1: "★최종★_" Prefix Implementation

### Current Design (`scratch/organize-files.py`)
- `clean_final_tag(filename)` matches and strips `^\[최종\][\s_\-]*` from the filename to identify previously marked final files and obtain a clean filename.
- When saving/moving the final file, the prefix `"[최종] "` is prepended.

### Proposed Changes
1. **Prefix Definition**: Define the prefix string as `★최종★_`.
2. **Tag Cleaning Modification**: Update `clean_final_tag(filename)` to support both the deprecated `[최종] ` prefix and the new `★최종★_` prefix. This prevents double-prefixing or accumulation of tags when running the organizer multiple times on files that already contain either tag.
3. **Tag Prepending Modification**: Locate where duplicate clusters are resolved and rename the final file prepended with `★최종★_`.

#### Code Proposal for Tag Cleaning:
```python
def clean_final_tag(filename: str) -> (str, bool):
    """Strip [최종] or ★최종★_ prefix if present, return cleaned filename and a boolean indicator."""
    has_final_tag = False
    name = filename
    # Support both old [최종] and new ★최종★_ prefix for backward compatibility and idempotency
    match = re.match(r"^(?:\[최종\]|★최종★_)[\s_\-]*", name)
    if match:
        has_final_tag = True
        name = name[match.end():]
    return name, has_final_tag
```

#### Code Proposal for Prefix Prepended:
Inside `main()`, under Pass 2's duplicate component handler (currently line 958):
```python
                clean_base = get_clean_base_filename(final_info["std_name"])
                # Before: proposed_final_name = "[최종] " + clean_base
                # After:
                proposed_final_name = "★최종★_" + clean_base
```

---

## 2. R2: Keyword Extraction and Tag Injection

### Frequency Analysis Strategy (Pure Python)
Since we operate in a restricted network environment without heavy morphological analysis packages (`KoNLPy`, `mecab`), we design a robust, rule-based keyword extractor using regular expressions, particle-stripping, verb/adjective stemming, and a comprehensive administrative stopword list.

### Extraction Pipeline:
1. **Tokenization**: Extract all Korean character sequences (`re.findall(r'[가-힣]+', content)`).
2. **Verb/Adjective Suffix Stemming**: Strip common administrative verb endings (e.g., `~합니다`, `~하는`, `~하기`, `~하여`) to restore the underlying noun stem (e.g., `추진하는` $\rightarrow$ `추진`).
3. **Particle Stripping (조사 제거)**: Strip grammatical particles from the end of the tokens. To prevent over-stripping 2-character nouns (e.g., `회의` $\rightarrow$ `회`), a heuristic checks if the remaining stem is at least 2 characters.
4. **Stopword Filtering**: Filter out non-meaningful terms (generic business/admin terms like `보고`, `계획`, `기타`, `관련`).
5. **Frequency Aggregation**: Utilize `collections.Counter` to count occurrences and return up the top 4 most frequent keywords.

### Stemming Rules and Stopwords Design

```python
import re
from typing import List
from collections import Counter

def extract_korean_keywords(content: str) -> List[str]:
    """
    Extracts up to 4 most frequent Korean keywords from document text.
    Uses custom stemmer and particle-stripper to bypass third-party library dependencies.
    """
    if not content or not content.strip():
        return []
    
    # 1. Tokenize into Korean words
    tokens = re.findall(r'[가-힣]+', content)
    
    # Verb/Adjective suffix patterns (from longest to shortest)
    verb_suffixes = [
        '있습니다', '없습니다', '않습니다', '합니다', '됩니다', '입니다',
        '하오니', '하오며', '하려는', '되려는', '하기로', '되기로', '하고자', '되고자',
        '있으며', '없으며', '하여야', '되어야', '하므로', '되므로',
        '하는', '되는', '하고', '되고', '하지', '되지', '하며', '되며', '하기', '되기', '하여', '되어'
    ]
    
    # Case particles (조사)
    particles = [
        '에서', '으로', '부터', '까지', '에게', '은', '는', '이', '가', '을', '를', '의', '에', '과', '와', '로', '도', '만'
    ]
    
    # Stopwords: Generic administrative, structural, or connective words
    stopwords = {
        '및', '등', '기타', '관련', '대한', '대해', '통해', '위한', '위해', '따른', '따라', '경우',
        '사항', '내용', '개요', '일시', '장소', '대상', '구분', '금액', '사업', '계획', '보고',
        '회의', '추진', '운영', '결과', '현황', '작성', '제출', '일정', '안내', '확인', '참고',
        '협조', '요청', '지원', '제공', '관리', '업무', '실적', '보고서', '계획서', '결과보고서',
        '사업계획서', '진행', '협의', '검토', '처리', '지출', '수당', '강사', '기안', '결재',
        '서류', '파일', '첨부파일', '다운로드', '업로드', '등록', '목적', '목표', '추진방침',
        '추진계획', '실천', '추진사항', '추진현황', '현안', '이슈', '또한', '따라서', '올해',
        '이번', '금번', '향후', '아래', '다음', '일반', '우리', '함께', '모든', '매우', '통한'
    }
    
    cleaned_words = []
    for token in tokens:
        word = token
        
        # 2. Strip verb/adjective endings
        for suf in verb_suffixes:
            if word.endswith(suf):
                stem = word[:-len(suf)]
                if len(stem) >= 2:
                    word = stem
                break
                
        # 3. Strip particles (조사)
        for part in particles:
            if word.endswith(part):
                stem = word[:-len(part)]
                # Keep stem if it preserves a 2+ character word (prevent e.g., '회의' -> '회')
                if len(stem) >= 2:
                    word = stem
                break
        
        # 4. Filter by length and stopwords
        if len(word) >= 2 and word not in stopwords:
            cleaned_words.append(word)
            
    if not cleaned_words:
        return []
        
    # 5. Aggregate frequencies
    counts = Counter(cleaned_words)
    # Get up to top 4 most common words
    most_common = [w for w, _ in counts.most_common(4)]
    return most_common
```

### Tag Injection
When formatting the final file, the extracted keywords are injected immediately before the extension.
E.g., `filename.ext` $\rightarrow$ `filename_(keyword1, keyword2).ext`

To make this idempotent and prevent keywords from stacking on reruns, we must also clean any existing keyword tags from the filename in `get_clean_base_filename`.

#### Updating `get_clean_base_filename`:
```python
def get_clean_base_filename(filename: str) -> str:
    """Repeatedly strip draft/version/final/duplicate/copy suffixes and keyword tags from the filename."""
    name, ext = os.path.splitext(filename)
    
    # Clean new keyword tag if present: e.g. _(체력장, 성과계획)
    name = re.sub(r"_\([^)]+\)$", "", name)
    
    # Check if there is a trailing parenthesized summary
    summary_match = re.search(r"(\([^)]+\))$", name)
    summary = ""
    if summary_match:
        summary = summary_match.group(1)
        name = name[:-len(summary)] # Strip the summary temporarily
        
    while True:
        prev = name
        # Strip trailing final keywords
        name = re.sub(r"[\s_\-]+(?:최종안?|수정완료|제출용|배포용|복사본|copy|final|submit|dist)$", "", name, flags=re.IGNORECASE)
        # Strip trailing numbers with optional leading 'v'
        name = re.sub(r"[\s_\-]+(?:v)?\d+$", "", name, flags=re.IGNORECASE)
        name = re.sub(r"[\s_\-]+$", "", name)
        if name == prev:
            break
            
    return name + summary + ext
```

#### Final File Renaming Logic:
```python
                # Inside components processing (else branch where len(comp) > 1)
                os.makedirs(dest_dir, exist_ok=True)
                clean_base = get_clean_base_filename(final_info["std_name"])
                
                # Extract and append keyword tag
                keywords = extract_korean_keywords(final_info["content"])
                if keywords:
                    name_part, ext_part = os.path.splitext(clean_base)
                    clean_base = f"{name_part}_({', '.join(keywords)}){ext_part}"
                
                proposed_final_name = "★최종★_" + clean_base
                resolved_final_name = resolve_filename_collision(dest_dir, proposed_final_name, final_info["orig_path"])
                final_dest_path = os.path.join(dest_dir, resolved_final_name)
```

---

## 3. R3: Real-Time Cache Synchronization in `.search_cache.json`

The existing real-time cache synchronization mechanism in `scratch/organize-files.py` works via the `sync_cache_move` helper:

1. **Pop Old Path**: Popping the old path from `global_cache` removes the entry, preventing any stale index keys.
2. **Register New Path**: The new absolute path (containing the new `★최종★_` prefix and injected `_(...)` keyword tags) is registered as the key in `global_cache`.
3. **Stat Update**: Reads the actual `mtime` and `size` from the disk if the file exists at the destination, otherwise falls back to metadata values.
4. **Final Flush**: At the end of the script, keys that do not exist physically are pruned, and `save_search_cache()` writes the final `.search_cache.json` structure to the disk once.

### Verification of Compliance
Because `sync_cache_move` receives the resolved `final_dest_path` (which includes the new prefix and keyword tags), the cache updates with the exact name.
Since the cache uses **absolute paths** as keys, and the paths are updated and written correctly to the disk, the search index remains in full synchrony. No changes to the cache logic itself are required; it natively handles the name changes.

---

## 4. Updates to `scratch/verify-duplicates.py`

To accommodate the new prefix format and the keyword extraction logic, the test script must be updated in two ways:
1. **Update assertions** in existing test cases (A, B, C, G) from `[최종] ` to `★최종★_`.
2. **Add a new Test Case I** targeting the keyword extraction, stopword list, and tag injection.

### Test Cases Revision Plan:
- **Test Case A**: Expects `★최종★_20260715_주요업무보고_(강남, 메디헬스, 센터, 주요업무보고).hwpx` (or similar depending on extracted keywords).
- **Test Case B**: Expects `★최종★_20260715_체력인증계획_(서울체력장, 추가).hwpx`.
- **Test Case C**: Expects no double-prefixing for `★최종★_` (i.e. `★최종★_★최종★_...` is prevented).
- **Test Case G**: Expects tag cleanup of `COPY_V3` and `Final` into `★최종★_20260715_바른자세_보고서_(바른자세, 예방하기).txt`.

### New Test Case I (Specific Tag Injection Test):
This test case will generate mock content that explicitly maps to targeted keywords and verifies their injection.

```python
# -------------------------------------------------------------
# Test Case I: Korean Keyword Extraction & Tag Injection
# -------------------------------------------------------------
print("\n--- Test Case I: Korean Keyword Extraction & Tag Injection ---")
if os.path.exists(TEST_ROOT):
    shutil.rmtree(TEST_ROOT)
os.makedirs(TEST_ROOT, exist_ok=True)
org.global_cache = {}
if os.path.exists(org.CACHE_PATH):
    os.remove(org.CACHE_PATH)

# Body text containing specific target keywords and stopwords
# Target keywords should be: '체력인증센터', '국민체육진흥', '성과계획', '기획'
# Stopwords like '운영', '실적', '보고서' should be filtered out.
content_i = "체력인증센터 운영 실적 및 국민체육진흥 기획 성과계획 보고서"

create_mock_file("20260715_체력인증보고_1.hwpx", content_i, mtime_offset=0)
create_mock_file("20260715_체력인증보고_2.hwpx", content_i + " 수정완료", mtime_offset=-50) # older but has final keyword

org.main()

all_moved_files_i = list_all_files(TEST_ROOT)
print("Files after Test Case I:")
for f in all_moved_files_i:
    print(f"  {f}")

# Target folder path
dir_i_root = "01_강남_AI_메디헬스_센터/01-1_서울체력장/2026년/04_계획 및 방침"

# Locate final file
final_file_i = [f for f in all_moved_files_i if "★최종★_20260715_체력인증보고" in f]
assert len(final_file_i) == 1, "Test Case I failed: final file with ★최종★_ prefix not found"

# Verify keyword tag presence and correct order of top keywords
final_name = os.path.basename(final_file_i[0])
print(f"Final file name: {final_name}")

# Regex to check pattern: ★최종★_20260715_체력인증보고_(keyword1, keyword2, ...).hwpx
# The keywords should match the most frequent nouns in the body content
keyword_pattern = r"^★최종★_20260715_체력인증보고_\((체력인증센터|국민체육진흥|성과계획|기획)(?:,\s*(체력인증센터|국민체육진흥|성과계획|기획))*\)\.hwpx$"
assert re.match(keyword_pattern, final_name), f"Test Case I failed: keyword tag structure invalid: {final_name}"

# Check that the keywords injected are the correct ones
for kw in ['체력인증센터', '국민체육진흥', '성과계획', '기획']:
    assert kw in final_name, f"Test Case I failed: expected keyword {kw} in filename"

# Check stopwords are NOT injected
for stop in ['운영', '실적', '보고서', '수정완료']:
    assert stop not in final_name, f"Test Case I failed: stopword '{stop}' wrongly injected in filename"

print("✓ Test Case I (Keyword Extraction & Tag Injection) Passed.")
```
