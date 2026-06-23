import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

print("All PDF files on D:")
for root, dirs, files in os.walk(r"d:\Desktop"):
    dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules', '.next', 'AppData']]
    for file in files:
        if file.lower().endswith('.pdf'):
            print(f"  [PDF] {os.path.join(root, file)} ({os.path.getsize(os.path.join(root, file))} bytes)")
