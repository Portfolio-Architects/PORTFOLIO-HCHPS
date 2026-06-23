import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

desktop_dir = r"d:\Desktop"
skip_dirs = ['.git', 'node_modules', '.next', 'PORTFOLIO', 'AppData']

print("Listing all files in all directories on d:\\Desktop (excluding PORTFOLIO)...")

for root, dirs, files in os.walk(desktop_dir):
    dirs[:] = [d for d in dirs if d not in skip_dirs]
    for file in files:
        # Check if it has PDF, CSV, or matches keywords
        path = os.path.join(root, file)
        # Just print everything
        print(f"  {path} ({os.path.getsize(path)} bytes)")
