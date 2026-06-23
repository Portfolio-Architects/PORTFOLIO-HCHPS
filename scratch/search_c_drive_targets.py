import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

keywords = ['검진결과', '설명서', '결과설명서', '체형불균형']
skip_dirs = ['.git', 'node_modules', '.next', 'AppData', 'Windows', 'Program Files', 'Program Files (x86)', 'System Volume Information']

search_roots = [
    r"C:\Users\user",
    r"D:\Desktop"
]

print("Searching for targets in C:\\Users\\user and D:\\Desktop...")
for sroot in search_roots:
    if not os.path.exists(sroot):
        continue
    print(f"Searching {sroot}...")
    for root, dirs, files in os.walk(sroot):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for file in files:
            name_lower = file.lower()
            if any(kw in name_lower for kw in keywords) or '체형불균형' in name_lower or '검진결과' in name_lower:
                print(f"  [FOUND] {os.path.join(root, file)}")
