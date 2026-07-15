import fitz
import sys

pdf_path = r"d:\Desktop\체력측정장비 규격서 및 참고사진 첨부합니다\KIOSK 기초체력평가시스템 6종 규격서_강남구보건소.pdf"
output_path = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\kiosk_specs_raw.txt"

try:
    doc = fitz.open(pdf_path)
    text = []
    for i, page in enumerate(doc):
        text.append(f"--- Page {i+1} ---")
        text.append(page.get_text())
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(text))
    print("Success: PDF parsed successfully.")
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
