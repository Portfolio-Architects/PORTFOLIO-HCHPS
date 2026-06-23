import os

desktop_dir = r"D:\Desktop"
files = os.listdir(desktop_dir)
for f in files:
    if any(kwd in f for kwd in ["AI 스포츠", "보건소", "트레이닝", "조감도"]):
        path = os.path.join(desktop_dir, f)
        print(f"File: {f.encode('utf-8').decode('utf-8')} | Size: {os.path.getsize(path)} | ModTime: {os.path.getmtime(path)}")
