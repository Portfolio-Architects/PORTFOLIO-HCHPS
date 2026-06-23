import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

desktop_dir = r"D:\Desktop"
files = os.listdir(desktop_dir)
for f in files:
    if f.endswith(".png") or f.endswith(".jpg"):
        path = os.path.join(desktop_dir, f)
        print(f"File: {f} | Size: {os.path.getsize(path)}")
