import os
from PIL import Image

path_modern = r"D:\Desktop\AI 스포츠_메디컬_트레이닝 센터_45도 사선구도_현판_모던_1920x1080.png"
path_prev = r"D:\Desktop\AI 스포츠_메디컬_트레이닝 센터_45도 사선구도_통사각_실사진_현판_1920x1080.png"

if os.path.exists(path_modern) and os.path.exists(path_prev):
    img_mod = Image.open(path_modern).convert("RGB")
    img_prev = Image.open(path_prev).convert("RGB")
    
    print("Mod size:", img_mod.size)
    print("Prev size:", img_prev.size)
    
    # Compare along x=200, y=0 to 300
    print("Comparing pixels along x=200:")
    for y in range(0, 301, 30):
        p_mod = img_mod.getpixel((200, y))
        p_prev = img_prev.getpixel((200, y))
        print(f"y={y:3d} | Modern: {p_mod} | Prev: {p_prev} | Diff: {sum(abs(p_mod[i]-p_prev[i]) for i in range(3))}")
else:
    print("Files not found")
