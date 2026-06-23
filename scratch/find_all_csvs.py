import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

print("All CSV files on D:")
for root, dirs, files in os.walk(r"d:\Desktop"):
    dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules', '.next', 'AppData']]
    for file in files:
        if file.lower().endswith('.csv'):
            print(f"  [CSV] {os.path.join(root, file)} ({os.path.getsize(os.path.join(root, file))} bytes)")
