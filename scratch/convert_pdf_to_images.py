import fitz
import os

pdf_path = r"d:\Desktop\체력측정장비 규격서 및 참고사진 첨부합니다\KIOSK 기초체력평가시스템 6종 규격서_강남구보건소.pdf"
output_dir = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\kiosk_pages"

os.makedirs(output_dir, exist_ok=True)

try:
    doc = fitz.open(pdf_path)
    print(f"Total Pages: {len(doc)}")
    for i, page in enumerate(doc):
        # 300 DPI로 렌더링하기 위해 zoom을 300/72 = 4.166으로 설정
        zoom = 4.166
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        output_file = os.path.join(output_dir, f"page_{i+1:02d}.png")
        pix.save(output_file)
        print(f"Saved: {output_file}")
except Exception as e:
    print(f"Error: {e}")
