import os
from PIL import Image

src_image_path = r"C:\Users\user\.gemini\antigravity\brain\c36768e1-c5d8-4c57-a408-37cc121ba020\medi_sports_equipment_swapped_v2_1781248824218.png"
if os.path.exists(src_image_path):
    img = Image.open(src_image_path)
    print(f"Size: {img.size}")
else:
    print("Not found")
