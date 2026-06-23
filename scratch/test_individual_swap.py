import os
from PIL import Image

src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"
if os.path.exists(src_image_path):
    img = Image.open(src_image_path)
    
    # Crop regions (1024x1024 space)
    # Treadmill region: x from 180 to 520, y from 480 to 950
    treadmill_box = (180, 480, 520, 950)
    treadmill_crop = img.crop(treadmill_box)
    treadmill_flipped = treadmill_crop.transpose(Image.FLIP_LEFT_RIGHT)
    
    # Posture grid region: x from 550 to 980, y from 480 to 950
    grid_box = (550, 480, 980, 950)
    grid_crop = img.crop(grid_box)
    grid_flipped = grid_crop.transpose(Image.FLIP_LEFT_RIGHT)
    
    # Paste swapped and flipped
    img_swapped = img.copy()
    
    # Posture grid goes to the treadmill's position (x from 180 to 610? No, let's map the centers)
    # The target positions are symmetric.
    # Treadmill center x was (180 + 520)/2 = 350. New center on the right should be around (1024 - 350) = 674.
    # Grid center x was (550 + 980)/2 = 765. New center on the left should be around (1024 - 765) = 259.
    
    # So we can paste them at symmetric positions!
    # Left box goes to right: x1 = 1024 - 520 = 504, x2 = 1024 - 180 = 844.
    # Right box goes to left: x1 = 1024 - 980 = 44, x2 = 1024 - 550 = 474.
    
    # Let's paste the flipped grid on the left
    img_swapped.paste(grid_flipped, (44, 480))
    
    # Let's paste the flipped treadmill on the right
    img_swapped.paste(treadmill_flipped, (504, 480))
    
    img_swapped.save("scratch_swapped_individual.png")
    print("Individual swap done")
else:
    print("Source not found")
