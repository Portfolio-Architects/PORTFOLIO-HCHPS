import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
scratch_dir = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch"

print("Searching scratch directory for clinical terms...")

keywords = ['체질량지수', 'CVA', '머리척추각', '수축기', '이완기', '체형불균형', '검진결과설명서']

for filename in os.listdir(scratch_dir):
    filepath = os.path.join(scratch_dir, filename)
    if not os.path.isfile(filepath):
        continue
    # Skip some files if needed, but let's check all
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            found = [kw for kw in keywords if kw in content]
            if found:
                print(f"Match found in scratch file: {filename} | KWs: {found}")
                lines = content.split('\n')
                count = 0
                for line in lines:
                    if any(kw in line for kw in keywords):
                        print(f"  Line {count+1}: {line.strip()[:200]}")
                        count += 1
                        if count > 10:
                            print("  ... and more")
                            break
                print("-" * 80)
    except Exception as e:
        # print(f"Error reading {filename}: {e}")
        pass
