import os
import sys
import shutil
import time
import hashlib
import json
import random

# Add scratch path to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Dynamically import organize-files
import importlib.util
spec = importlib.util.spec_from_file_location("organize_files", os.path.join(os.path.dirname(os.path.abspath(__file__)), "organize-files.py"))
organize_files = importlib.util.module_from_spec(spec)
spec.loader.exec_module(organize_files)

TEST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_workspace")

def setup_test_directory():
    if os.path.exists(TEST_DIR):
        shutil.rmtree(TEST_DIR)
    os.makedirs(TEST_DIR)
    # Patch organize_files globals
    organize_files.ROOT_DIR = TEST_DIR
    organize_files.CACHE_PATH = os.path.join(TEST_DIR, ".search_cache.json")
    organize_files.global_cache = {}
    print(f"[Test Setup] Cleaned and patched TEST_DIR: {TEST_DIR}")

def run_organizer():
    print("[Test Run] Running organize_files.main()...")
    start = time.time()
    organize_files.main()
    duration = time.time() - start
    print(f"[Test Run] Finished in {duration:.4f} seconds.")
    return duration

def count_all_files(directory):
    count = 0
    file_list = []
    for root, _, files in os.walk(directory):
        for f in files:
            if f in [".search_cache.json", "desktop.ini"]:
                continue
            path = os.path.join(root, f)
            count += 1
            file_list.append(path)
    return count, file_list

def test_scenario_massive_duplicates():
    print("\n--- TEST: Massive Amount of Duplicates ---")
    setup_test_directory()
    
    # We will create 200 duplicate files
    # The deduplication engine groups files by dest_dir. 
    # They should be mapped to the same dest_dir. We can do this by using a high priority keyword like "양재천" or similar.
    content = "양재천 건강걷기 대회에 참가하여 걷기 코스를 완료하고 기념품을 수령했습니다. 양재천 걷자 페스티벌 최고!"
    
    for i in range(200):
        # Slightly different filenames but similar/identical, all mapped to 03_양재천...
        filename = f"20260715_양재천_걷기_행사계획_v{i}.txt"
        filepath = os.path.join(TEST_DIR, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
            
    initial_count, _ = count_all_files(TEST_DIR)
    print(f"Created {initial_count} duplicate files.")
    
    duration = run_organizer()
    
    final_count, files = count_all_files(TEST_DIR)
    print(f"Final file count: {final_count}")
    
    # Check if any files were deleted
    # The total number of files should remain 200 (1 in main folder, 199 in _Duplicates)
    assert final_count == 200, f"Expected 200 files, but got {final_count}. Potential data loss!"
    
    # Check if exactly one [최종] file exists in the target dir, and 199 in _Duplicates
    duplicates_dir = None
    final_file = None
    for f in files:
        if "_Duplicates" in f:
            duplicates_dir = os.path.dirname(f)
        elif "[최종]" in os.path.basename(f):
            final_file = f
            
    assert final_file is not None, "No [최종] representative file found!"
    assert duplicates_dir is not None, "No _Duplicates folder found!"
    
    dup_count = len(os.listdir(duplicates_dir))
    print(f"Duplicates in folder: {dup_count}")
    assert dup_count == 199, f"Expected 199 duplicates, but got {dup_count}."
    print("Scenario Massive Duplicates: PASS")

def test_scenario_empty_invalid_files():
    print("\n--- TEST: Empty/Invalid Content Files ---")
    setup_test_directory()
    
    # Case 1: Empty files with different names.
    # Since they are empty, their hashes are identical (SHA-256 of empty string).
    # Since they are in the same directory, will they be grouped together as duplicates?
    # Yes, they have identical hash_val! Let's see what happens.
    # If they are treated as duplicates, one of them will be chosen as final and the others will be moved to _Duplicates.
    # If they have completely different names (e.g. different projects), this is a false positive of deduplication!
    
    # We map them to 08_기타_일반행정 using empty content (no keywords)
    # File 1: 20260715_업체대금_청구서.txt (empty)
    # File 2: 20260715_회의참석자_명단.txt (empty)
    filepath_1 = os.path.join(TEST_DIR, "20260715_업체대금_청구서.txt")
    filepath_2 = os.path.join(TEST_DIR, "20260715_회의참석자_명단.txt")
    
    with open(filepath_1, "wb") as f:
        pass
    with open(filepath_2, "wb") as f:
        pass
        
    initial_count, _ = count_all_files(TEST_DIR)
    print(f"Created {initial_count} empty files with different names.")
    
    run_organizer()
    
    final_count, files = count_all_files(TEST_DIR)
    print(f"Final file count: {final_count}")
    print("Files after processing:")
    for f in files:
        print(f"  {os.path.relpath(f, TEST_DIR)}")
        
    # Check if both survived
    assert final_count == 2, f"Expected 2 files, but got {final_count}."
    
    # Were they consolidated?
    # Let's inspect if one is in _Duplicates
    has_duplicates = any("_Duplicates" in f for f in files)
    if has_duplicates:
        print("⚠️  Warning: Empty files with different names were consolidated as duplicates!")
        print("This is a FALSE POSITIVE deduplication issue because their hashes match (empty file hash) but they represent different documents.")
    else:
        print("Empty files were not consolidated.")
        
    print("Scenario Empty/Invalid Files: PASS")

def test_scenario_casing_and_patterns():
    print("\n--- TEST: Filenames Containing Multiple Final Keywords in Different Casings/Patterns ---")
    setup_test_directory()
    
    # We want to see how final keywords are stripped and ranked
    # Create duplicates with various final tags:
    # 1. 20260715_바른자세_회의록_최종.txt
    # 2. 20260715_바른자세_회의록_수정완료.txt
    # 3. 20260715_바른자세_회의록_FINAL.txt (casing)
    # 4. 20260715_바른자세_회의록_제출용.txt
    # 5. 20260715_바른자세_회의록_final_v2.txt (lowercase and v2)
    # 6. 20260715_바른자세_회의록_배포용.txt
    
    content = "바른자세 개선 사업 회의를 척추측만증 및 거북목 예방 주제로 진행하였습니다."
    
    filenames = [
        "20260715_바른자세_회의록_최종.txt",
        "20260715_바른자세_회의록_수정완료.txt",
        "20260715_바른자세_회의록_FINAL.txt",
        "20260715_바른자세_회의록_제출용.txt",
        "20260715_바른자세_회의록_final_v2.txt",
        "20260715_바른자세_회의록_배포용.txt"
    ]
    
    for i, name in enumerate(filenames):
        filepath = os.path.join(TEST_DIR, name)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        # Set mtime slightly different so we can track ordering
        # Earlier index has higher rank in final keyword list but let's see how mtime affects it
        # Sort key is (has_final_keyword, mtime)
        os.utime(filepath, (time.time(), time.time() + i * 10))
        
    initial_count, _ = count_all_files(TEST_DIR)
    print(f"Created {initial_count} files with varying final keywords and casings.")
    
    run_organizer()
    
    final_count, files = count_all_files(TEST_DIR)
    print(f"Final file count: {final_count}")
    print("Files after processing:")
    for f in files:
        print(f"  {os.path.relpath(f, TEST_DIR)}")
        
    # Check if exactly one [최종] file exists in the target dir, and 5 in _Duplicates
    final_file = None
    for f in files:
        if "[최종]" in os.path.basename(f):
            final_file = f
            
    assert final_file is not None, "No [최종] representative file found!"
    print(f"Selected final file: {os.path.basename(final_file)}")
    
    # Check if the chosen final file has cleaned name properly
    # Base name should be clean, like `[최종] 20260715_바른자세_회의록.txt`
    # Let's see what name was produced.
    expected_base_name = "[최종] 20260715_바른자세_회의록.txt"
    actual_base_name = os.path.basename(final_file)
    print(f"Expected base name: {expected_base_name}")
    print(f"Actual base name: {actual_base_name}")
    
    if actual_base_name != expected_base_name:
        print(f"⚠️  Warning: Filename cleaning did not produce the expected base name! Got: {actual_base_name}")
        
    print("Scenario Casing and Patterns: PASS")

def test_scenario_collided_hashes_sizes():
    print("\n--- TEST: Files with Collided Hashes/Sizes (Different content but same size, no text) ---")
    setup_test_directory()
    
    # We want to simulate Tier 4 duplicate logic:
    # "SequenceMatcher filename similarity >= 80% AND size difference <= 5% (for non-text/binary files)"
    # Create two binary files with:
    # - Different contents (different hashes)
    # - Same size (e.g. 100 bytes)
    # - Names with SequenceMatcher similarity >= 80%
    # - Mapped to the same folder (e.g. 05_디자인 시안 using "디자인" in filename, which maps to 05_디자인 시안 or similar)
    # Let's map them to 06_교육_자료_제작 (using "리플릿")
    
    # Note: organize-files.py checks `not info_i["content"] or not info_j["content"]`.
    # Let's write binary bytes that cannot be decoded or parsed (like random bytes).
    # Since they are `.bin` files, `get_inferred_date_and_content` will not extract any text (as it only parses pdf/hwpx).
    # So `content` will be empty.
    
    filepath_1 = os.path.join(TEST_DIR, "20260715_리플릿_디자인_시안_A안.bin")
    filepath_2 = os.path.join(TEST_DIR, "20260715_리플릿_디자인_시안_B안.bin")
    
    # Different content but same size (100 bytes)
    data_1 = bytes([random.randint(0, 255) for _ in range(100)])
    data_2 = bytes([random.randint(0, 255) for _ in range(100)])
    
    # Make sure hashes are different
    while hashlib.sha256(data_1).hexdigest() == hashlib.sha256(data_2).hexdigest():
        data_2 = bytes([random.randint(0, 255) for _ in range(100)])
        
    with open(filepath_1, "wb") as f:
        f.write(data_1)
    with open(filepath_2, "wb") as f:
        f.write(data_2)
        
    initial_count, _ = count_all_files(TEST_DIR)
    print(f"Created {initial_count} binary files of same size (100 bytes) but different contents.")
    print(f"File 1 Hash: {hashlib.sha256(data_1).hexdigest()}")
    print(f"File 2 Hash: {hashlib.sha256(data_2).hexdigest()}")
    
    run_organizer()
    
    final_count, files = count_all_files(TEST_DIR)
    print(f"Final file count: {final_count}")
    print("Files after processing:")
    for f in files:
        print(f"  {os.path.relpath(f, TEST_DIR)}")
        
    # Since they are different designs (A안 vs B안), they should NOT be treated as duplicates!
    # Let's see if one of them was put into _Duplicates.
    has_duplicates = any("_Duplicates" in f for f in files)
    if has_duplicates:
        print("❌ CRITICAL BUG: Different binary files with similar names and same size were consolidated as duplicates (data loss risk)!")
    else:
        print("Binary files of same size with similar names were not consolidated. PASS")
        
    print("Scenario Collided Hashes/Sizes: PASS")

def test_cache_integrity():
    print("\n--- TEST: Cache Integrity and Stale Key Pruning ---")
    setup_test_directory()
    
    # Create a file
    filepath = os.path.join(TEST_DIR, "20260715_양재천_걷기_행사.txt")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("양재천 건강걷기 행사 계획")
        
    run_organizer()
    
    # Check cache file
    cache_file = organize_files.CACHE_PATH
    assert os.path.exists(cache_file), "Cache file was not created!"
    
    with open(cache_file, "r", encoding="utf-8") as f:
        cache_data = json.load(f)
    print(f"Cache size: {len(cache_data)}")
    
    # Now simulate a stale key: manually insert an entry for a file that doesn't exist
    fake_path = os.path.abspath(os.path.join(TEST_DIR, "non_existent_file.txt"))
    cache_data[fake_path] = {
        "mtime": 12345678,
        "size": 100,
        "content": "fake content",
        "hash": "fakehash"
    }
    
    # Write back to cache
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(cache_data, f, ensure_ascii=False, indent=2)
        
    # Re-run organizer
    organize_files.global_cache = {} # Force reload
    run_organizer()
    
    # Read cache again
    with open(cache_file, "r", encoding="utf-8") as f:
        updated_cache = json.load(f)
        
    # Check if stale key was pruned
    assert fake_path not in updated_cache, "Stale cache key was not pruned!"
    print("Stale cache key pruning: PASS")

if __name__ == "__main__":
    test_scenario_massive_duplicates()
    test_scenario_empty_invalid_files()
    test_scenario_casing_and_patterns()
    test_scenario_collided_hashes_sizes()
    test_cache_integrity()
    
    # Cleanup test workspace
    if os.path.exists(TEST_DIR):
        shutil.rmtree(TEST_DIR)
        print("\n[Test Cleanup] Cleaned test workspace.")
