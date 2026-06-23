import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

search_dirs = [
    r"d:\Desktop",
    r"d:\Desktop\PORTFOLIO",
    r"C:\Users\user\.gemini",
    r"C:\Users\user\Downloads",
    r"C:\Users\user\Desktop"
]

keywords = ['검진결과', '체형불균형', '설명서', 'csv', 'pdf']

print("Starting fast search...")

for sdir in search_dirs:
    if not os.path.exists(sdir):
        continue
    print(f"Searching {sdir}...")
    for root, dirs, files in os.walk(sdir):
        # Skip node_modules, .git, .next, etc.
        skip = False
        for part in ['node_modules', '.git', '.next', 'AppData']:
            if part in root:
                skip = True
                break
        if skip:
            continue
        for file in files:
            name_lower = file.lower()
            if '검진결과' in name_lower or '체형불균형' in name_lower or '설명서' in name_lower:
                print(f"  [MATCH] {os.path.join(root, file)}")
