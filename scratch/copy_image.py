import shutil
import os

src = r"C:\Users\user\.gemini\antigravity\brain\48d909ea-803a-4164-a19f-b53efcee36dc\medi_sports_widescreen_1781146638802.png"
dst = r"d:\Desktop\AI 스포츠_메디컬_트레이닝 센터_1920x1024_조감도.png"

try:
    if os.path.exists(src):
        shutil.copy(src, dst)
        print(f"Successfully copied image to {dst}")
    else:
        print("Source image file not found.")
except Exception as e:
    print(f"Error copying file: {e}")
