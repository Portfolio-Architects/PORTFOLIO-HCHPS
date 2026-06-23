import os

desktop_dir = r"D:\Desktop"
files = os.listdir(desktop_dir)
for f in files:
    if "AI 스포츠" in f or "보건소" in f or "트레이닝" in f:
        path = os.path.join(desktop_dir, f)
        print(f, os.path.getsize(path), os.path.getmtime(path))
