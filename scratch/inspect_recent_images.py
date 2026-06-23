import os
import sys

desktop_dir = r"D:\Desktop"
files = [os.path.join(desktop_dir, f) for f in os.listdir(desktop_dir) if f.endswith(('.png', '.jpg'))]
files.sort(key=lambda x: os.path.getmtime(x), reverse=True)

sys.stdout.reconfigure(encoding='utf-8')
for f in files[:10]:
    print(f"{f}: {os.path.getmtime(f)}")
