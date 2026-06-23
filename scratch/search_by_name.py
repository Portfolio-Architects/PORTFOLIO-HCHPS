import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

targets = ['검진결과설명서.pdf', '체형불균형.csv']
skip_dirs = ['.git', 'node_modules', '.next', 'AppData', 'Windows', 'Program Files', 'Program Files (x86)', 'System Volume Information']

print("Searching all drives for exact target files...")
for drive in ['c:\\', 'd:\\']:
    if not os.path.exists(drive):
        continue
    print(f"Searching drive: {drive}...")
    for root, dirs, files in os.walk(drive):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for file in files:
            if file.lower() in [t.lower() for t in targets] or '검진결과설명서' in file:
                print(f"  [FOUND] {os.path.join(root, file)} ({os.path.getsize(os.path.join(root, file))} bytes)")
