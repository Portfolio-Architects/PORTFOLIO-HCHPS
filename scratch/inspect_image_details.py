import os
from PIL import Image

desktop_dir = r"D:\Desktop"
images = [
    "AI 스포츠_메디컬_트레이닝 센터_45도 사선구도_1920x1080.png",
    "AI 스포츠_메디컬_트레이닝 센터_내부투시도_최종_1920x1080.png",
    "보건소 4층 도면_AI 메디헬스 센터.png"
]

for img_name in images:
    path = os.path.join(desktop_dir, img_name)
    if os.path.exists(path):
        with Image.open(path) as im:
            print(f"{img_name}: size={im.size}, format={im.format}")
    else:
        print(f"{img_name} does not exist")
