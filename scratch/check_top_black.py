import os
from PIL import Image

path = r"D:\Desktop\AI 스포츠_메디컬_트레이닝 센터_45도 사선구도_현판_모던_1920x1080.png"
if os.path.exists(path):
    img = Image.open(path)
    # Check top rows (row 0 to 10) to see if they are black (0, 0, 0)
    pixels = list(img.crop((0, 0, img.width, 10)).getdata())
    non_black = [p for p in pixels if sum(p[:3]) > 10]
    print(f"Total pixels in top 10 rows: {len(pixels)}")
    print(f"Non-black pixels in top 10 rows: {len(non_black)}")
else:
    print("File not found")
