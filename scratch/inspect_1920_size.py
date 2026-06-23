import os
from PIL import Image

path1 = r"D:\Desktop\AI 스포츠_메디컬_트레이닝 센터_45도 사선구도_1920x1080.png"
if os.path.exists(path1):
    img = Image.open(path1)
    print(f"1920x1080 file size: {img.size}")
else:
    print("1920x1080 file not found")
