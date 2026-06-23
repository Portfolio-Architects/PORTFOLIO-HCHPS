import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
global_scratch = r"C:\Users\user\.gemini\antigravity\scratch"

print(f"Searching global scratch files in {global_scratch}...")

keywords = ['체질량지수', 'CVA', '머리척추각', '수축기', '이완기', '체형불균형', '검진결과']

if os.path.exists(global_scratch):
    for filename in os.listdir(global_scratch):
        filepath = os.path.join(global_scratch, filename)
        if not os.path.isfile(filepath):
            continue
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                found = [kw for kw in keywords if kw in content]
                if found:
                    print(f"Found in {filename}: {found}")
                    # Print matching line or snippet
                    for line in content.split('\n'):
                        if any(kw in line for kw in keywords):
                            print("  Line:", line.strip())
        except Exception as e:
            print(f"Error reading {filename}: {e}")
else:
    print("Global scratch directory does not exist.")
