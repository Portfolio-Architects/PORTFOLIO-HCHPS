import zipfile
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
docx_path = r"D:\Desktop\헬스체크업 데이터 출력 양식.docx"

try:
    with zipfile.ZipFile(docx_path, 'r') as z:
        if "word/document.xml" in z.namelist():
            xml_content = z.read("word/document.xml").decode('utf-8', errors='ignore')
            # Strip XML tags to get raw text
            text = re.sub(r'<[^>]+>', ' ', xml_content)
            # Remove duplicate spaces
            text = re.sub(r'\s+', ' ', text).strip()
            print("=== DOCX Content ===")
            print(text[:2000])
            print("=== End of Snippet ===")
        else:
            print("word/document.xml not found in zip.")
except Exception as e:
    print("Error:", e)
