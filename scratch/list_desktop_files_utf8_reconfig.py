import os
import sys

# Reconfigure stdout to write utf-8
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

desktop_dir = r"D:\Desktop"
files = os.listdir(desktop_dir)
for f in files:
    if any(kwd in f for kwd in ["AI", "스포츠", "보건소", "트레이닝", "조감도", "현판"]):
        path = os.path.join(desktop_dir, f)
        print(f"File: {f} | Size: {os.path.getsize(path)} | ModTime: {os.path.getmtime(path)}")
