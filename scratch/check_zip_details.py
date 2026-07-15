import zipfile
import sys

def check_zip():
    sys.stdout.reconfigure(encoding='utf-8')
    orig_path = "d:\\Desktop\\서울체력장 강남센터, 체력 측정 장비 구매 계획.hwpx.bak"
    gen_path = "d:\\Desktop\\서울체력장 강남센터 장비구매계획서_최종_완성.hwpx"
    
    try:
        print("--- ORIGINAL ZIP DETAILS ---")
        with zipfile.ZipFile(orig_path, 'r') as z:
            for info in z.infolist():
                print(f"File: {info.filename}, Method: {info.compress_type}, Size: {info.file_size}")
                
        print("\n--- GENERATED ZIP DETAILS ---")
        with zipfile.ZipFile(gen_path, 'r') as z:
            for info in z.infolist():
                print(f"File: {info.filename}, Method: {info.compress_type}, Size: {info.file_size}")
                
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    check_zip()
