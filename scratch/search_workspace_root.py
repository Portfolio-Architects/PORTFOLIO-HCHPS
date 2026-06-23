import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
workspace_dir = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL"

print("Searching workspace root files for clinical terms...")

keywords = ['체질량지수', 'CVA', '머리척추각', '수축기', '이완기', '체형불균형', '검진결과설명서']

for file in os.listdir(workspace_dir):
    filepath = os.path.join(workspace_dir, file)
    if not os.path.isfile(filepath):
        continue
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            found = [kw for kw in keywords if kw.lower() in content.lower()]
            if found:
                print(f"Match found in workspace file: {file} | KWs: {found}")
                lines = content.split('\n')
                count = 0
                for idx, line in enumerate(lines):
                    if any(kw.lower() in line.lower() for kw in keywords):
                        print(f"  Line {idx+1}: {line.strip()[:200]}")
                        count += 1
                        if count > 5:
                            print("  ... and more")
                            break
                print("-" * 80)
    except Exception as e:
        print(f"Error reading {file}: {e}")
