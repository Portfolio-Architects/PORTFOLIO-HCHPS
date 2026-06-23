import fitz

pdf_path = r"d:\Desktop\VITAL_Scan\20260126_건강 뜀, 건강관리교육 지원 사업 계획.pdf"
doc = fitz.open(pdf_path)

out_path = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\parsed_jump_edu.txt"
with open(out_path, "w", encoding="utf-8") as f:
    f.write(f"Total pages: {len(doc)}\n")
    for idx, page in enumerate(doc):
        f.write(f"\n--- Page {idx + 1} ---\n")
        text = page.get_text()
        f.write(text)
print("Parsing complete.")
