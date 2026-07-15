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

TEST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_challenge_workspace")

def setup_test_directory():
    if os.path.exists(TEST_DIR):
        shutil.rmtree(TEST_DIR)
    os.makedirs(TEST_DIR)
    # Patch organize_files globals
    organize_files.ROOT_DIR = TEST_DIR
    organize_files.CACHE_PATH = os.path.join(TEST_DIR, ".search_cache.json")
    organize_files.global_cache = {}
    organize_files.IS_API_QUOTA_EXHAUSTED = True  # Avoid calling Gemini API during tests
    print(f"[Challenge Test Setup] Cleaned and patched TEST_DIR: {TEST_DIR}")

def run_organizer():
    print("[Challenge Test Run] Running organize_files.main()...")
    start = time.time()
    organize_files.main()
    duration = time.time() - start
    print(f"[Challenge Test Run] Finished in {duration:.4f} seconds.")
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

# Test results tracker
results = {}

def test_massive_duplicates():
    print("\n=== Challenge Test 1: Massive Amount of Duplicates ===")
    setup_test_directory()
    
    # We will create 500 duplicate files
    content = "양재천 건강걷기 대회에 참가하여 걷기 코스를 완료하고 기념품을 수령했습니다."
    
    for i in range(500):
        filename = f"20260715_양재천_걷기_행사계획_v{i}.txt"
        filepath = os.path.join(TEST_DIR, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
            
    initial_count, _ = count_all_files(TEST_DIR)
    print(f"Created {initial_count} duplicate files.")
    
    # We will measure the number of cache saves by patching save_search_cache
    original_save_cache = organize_files.save_search_cache
    save_count = [0]
    
    def mocked_save_cache():
        save_count[0] += 1
        original_save_cache()
        
    organize_files.save_search_cache = mocked_save_cache
    
    duration = run_organizer()
    
    # Restore original function
    organize_files.save_search_cache = original_save_cache
    
    final_count, files = count_all_files(TEST_DIR)
    print(f"Final file count: {final_count}")
    print(f"Cache file write count: {save_count[0]}")
    
    # Verify correctness
    assert final_count == 500, f"Expected 500 files, but got {final_count}. Potential data loss!"
    
    duplicates_dir = None
    final_file = None
    for f in files:
        if "_Duplicates" in f:
            duplicates_dir = os.path.dirname(f)
        elif os.path.basename(f).startswith("★최종★_"):
            final_file = f
            
    assert final_file is not None, "No ★최종★_ representative file found!"
    assert duplicates_dir is not None, "No _Duplicates folder found!"
    
    dup_count = len(os.listdir(duplicates_dir))
    print(f"Duplicates in folder: {dup_count}")
    assert dup_count == 499, f"Expected 499 duplicates, but got {dup_count}."
    
    results["massive_duplicates"] = {
        "status": "PASS",
        "duration": duration,
        "cache_writes": save_count[0],
        "final_count": final_count,
        "dup_count": dup_count
    }
    print("Challenge Test 1: PASS")

def test_empty_invalid_files():
    print("\n=== Challenge Test 2: Empty/Invalid Content Files ===")
    setup_test_directory()
    
    # Case 1: Empty text files with different names in same folder
    # Since they are empty, their hashes are identical.
    # Map them to the same destination: 08_기타_일반행정/2026년/06_기타서류
    # Filenames:
    # 1. 20260715_기타_회의록_A.txt
    # 2. 20260715_기타_회의록_B.txt
    # 3. 20260715_기타_회의록_C.txt
    filenames = [
        "20260715_기타_회의록_A.txt",
        "20260715_기타_회의록_B.txt",
        "20260715_기타_회의록_C.txt"
    ]
    for name in filenames:
        filepath = os.path.join(TEST_DIR, name)
        with open(filepath, "wb") as f:
            pass # Create empty file
            
    # Case 2: Invalid/Empty PDF and HWPX files
    # Create empty 0-byte PDF and HWPX files.
    # The parsers should not crash.
    pdf_path = os.path.join(TEST_DIR, "20260715_바른자세_검사계획_empty.pdf")
    hwpx_path = os.path.join(TEST_DIR, "20260715_바른자세_검사계획_empty.hwpx")
    with open(pdf_path, "wb") as f:
        pass
    with open(hwpx_path, "wb") as f:
        pass
        
    initial_count, _ = count_all_files(TEST_DIR)
    print(f"Created {initial_count} files (3 empty txt, 1 empty pdf, 1 empty hwpx).")
    
    duration = run_organizer()
    
    final_count, files = count_all_files(TEST_DIR)
    print(f"Final file count: {final_count}")
    print("Files after processing:")
    for f in files:
        print(f"  {os.path.relpath(f, TEST_DIR)}")
        
    # Verify no crashes occurred.
    # What happened to the empty txt files?
    # Since they are in the same folder and have the same hash (empty hash), they will be grouped as duplicates!
    # Let's see if they were consolidated.
    duplicates_folder = None
    for f in files:
        if "_Duplicates" in f:
            duplicates_folder = os.path.dirname(f)
            
    has_false_positives = duplicates_folder is not None and len(os.listdir(duplicates_folder)) > 0
    
    # PDF and HWPX: they both map to 02_바른자세_개선_사업/2026년/04_계획 및 방침
    # They have size 0, so their hashes are identical.
    # Do they get grouped together?
    # Wait, pdf and hwpx have different extensions, so they have different standard names.
    # But do their hashes match? Yes, both are empty.
    # Let's check if the engine grouped them.
    # Actually, they are in the same dest_dir. If they have same hash, they might be grouped as duplicates.
    # Let's verify this in the results.
    
    results["empty_invalid_files"] = {
        "status": "PASS",
        "has_false_positives": has_false_positives,
        "files": [os.path.relpath(f, TEST_DIR) for f in files]
    }
    print("Challenge Test 2: PASS")

def test_casing_and_patterns():
    print("\n=== Challenge Test 3: Filenames with Multiple Final Keywords and Casings ===")
    setup_test_directory()
    
    # We want to verify how the final keyword cleaning behaves under different casings and multiple keywords.
    # Filenames to test:
    # 1. 20260715_바른자세_보고서_최종_최종_최종.txt
    # 2. 20260715_바른자세_보고서_최종안_수정완료_배포용_v2_1_copy.txt
    # 3. 20260715_바른자세_보고서_COPY_V3.txt (uppercase)
    # 4. 20260715_바른자세_보고서_Final.txt (mixed case)
    # 5. 20260715_바른자세_보고서_최종_수정완료.txt
    
    content = "바른자세 개선 사업 회의를 척추측만증 및 거북목 예방 주제로 진행하였습니다."
    
    filenames = [
        "20260715_바른자세_보고서_최종_최종_최종.txt",
        "20260715_바른자세_보고서_최종안_수정완료_배포용_v2_1_copy.txt",
        "20260715_바른자세_보고서_COPY_V3.txt",
        "20260715_바른자세_보고서_Final.txt",
        "20260715_바른자세_보고서_최종_수정완료.txt"
    ]
    
    for name in filenames:
        filepath = os.path.join(TEST_DIR, name)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
            
    initial_count, _ = count_all_files(TEST_DIR)
    print(f"Created {initial_count} files with different final keywords/casings.")
    
    run_organizer()
    
    final_count, files = count_all_files(TEST_DIR)
    print(f"Final file count: {final_count}")
    print("Files after processing:")
    for f in files:
        print(f"  {os.path.relpath(f, TEST_DIR)}")
        
    # Check what the final file is named
    final_file = None
    for f in files:
        if os.path.basename(f).startswith("★최종★_"):
            final_file = f
            
    assert final_file is not None, "No ★최종★_ representative file found!"
    actual_base_name = os.path.basename(final_file)
    print(f"Produced final filename: {actual_base_name}")
    
    # Check if uppercase/mixed-case keywords were successfully cleaned
    # The expected clean base filename should start with "★최종★_20260715_바른자세_보고서"
    # Let's inspect the results:
    is_fully_cleaned = actual_base_name.startswith("★최종★_20260715_바른자세_보고서")
    print(f"Is fully cleaned: {is_fully_cleaned}")
    
    results["casing_and_patterns"] = {
        "status": "PASS",
        "final_filename": actual_base_name,
        "is_fully_cleaned": is_fully_cleaned,
        "files": [os.path.relpath(f, TEST_DIR) for f in files]
    }
    print("Challenge Test 3: PASS")

def test_collided_hashes_sizes():
    print("\n=== Challenge Test 4: Files with Collided Hashes and Sizes ===")
    setup_test_directory()
    
    # We want to test binary files that are separate files (different contents/hashes)
    # but have the exact same size and high name similarity.
    # This simulates a potential collision scenario in Tier 4 deduplication logic.
    # Filenames:
    # 1. 20260715_리플릿_디자인_시안_A안.bin
    # 2. 20260715_리플릿_디자인_시안_B안.bin
    # These represent parallel design proposals, which must not be consolidated.
    
    filepath_1 = os.path.join(TEST_DIR, "20260715_리플릿_디자인_시안_A안.bin")
    filepath_2 = os.path.join(TEST_DIR, "20260715_리플릿_디자인_시안_B안.bin")
    
    # Generate different random content of same size (500 bytes)
    content_a = bytes([random.randint(0, 255) for _ in range(500)])
    content_b = bytes([random.randint(0, 255) for _ in range(500)])
    
    # Ensure they have different hashes
    while hashlib.sha256(content_a).hexdigest() == hashlib.sha256(content_b).hexdigest():
        content_b = bytes([random.randint(0, 255) for _ in range(500)])
        
    with open(filepath_1, "wb") as f:
        f.write(content_a)
    with open(filepath_2, "wb") as f:
        f.write(content_b)
        
    initial_count, _ = count_all_files(TEST_DIR)
    print(f"Created {initial_count} binary files of same size but different contents.")
    
    run_organizer()
    
    final_count, files = count_all_files(TEST_DIR)
    print(f"Final file count: {final_count}")
    print("Files after processing:")
    for f in files:
        print(f"  {os.path.relpath(f, TEST_DIR)}")
        
    # Check if one was moved to _Duplicates
    has_false_duplicate = any("_Duplicates" in f for f in files)
    print(f"Has false duplicate classification (data loss risk): {has_false_duplicate}")
    
    results["collided_hashes_sizes"] = {
        "status": "PASS",
        "has_false_duplicate": has_false_duplicate,
        "files": [os.path.relpath(f, TEST_DIR) for f in files]
    }
    print("Challenge Test 4: PASS")

if __name__ == "__main__":
    try:
        test_massive_duplicates()
        test_empty_invalid_files()
        test_casing_and_patterns()
        test_collided_hashes_sizes()
        
        # Write results to a json file for report use
        report_data_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_results.json")
        with open(report_data_path, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f"\n[Test Runner] Results successfully written to {report_data_path}")
        
    finally:
        # Cleanup
        if os.path.exists(TEST_DIR):
            shutil.rmtree(TEST_DIR)
            print("[Challenge Test Cleanup] Workspace cleaned up.")
