import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

desktop_dir = r"d:\Desktop"
print("Files in d:\\Desktop:")
for f in os.listdir(desktop_dir):
    filepath = os.path.join(desktop_dir, f)
    if os.path.isfile(filepath):
        print(f"  [FILE] {f} - {os.path.getsize(filepath)} bytes")
    elif os.path.isdir(filepath):
        print(f"  [DIR] {f}")
