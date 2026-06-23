import fitz
import sys

sys.stdout.reconfigure(encoding='utf-8')
pdf_path = r"d:\Desktop\view.pdf"

try:
    doc = fitz.open(pdf_path)
    print(f"view.pdf page count: {len(doc)}")
    for i in range(len(doc)):
        text = doc[i].get_text()
        print(f"--- Page {i+1} ---")
        print(text[:1000])
        print("=" * 60)
except Exception as e:
    print("Error:", e)
