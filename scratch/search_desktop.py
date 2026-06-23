import os
import zipfile
import re
import fitz  # PyMuPDF

desktop_dir = r"d:\Desktop"
keywords = ["메디스포츠", "체력장", "HCHPS", "Medi-Sports", "MediSports", "인증센터", "체력인증", "건강", "수호천사", "헬스체크업"]
output_path = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\search_results.txt"

results = []

def search_text(text, filename):
    for kw in keywords:
        # Case insensitive find
        matches = list(re.finditer(re.escape(kw), text, re.IGNORECASE))
        if matches:
            results.append(f"[FOUND] '{kw}' in file: {filename} ({len(matches)} times)")
            for match in matches[:3]:  # Limit snippets to 3 per file
                start = max(0, match.start() - 150)
                end = min(len(text), match.end() + 150)
                snippet = text[start:end].replace('\n', ' ').strip()
                results.append(f"  Snippet: ... {snippet} ...")
            results.append("-" * 60)

for filename in os.listdir(desktop_dir):
    filepath = os.path.join(desktop_dir, filename)
    if not os.path.isfile(filepath):
        continue
        
    ext = os.path.splitext(filename)[1].lower()
    
    if ext == '.hwpx':
        try:
            with zipfile.ZipFile(filepath, 'r') as z:
                if "Preview/PrvText.txt" in z.namelist():
                    text = z.read("Preview/PrvText.txt").decode('utf-8', errors='ignore')
                    search_text(text, filename)
        except Exception as e:
            results.append(f"[ERROR] Reading HWPX {filename}: {e}")
            
    elif ext == '.txt':
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()
                search_text(text, filename)
        except Exception as e:
            results.append(f"[ERROR] Reading TXT {filename}: {e}")
            
    elif ext == '.pdf':
        try:
            doc = fitz.open(filepath)
            text_list = []
            for page in doc:
                text_list.append(page.get_text())
            text = "\n".join(text_list)
            search_text(text, filename)
        except Exception as e:
            results.append(f"[ERROR] Reading PDF {filename}: {e}")

with open(output_path, 'w', encoding='utf-8') as f:
    f.write("\n".join(results))

print(f"Search completed. Results saved to {output_path}")
