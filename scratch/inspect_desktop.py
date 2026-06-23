import os
import sys

desktop_dir = r"D:\Desktop"
files = os.listdir(desktop_dir)
sys.stdout.reconfigure(encoding='utf-8')
for f in files:
    if f.endswith(('.png', '.py', '.jpg')):
        print(f)
