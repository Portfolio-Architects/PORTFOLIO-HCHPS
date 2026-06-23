import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
drives = ['c:\\', 'd:\\', 'e:\\', 'f:\\', 'g:\\']

print("Searching all drives for target files...")

keywords = ['검진결과', '체형불균형', '설명서']

for drive in drives:
    if not os.path.exists(drive):
        continue
    print(f"Searching drive: {drive}...")
    for root, dirs, files in os.walk(drive):
        # Skip system directories and heavy project folders to speed up
        skip = False
        for path_part in ['node_modules', '.next', '.git', 'AppData', 'Windows', 'Program Files', 'System Volume Information']:
            if path_part in root:
                skip = True
                break
        if skip:
            continue
        for file in files:
            name_lower = file.lower()
            if any(kw in name_lower for kw in keywords):
                filepath = os.path.join(root, file)
                print(f"  [MATCH] {filepath}")
