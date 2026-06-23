import os
import sys
import fitz

sys.stdout.reconfigure(encoding='utf-8')
scan_dirs = [r"d:\Desktop\VITAL_Scan", r"d:\Desktop"]

print("Searching all PDFs in VITAL_Scan and Desktop for target terms...")

keywords = ['김광숙', '69.85', '127/82', '127', '48도', '48', '10.2', '24.9', '체형불균형']

for sdir in scan_dirs:
    if not os.path.exists(sdir):
        continue
    for file in os.listdir(sdir):
        if file.lower().endswith('.pdf'):
            path = os.path.join(sdir, file)

        try:
            doc = fitz.open(path)
            for i, page in enumerate(doc):
                text = page.get_text()
                found = [kw for kw in keywords if kw in text]
                if found:
                    print(f"Match in {file} (Page {i+1}) | Matches: {found}")
                    # Print matching lines
                    for line in text.split('\n'):
                        if any(kw in line for kw in found):
                            print("  Line:", line.strip())
        except Exception as e:
            pass
