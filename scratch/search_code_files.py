import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
src_dir = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\src"

print(f"Searching {src_dir} recursively for clinical keywords...")

keywords = ['체형불균형', '검진결과', 'cva', '머리척추각']

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.ts', '.tsx', '.js', '.jsx', '.json')):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    found = [kw for kw in keywords if kw.lower() in content.lower()]
                    if found:
                        print(f"Match found in code: {filepath} | KWs: {found}")
                        # Print matching lines
                        for line in content.split('\n'):
                            if any(kw.lower() in line.lower() for kw in keywords):
                                print("  Line:", line.strip())
            except Exception as e:
                pass
