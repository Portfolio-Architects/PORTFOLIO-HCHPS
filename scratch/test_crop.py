import os
from PIL import Image

src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"
if os.path.exists(src_image_path):
    img = Image.open(src_image_path)
    
    # Crop treadmill area
    treadmill_box = (250, 480, 500, 800) # left, top, right, bottom
    treadmill_crop = img.crop(treadmill_box)
    treadmill_crop.save("scratch_treadmill.png")
    
    # Crop posture grid area
    grid_box = (620, 480, 920, 800)
    grid_crop = img.crop(grid_box)
    grid_crop.save("scratch_grid.png")
    print("Cropped successfully")
else:
    print("Source not found")
