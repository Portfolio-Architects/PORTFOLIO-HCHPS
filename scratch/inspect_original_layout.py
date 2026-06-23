import os
from PIL import Image

src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"
if os.path.exists(src_image_path):
    with Image.open(src_image_path) as img:
        # Save a crop of the bottom-left and bottom-right to check where the treadmills are
        w, h = img.size
        # Bottom-left: (0, h//2, w//2, h)
        # Bottom-right: (w//2, h//2, w, h)
        img.crop((0, h//2, w//2, h)).save("scratch_bottom_left_orig.png")
        img.crop((w//2, h//2, w, h)).save("scratch_bottom_right_orig.png")
        print("Original image sizes and crops saved.")
else:
    print("Original image not found!")
