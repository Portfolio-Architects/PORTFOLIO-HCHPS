import os
from PIL import Image, ImageDraw, ImageFilter

src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"

if os.path.exists(src_image_path):
    img = Image.open(src_image_path).convert("RGBA")
    
    # 1. Crop regions WITHOUT flipping
    # Treadmill (left)
    treadmill_box = (160, 480, 520, 950)
    treadmill_crop = img.crop(treadmill_box)
    
    # Grid screen (right)
    grid_box = (550, 480, 960, 950)
    grid_crop = img.crop(grid_box)
    
    # 2. Create feathered masks
    def create_feathered_mask(size, feather_pixels=25):
        mask = Image.new("L", size, 255)
        draw = ImageDraw.Draw(mask)
        for i in range(feather_pixels):
            alpha = int(255 * (i / feather_pixels))
            draw.rectangle(
                [i, i, size[0] - 1 - i, size[1] - 1 - i], 
                outline=alpha, 
                width=1
            )
        return mask.filter(ImageFilter.GaussianBlur(3))
        
    treadmill_mask = create_feathered_mask(treadmill_crop.size, feather_pixels=25)
    grid_mask = create_feathered_mask(grid_crop.size, feather_pixels=25)
    
    # 3. Paste swapped but UNFLIPPED
    img_swapped = img.copy()
    
    # Grid goes to left
    img_swapped.paste(grid_crop, (135, 480), grid_mask)
    # Treadmill goes to right
    img_swapped.paste(treadmill_crop, (575, 480), treadmill_mask)
    
    img_swapped.convert("RGB").save("scratch_swapped_noflip.png")
    print("No-flip swap test done!")
else:
    print("Source not found")
