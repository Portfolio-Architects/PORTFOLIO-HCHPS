import os
import sys
import fitz
import json

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

scan_dir = r"d:\Desktop\VITAL_Scan"
keywords = ["헬스체크업", "체크업", "건강검진", "검진", "보건소 헬스체크업"]

results = {}

for filename in os.listdir(scan_dir):
    if not filename.endswith(".pdf"):
        continue
    filepath = os.path.join(scan_dir, filename)
    try:
        doc = fitz.open(filepath)
        for i, page in enumerate(doc):
            text = page.get_text()
            lines = text.split("\n")
            for line_idx, line in enumerate(lines):
                matched = [kw for kw in keywords if kw in line]
                if matched:
                    # Capture surrounding context
                    start = max(0, line_idx - 2)
                    end = min(len(lines), line_idx + 3)
                    context = "\n".join(lines[start:end])
                    if filename not in results:
                        results[filename] = []
                    results[filename].append({
                        "page": i + 1,
                        "line": line_idx + 1,
                        "matched_keywords": matched,
                        "text_line": line,
                        "context": context
                    })
    except Exception as e:
        print(f"Error reading {filename}: {e}")

print(json.dumps(results, ensure_ascii=False, indent=2))
