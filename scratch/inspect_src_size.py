import os
from PIL import Image

src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"
if os.path.exists(src_image_path):
    img = Image.open(src_image_path)
    print(f"Size: {img.size}")
else:
    print("Not found")
