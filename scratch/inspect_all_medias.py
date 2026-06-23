import os
from PIL import Image

brain_dir = r"C:\Users\user\.gemini\antigravity\brain"
for folder in os.listdir(brain_dir):
    folder_path = os.path.join(brain_dir, folder)
    if os.path.isdir(folder_path):
        for f in os.listdir(folder_path):
            if f.startswith("media__") and f.endswith((".jpg", ".png")):
                f_path = os.path.join(folder_path, f)
                try:
                    img = Image.open(f_path)
                    print(f"Folder {folder[:8]} | File: {f} | Size: {img.size}")
                except Exception as e:
                    print(f"Error {f}: {e}")
