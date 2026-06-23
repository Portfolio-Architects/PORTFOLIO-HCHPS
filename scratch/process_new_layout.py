import os
from PIL import Image

src_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_swapped_layout_1781241447914.png"

if os.path.exists(src_path):
    with Image.open(src_path) as im:
        print(f"Generated Image Size: {im.size}, format: {im.format}")
else:
    print("Image not found")
