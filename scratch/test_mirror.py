import os
from PIL import Image

src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"
if os.path.exists(src_image_path):
    img = Image.open(src_image_path)
    
    # Define bottom area to mirror
    # We want to keep the top part (counseling desks on left, AI smart gym on right) intact
    # Top part is roughly y from 0 to 450
    # Bottom part is y from 450 to 1024
    w, h = img.size
    bottom_crop = img.crop((0, 450, w, 1024))
    
    # Flip horizontally
    bottom_flipped = bottom_crop.transpose(Image.FLIP_LEFT_RIGHT)
    
    # Paste back
    img_swapped = img.copy()
    img_swapped.paste(bottom_flipped, (0, 450))
    img_swapped.save("scratch_swapped_mirrored.png")
    print("Mirror swap done")
else:
    print("Source not found")
