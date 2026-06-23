import os
import sys
import fitz

sys.stdout.reconfigure(encoding='utf-8')
keywords = ['체질량지수', 'CVA', '머리척추각', '수축기', '이완기']

print("Searching all PDF files under d:\\Desktop for clinical terms...")

for root, dirs, files in os.walk(r"d:\Desktop"):
    # Skip some heavy folders if needed, but Desktop is small
    if ".git" in root or ".next" in root or "node_modules" in root:
        continue
    for file in files:
        if file.lower().endswith(".pdf"):
            pdf_path = os.path.join(root, file)
            try:
                doc = fitz.open(pdf_path)
                for page_num in range(len(doc)):
                    text = doc[page_num].get_text()
                    found = [kw for kw in keywords if kw in text]
                    if found:
                        print(f"Match found in PDF: {pdf_path} (Page {page_num+1}) | KWs: {found}")
                        # Print surrounding text
                        lines = text.split('\n')
                        for line in lines:
                            if any(kw in line for kw in keywords):
                                print("  Line:", line.strip())
            except Exception as e:
                # print(f"Error reading {pdf_path}: {e}")
                pass
