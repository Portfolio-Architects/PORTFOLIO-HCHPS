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

# Test Case 1: Exact Duplicate (Binary / SHA-256)
create_mock_file("08_기타_일반행정/2026년/05_디자인 시안/20260715_contract_original.pdf", b"pdf_binary_content_abc123")
create_mock_file("20260715_contract_duplicate.pdf", b"pdf_binary_content_abc123")

# Test Case 2: Cosine Similarity >= 80% (Text files)
org.parse_pdf_text = lambda path: open(path, "r", encoding="utf-8").read()

text_orig = "주요업무보고 강남 AI 메디헬스 센터 예산 계획 수의계약 업체 선정 평가 확인서"
text_sim_high = "주요업무보고 강남 AI 메디헬스 센터 예산 계획 수의계약 업체 선정 평가 확인서 임시" # > 90% similar
text_sim_med = "강남 AI 메디헬스 센터 예산 계획 수의계약" # ~60% similar

# Original structured file:
create_mock_file("01_강남_AI_메디헬스_센터/01-2_헬스체크업/2026년/01_수의계약/20260715_report_orig.pdf", text_orig)
# High similarity duplicate:
create_mock_file("20260715_report_sim_high.pdf", text_sim_high)
# Medium similarity but similar name duplicate:
create_mock_file("20260715_report_orig_v2.pdf", text_sim_med)

# Test Case 3: Versioning Safety (Low similarity)
create_mock_file("20260715_unrelated_report.pdf", text_sim_med)

# Test Case 4: Non-text file similarity (Filename >= 80% and Size difference <= 5%)
# Original structured file:
create_mock_file("08_기타_일반행정/2026년/06_기타서류/20260715_image_asset.bin", b"A" * 1000)
# Duplicate (95% size similarity, same/similar name):
create_mock_file("20260715_image_asset_copy.bin", b"B" * 980) 
# Non-duplicate (different size, similar name):
create_mock_file("20260715_image_asset_large.bin", b"C" * 800) 

print("Mock files created. Running main()...")
org.main()

print("\n--- Verifying Results ---")

# Let's inspect the directory structure after organize
def list_all_files(dir_path):
    result = []
    for root, _, files in os.walk(dir_path):
        for file in files:
            result.append(os.path.relpath(os.path.join(root, file), dir_path))
    return sorted(result)

all_moved_files = list_all_files(TEST_ROOT)
print("Files in TEST_ROOT after organize:")
for f in all_moved_files:
    print(f"  {f}")

# Directories for assertions
dir_contract = "08_기타_일반행정/2026년/05_디자인 시안"
dir_report = "01_강남_AI_메디헬스_센터/01-2_헬스체크업/2026년/01_수의계약"
dir_asset = "08_기타_일반행정/2026년/06_기타서류"

dup_contract = os.path.join(dir_contract, "_Duplicates")
dup_report = os.path.join(dir_report, "_Duplicates")
dup_asset = os.path.join(dir_asset, "_Duplicates")

# Helper to find file starting with prefix in list
def find_file(lst, folder, name_part):
    for f in lst:
        if f.replace('\\', '/').startswith(folder.replace('\\', '/')) and name_part in f:
            return f
    return None

# Check exact duplicate
f1 = find_file(all_moved_files, dir_contract, "contract_original")
f2 = find_file(all_moved_files, dup_contract, "contract_duplicate")
assert f1 is not None, "contract_original not found in target dir"
assert f2 is not None, "contract_duplicate not found in _Duplicates dir"
print("✓ Test Case 1 (Exact SHA-256 Duplicate) Passed.")

# Check text similarity high
f3 = find_file(all_moved_files, dir_report, "report_orig")
f4 = find_file(all_moved_files, dup_report, "report_sim_high")
assert f3 is not None, "report_orig not found in target dir"
assert f4 is not None, "report_sim_high not found in _Duplicates dir"
print("✓ Test Case 2a (High Cosine Similarity) Passed.")

# Check text similarity med with similar name
f5 = find_file(all_moved_files, dup_report, "report_orig_v2")
assert f5 is not None, "report_orig_v2 not found in _Duplicates dir"
print("✓ Test Case 2b (Med Cosine Similarity + High Name Similarity) Passed.")

# Check versioning safety (low similarity)
f6 = find_file(all_moved_files, dir_report, "unrelated_report")
assert f6 is not None, "unrelated_report not found in target dir"
assert "_Duplicates" not in f6, "unrelated_report incorrectly marked as duplicate"
print("✓ Test Case 3 (Versioning Safety) Passed.")

# Check binary similarity (high name + size diff <= 5%)
f7 = find_file(all_moved_files, dir_asset, "image_asset.bin")
f8 = find_file(all_moved_files, dup_asset, "image_asset_copy")
assert f7 is not None, "image_asset.bin not found in target"
assert f8 is not None, "image_asset_copy not found in _Duplicates"
print("✓ Test Case 4a (Binary name/size similarity duplicate) Passed.")

# Check binary non-duplicate (high name but size diff > 5%)
f9 = find_file(all_moved_files, dir_asset, "image_asset_large")
assert f9 is not None, "image_asset_large not found in target"
assert "_Duplicates" not in f9, "image_asset_large incorrectly marked as duplicate"
print("✓ Test Case 4b (Binary size difference > 5% non-duplicate) Passed.")

# Check cache contents
assert os.path.exists(org.CACHE_PATH), "Cache file not created"
with open(org.CACHE_PATH, "r", encoding="utf-8") as f:
    cache = json.load(f)

# The cache must map final paths to metadata containing the hash
for rel_f in all_moved_files:
    if rel_f == ".search_cache.json":
        continue
    abs_f = os.path.abspath(os.path.join(TEST_ROOT, rel_f))
    assert abs_f in cache, f"File {rel_f} not in cache"
    assert "hash" in cache[abs_f], f"File {rel_f} cache entry lacks hash"
    assert cache[abs_f]["hash"] != "", f"File {rel_f} hash is empty"

print("✓ Cache integrity verified (all files cached with non-empty hash).")
print("\nALL TESTS PASSED SUCCESSFULLY!")

# Cleanup test_env
shutil.rmtree(TEST_ROOT)
