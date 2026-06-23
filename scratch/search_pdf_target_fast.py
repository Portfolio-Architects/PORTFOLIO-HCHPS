import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

keywords = ['검진결과', '설명서', '결과설명서', '체형불균형']
skip_dirs = ['.git', 'node_modules', '.next', 'AppData']

print("Searching d:\\Desktop recursively (excluding skip dirs) for target files...")
for root, dirs, files in os.walk(r"d:\Desktop"):
    # Modify dirs in-place to skip unwanted directories
    dirs[:] = [d for d in dirs if d not in skip_dirs]
    for file in files:
        if any(kw in file.lower() for kw in keywords) or file.endswith('.csv') or file.endswith('.pdf'):
            # Print file path if it matches the name keywords or is pdf/csv
            if any(kw in file.lower() for kw in keywords):
                print(f"  [FOUND] {os.path.join(root, file)}")
            elif '검진' in file or '설명서' in file or '체형' in file:
                print(f"  [FOUND POTENTIAL] {os.path.join(root, file)}")
