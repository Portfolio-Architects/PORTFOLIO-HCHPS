import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

keywords = ['검진결과', '설명서', '결과설명서', '체형불균형']

# Search recursively in d:\Desktop
print("Searching d:\\Desktop recursively for target files...")
for root, dirs, files in os.walk(r"d:\Desktop"):
    for file in files:
        if any(kw in file for kw in keywords):
            print(f"  [FOUND] {os.path.join(root, file)}")
