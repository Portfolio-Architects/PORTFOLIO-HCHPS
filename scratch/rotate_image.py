# -*- coding: utf-8 -*-
from PIL import Image
import os

img_path = r"d:\Desktop\AI 스포츠_메디컬_트레이닝 센터_탑다운뷰_정면구도_1920x1080.png"
dst_path = r"d:\Desktop\AI 스포츠_메디컬_트레이닝 센터_탑다운뷰_정면구도_90도회전_1080x1920.png"

try:
    if os.path.exists(img_path):
        img = Image.open(img_path)
        # Rotate 90 degrees clockwise
        rotated_img = img.transpose(Image.ROTATE_270)
        rotated_img.save(dst_path)
        print(f"Successfully rotated image 90 degrees clockwise and saved to {dst_path}")
    else:
        print("Source image not found.")
except Exception as e:
    print(f"Error rotating image: {e}")
