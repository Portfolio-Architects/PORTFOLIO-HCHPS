import os
import sys
import shutil
import importlib.util
import json

# 1. Dynamically import organize-files.py
spec = importlib.util.spec_from_file_location("organize_files", "scratch/organize-files.py")
org = importlib.util.module_from_spec(spec)
sys.modules["organize_files"] = org
spec.loader.exec_module(org)

# 2. Setup mock environment inside the workspace
TEST_ROOT = os.path.abspath("scratch/test_env")
if os.path.exists(TEST_ROOT):
    shutil.rmtree(TEST_ROOT)
os.makedirs(TEST_ROOT, exist_ok=True)

# Patch the paths inside the imported module
org.ROOT_DIR = TEST_ROOT
org.CACHE_PATH = os.path.join(TEST_ROOT, ".search_cache.json")

# Bypass network-dependent AI summary
org.get_ai_content_summary = lambda filename, content, target_work: ""

# Mock parsers to read text directly from files (since mock files are plain text)
org.parse_pdf_text = lambda path: open(path, "r", encoding="utf-8").read()
org.parse_hwpx_text = lambda path: open(path, "r", encoding="utf-8").read()

print(f"Mock ROOT_DIR set to: {org.ROOT_DIR}")
print(f"Mock CACHE_PATH set to: {org.CACHE_PATH}")

def create_mock_file(rel_path, content, mtime_offset=0):
    filepath = os.path.join(TEST_ROOT, rel_path)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    if isinstance(content, bytes):
        with open(filepath, "wb") as f:
            f.write(content)
    else:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
            
    if mtime_offset:
        stat = os.stat(filepath)
        os.utime(filepath, (stat.st_atime, stat.st_mtime + mtime_offset))
    return filepath

# -------------------------------------------------------------
# Test Case A: Keyword Priority
# -------------------------------------------------------------
text_a1 = "주간 주요업무보고 강남 AI 메디헬스 센터 예산 실적 및 계획"
text_a2 = "주간 주요업무보고 강남 AI 메디헬스 센터 예산 실적 및 계획 수정"

# 20260715_주요업무보고_1.hwpx is newer (mtime offset +100) but has no keywords
create_mock_file("20260715_주요업무보고_1.hwpx", text_a1, mtime_offset=100)
# 20260715_주요업무보고_수정완료.hwpx is older (mtime offset 0) but has keyword '수정완료'
create_mock_file("20260715_주요업무보고_수정완료.hwpx", text_a2, mtime_offset=0)

# -------------------------------------------------------------
# Test Case B: Most Recent mtime Tie-Breaker
# -------------------------------------------------------------
text_b1 = "서울체력장 계획 추진 방침서"
text_b2 = "서울체력장 계획 추진 방침서 추가"

# 20260715_체력인증계획_1.hwpx is newer (mtime offset +200), no keywords
create_mock_file("20260715_체력인증계획_1.hwpx", text_b1, mtime_offset=200)
# 20260715_체력인증계획_2.hwpx is older (mtime offset +50), no keywords
create_mock_file("20260715_체력인증계획_2.hwpx", text_b2, mtime_offset=50)

print("Mock files created. Running first pass of organize-files.py...")
org.main()

print("\n--- Verifying First Run Results ---")

def list_all_files(dir_path):
    result = []
    for root, _, files in os.walk(dir_path):
        for file in files:
            result.append(os.path.relpath(os.path.join(root, file), dir_path))
    return sorted(result)

all_moved_files_1 = list_all_files(TEST_ROOT)
print("Files in TEST_ROOT after first organize:")
for f in all_moved_files_1:
    print(f"  {f}")

# Target folders:
# Test Case A should map to "09_주간 및 월간 계획/2026년/07_주간 및 월간 계획"
# Test Case B should map to "01_강남_AI_메디헬스_센터/01-1_서울체력장/2026년/04_계획 및 방침"
dir_a_root = "09_주간 및 월간 계획/2026년/07_주간 및 월간 계획"
dir_b_root = "01_강남_AI_메디헬스_센터/01-1_서울체력장/2026년/04_계획 및 방침"

def find_file(lst, folder, name_part):
    for f in lst:
        if f.replace('\\', '/').startswith(folder.replace('\\', '/')) and name_part in f:
            return f
    return None

# Verify A: 수정완료 is the final file (kept in root as ★최종★_20260715_주요업무보고_(강남, 메디헬스, 센터, 수정).hwpx)
# _1 is duplicate (moved to _Duplicates/20260715_주요업무보고_1.hwpx)
f_a_final = find_file(all_moved_files_1, dir_a_root, "★최종★_20260715_주요업무보고_(강남, 메디헬스, 센터, 수정).hwpx")
f_a_dup = find_file(all_moved_files_1, os.path.join(dir_a_root, "_Duplicates"), "20260715_주요업무보고_1.hwpx")

assert f_a_final is not None, "Test Case A failed: final file ★최종★_20260715_주요업무보고_(강남, 메디헬스, 센터, 수정).hwpx not found in root"
assert f_a_dup is not None, "Test Case A failed: duplicate 20260715_주요업무보고_1.hwpx not found in _Duplicates"
print("✓ Test Case A (Keyword Priority) Passed.")

# Verify B: _1 is final (mtime offset +200 is newer) -> kept as ★최종★_20260715_체력인증계획_(방침서, 서울체력장, 추진).hwpx
# _2 is duplicate (moved to _Duplicates/20260715_체력인증계획_2.hwpx)
f_b_final = find_file(all_moved_files_1, dir_b_root, "★최종★_20260715_체력인증계획_(방침서, 서울체력장, 추진).hwpx")
f_b_dup = find_file(all_moved_files_1, os.path.join(dir_b_root, "_Duplicates"), "20260715_체력인증계획_2.hwpx")

assert f_b_final is not None, "Test Case B failed: final file ★최종★_20260715_체력인증계획_(방침서, 서울체력장, 추진).hwpx not found in root"
assert f_b_dup is not None, "Test Case B failed: duplicate 20260715_체력인증계획_2.hwpx not found in _Duplicates"
print("✓ Test Case B (Most Recent mtime Tie-Breaker) Passed.")

# -------------------------------------------------------------
# Test Case C: Repeat-Run Prefix Accumulation Prevention
# -------------------------------------------------------------
print("\nRunning second pass of organize-files.py...")
org.main()

all_moved_files_2 = list_all_files(TEST_ROOT)
print("Files in TEST_ROOT after second organize:")
for f in all_moved_files_2:
    print(f"  {f}")

# Verify no duplicate prefix '★최종★_★최종★_...'
for f in all_moved_files_2:
    base = os.path.basename(f)
    assert not base.startswith("★최종★_★최종★_"), f"Prefix accumulation detected: {base}"
    if base.startswith("★최종★_"):
        assert base.count("★최종★_") == 1, f"Multiple '★최종★_' tags in filename: {base}"

# Also check that final files and duplicates are still in their respective folders
f_a_final_2 = find_file(all_moved_files_2, dir_a_root, "★최종★_20260715_주요업무보고_(강남, 메디헬스, 센터, 수정).hwpx")
f_a_dup_2 = find_file(all_moved_files_2, os.path.join(dir_a_root, "_Duplicates"), "20260715_주요업무보고_1.hwpx")
f_b_final_2 = find_file(all_moved_files_2, dir_b_root, "★최종★_20260715_체력인증계획_(방침서, 서울체력장, 추진).hwpx")
f_b_dup_2 = find_file(all_moved_files_2, os.path.join(dir_b_root, "_Duplicates"), "20260715_체력인증계획_2.hwpx")

assert f_a_final_2 is not None, "Test Case C failed: final file not preserved after rerun"
assert f_a_dup_2 is not None, "Test Case C failed: duplicate file not preserved after rerun"
assert f_b_final_2 is not None, "Test Case C failed: final file not preserved after rerun"
assert f_b_dup_2 is not None, "Test Case C failed: duplicate file not preserved after rerun"

print("✓ Test Case C (Repeat-Run Prefix Accumulation Prevention) Passed.")

# -------------------------------------------------------------
# Test Case D: Real-time Cache Write and Key Pruning Validation
# -------------------------------------------------------------
assert os.path.exists(org.CACHE_PATH), "Test Case D failed: Cache file not created"
with open(org.CACHE_PATH, "r", encoding="utf-8") as f:
    cache = json.load(f)

print(f"Cache contains {len(cache)} entries.")
current_abs_files = set()
for rel_f in all_moved_files_2:
    if rel_f == ".search_cache.json":
        continue
    abs_path = os.path.abspath(os.path.join(TEST_ROOT, rel_f))
    current_abs_files.add(abs_path)
    
    assert abs_path in cache, f"Test Case D failed: File {rel_f} is not in cache"
    assert "hash" in cache[abs_path], f"Test Case D failed: Cache entry for {rel_f} lacks hash"
    assert cache[abs_path]["hash"] != "", f"Test Case D failed: Cache hash is empty for {rel_f}"

# Assert no stale keys
for cache_key in cache.keys():
    assert cache_key in current_abs_files, f"Test Case D failed: Stale key found in cache: {cache_key}"

print("✓ Test Case D (Real-time Cache Write & Pruning) Passed.")

# -------------------------------------------------------------
# Test Case E: Parallel binary options (different content/names, same size)
# -------------------------------------------------------------
print("\n--- Test Case E: Parallel binary options ---")
if os.path.exists(TEST_ROOT):
    shutil.rmtree(TEST_ROOT)
os.makedirs(TEST_ROOT, exist_ok=True)
org.global_cache = {}
if os.path.exists(org.CACHE_PATH):
    os.remove(org.CACHE_PATH)

# Create two binary files with same size (100 bytes) but different names and content
create_mock_file("20260715_리플릿_시안_A안.bin", b"A" * 100)
create_mock_file("20260715_리플릿_시안_B안.bin", b"B" * 100)

org.main()

all_moved_files_e = list_all_files(TEST_ROOT)
print("Files after Test Case E:")
for f in all_moved_files_e:
    print(f"  {f}")

# Target folder: "06_교육_자료_제작/2026년/05_디자인 시안"
dir_e_root = "06_교육_자료_제작/2026년/05_디자인 시안"
f_a = find_file(all_moved_files_e, dir_e_root, "A안.bin")
f_b = find_file(all_moved_files_e, dir_e_root, "B안.bin")

assert f_a is not None, "Test Case E failed: A안.bin not found"
assert f_b is not None, "Test Case E failed: B안.bin not found"
# Also check that they are not in _Duplicates
f_dup_a = find_file(all_moved_files_e, os.path.join(dir_e_root, "_Duplicates"), "A안.bin")
f_dup_b = find_file(all_moved_files_e, os.path.join(dir_e_root, "_Duplicates"), "B안.bin")
assert f_dup_a is None, "Test Case E failed: A안.bin was moved to _Duplicates"
assert f_dup_b is None, "Test Case E failed: B안.bin was moved to _Duplicates"
print("✓ Test Case E (Parallel Binary Options) Passed.")

# -------------------------------------------------------------
# Test Case F: Empty placeholder files
# -------------------------------------------------------------
print("\n--- Test Case F: Empty placeholder files ---")
if os.path.exists(TEST_ROOT):
    shutil.rmtree(TEST_ROOT)
os.makedirs(TEST_ROOT, exist_ok=True)
org.global_cache = {}
if os.path.exists(org.CACHE_PATH):
    os.remove(org.CACHE_PATH)

# Different names: 회의록_A.txt vs 회의록_B.txt
create_mock_file("20260715_회의록_A.txt", b"")
create_mock_file("20260715_회의록_B.txt", b"")
# Different extensions: 보고서.pdf vs 보고서.hwpx
create_mock_file("20260715_보고서.pdf", b"")
create_mock_file("20260715_보고서.hwpx", b"")

org.main()

all_moved_files_f = list_all_files(TEST_ROOT)
print("Files after Test Case F:")
for f in all_moved_files_f:
    print(f"  {f}")

f_txt_a = [f for f in all_moved_files_f if "회의록_A.txt" in f]
f_txt_b = [f for f in all_moved_files_f if "회의록_B.txt" in f]
f_pdf = [f for f in all_moved_files_f if "보고서.pdf" in f]
f_hwpx = [f for f in all_moved_files_f if "보고서.hwpx" in f]

assert len(f_txt_a) == 1, "Test Case F failed: 회의록_A.txt not found or duplicated"
assert len(f_txt_b) == 1, "Test Case F failed: 회의록_B.txt not found or duplicated"
assert len(f_pdf) == 1, "Test Case F failed: 보고서.pdf not found or duplicated"
assert len(f_hwpx) == 1, "Test Case F failed: 보고서.hwpx not found or duplicated"

duplicates_folders = [f for f in all_moved_files_f if "_Duplicates" in f]
assert len(duplicates_folders) == 0, f"Test Case F failed: files were moved to _Duplicates: {duplicates_folders}"
print("✓ Test Case F (Empty placeholder files) Passed.")

# -------------------------------------------------------------
# Test Case G: Case-insensitive tag cleaning
# -------------------------------------------------------------
print("\n--- Test Case G: Case-insensitive tag cleaning ---")
if os.path.exists(TEST_ROOT):
    shutil.rmtree(TEST_ROOT)
os.makedirs(TEST_ROOT, exist_ok=True)
org.global_cache = {}
if os.path.exists(org.CACHE_PATH):
    os.remove(org.CACHE_PATH)

content_g = "바른자세 개선 사업에 대한 결과 보고서 내용입니다."
create_mock_file("20260715_바른자세_보고서_COPY_V3.txt", content_g, mtime_offset=0)
create_mock_file("20260715_바른자세_보고서_Final.txt", content_g, mtime_offset=100)

org.main()

all_moved_files_g = list_all_files(TEST_ROOT)
print("Files after Test Case G:")
for f in all_moved_files_g:
    print(f"  {f}")

f_final_g = [f for f in all_moved_files_g if "★최종★_20260715_바른자세_보고서.txt" in f.replace('\\', '/')]
assert len(f_final_g) == 1, "Test Case G failed: Suffixes were not cleaned correctly into ★최종★_20260715_바른자세_보고서.txt"
print("✓ Test Case G (Case-insensitive tag cleaning) Passed.")

# -------------------------------------------------------------
# Test Case H: Cache writing once at the end
# -------------------------------------------------------------
print("\n--- Test Case H: Cache writing once at the end ---")
if os.path.exists(TEST_ROOT):
    shutil.rmtree(TEST_ROOT)
os.makedirs(TEST_ROOT, exist_ok=True)
org.global_cache = {}
if os.path.exists(org.CACHE_PATH):
    os.remove(org.CACHE_PATH)

cache_write_count = 0
orig_save_search_cache = org.save_search_cache

def mock_save_search_cache():
    global cache_write_count
    cache_write_count += 1
    orig_save_search_cache()

org.save_search_cache = mock_save_search_cache

# Create 5 duplicate files to move/deduplicate
content_h = "강남 AI 메디헬스 센터 인바디 측정 결과 보고서"
for i in range(5):
    create_mock_file(f"20260715_메디헬스_보고서_{i}.hwpx", content_h, mtime_offset=i*10)

org.main()

print(f"Total cache write calls: {cache_write_count}")
# Restore the original function
org.save_search_cache = orig_save_search_cache

assert cache_write_count == 1, f"Test Case H failed: save_search_cache called {cache_write_count} times instead of 1"
print("✓ Test Case H (Cache writing once at the end) Passed.")

# -------------------------------------------------------------
# Test Case I: Validating R1/R2 (Keyword Extraction & Tag Injection)
# -------------------------------------------------------------
print("\n--- Test Case I: Validating R1/R2 (Keyword Extraction & Tag Injection) ---")
if os.path.exists(TEST_ROOT):
    shutil.rmtree(TEST_ROOT)
os.makedirs(TEST_ROOT, exist_ok=True)
org.global_cache = {}
if os.path.exists(org.CACHE_PATH):
    os.remove(org.CACHE_PATH)

# Content with particles, stopwords and unique words
content_i = "양재천 건강걷기 행사에서 걷기 추진 계획에 대한 회의 안건 결과 보고를 진행하였습니다."
# Stems expected: '건강걷기', '걷기', '대한', '안건' (after filtering 및/등/경우/내용/결과/보고/계획/사업/현황, and not stripping '의' from '회의' because len('회') < 2)

create_mock_file("20260715_걷기행사_1.hwpx", content_i, mtime_offset=0)
create_mock_file("20260715_걷기행사_2.hwpx", content_i, mtime_offset=100)

org.main()

all_moved_files_i = list_all_files(TEST_ROOT)
print("Files after Test Case I:")
for f in all_moved_files_i:
    print(f"  {f}")

# Target folder should be 03_양재천_건강걷기_및_걷자페스티벌/2026년/04_계획 및 방침
dir_i_root = "03_양재천_건강걷기_및_걷자페스티벌/2026년/04_계획 및 방침"
f_final_i = find_file(all_moved_files_i, dir_i_root, "★최종★_20260715_걷기행사_(건강걷기, 걷기, 대한, 안건).hwpx")
f_dup_i = find_file(all_moved_files_i, os.path.join(dir_i_root, "_Duplicates"), "20260715_걷기행사_1.hwpx")

assert f_final_i is not None, f"Test Case I failed: final file with keyword tag not found. Files: {all_moved_files_i}"
assert f_dup_i is not None, "Test Case I failed: duplicate file not found in _Duplicates"
print("✓ Test Case I (Keyword Extraction & Tag Injection) Passed.")

print("\nALL TESTS PASSED SUCCESSFULLY!")

# Cleanup test_env
if os.path.exists(TEST_ROOT):
    shutil.rmtree(TEST_ROOT)
