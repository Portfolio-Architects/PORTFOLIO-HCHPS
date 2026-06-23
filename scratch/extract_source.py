import fitz
import zipfile

pdf_path = r"d:\Desktop\20260421_서울체력장(서울형 체력기준안).pdf"
hwpx_path = r"d:\Desktop\강남체력인증센터 추진계획.hwpx"
output_path = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\source_docs.txt"

output = []

# Extract PDF
try:
    output.append("=== 20260421_서울체력장(서울형 체력기준안).pdf ===")
    doc = fitz.open(pdf_path)
    for i, page in enumerate(doc):
        output.append(f"--- Page {i+1} ---")
        output.append(page.get_text())
except Exception as e:
    output.append(f"Error reading PDF: {e}")

# Extract HWPX
try:
    output.append("\n\n=== 강남체력인증센터 추진계획.hwpx ===")
    with zipfile.ZipFile(hwpx_path, 'r') as z:
        if "Preview/PrvText.txt" in z.namelist():
            text = z.read("Preview/PrvText.txt").decode('utf-8', errors='ignore')
            output.append(text)
        else:
            output.append("Preview/PrvText.txt not found in HWPX.")
except Exception as e:
    output.append(f"Error reading HWPX: {e}")

with open(output_path, 'w', encoding='utf-8') as f:
    f.write("\n".join(output))

print(f"Extracted source documents to {output_path}")
