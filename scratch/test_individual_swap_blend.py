import os
from PIL import Image, ImageDraw, ImageFilter

src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"

if os.path.exists(src_image_path):
    img = Image.open(src_image_path).convert("RGBA")
    
    # 1. Crop regions
    # Treadmill (left)
    treadmill_box = (160, 480, 520, 950)
    treadmill_crop = img.crop(treadmill_box)
    treadmill_flipped = treadmill_crop.transpose(Image.FLIP_LEFT_RIGHT)
    
    # Grid screen (right)
    grid_box = (550, 480, 960, 950)
    grid_crop = img.crop(grid_box)
    grid_flipped = grid_crop.transpose(Image.FLIP_LEFT_RIGHT)
    
    # 2. Create feathered masks for pasting
    def create_feathered_mask(size, feather_pixels=20):
        mask = Image.new("L", size, 255)
        draw = ImageDraw.Draw(mask)
        # draw black border to feather
        for i in range(feather_pixels):
            alpha = int(255 * (i / feather_pixels))
            draw.rectangle(
                [i, i, size[0] - 1 - i, size[1] - 1 - i], 
                outline=alpha, 
                width=1
            )
        # Smooth the mask slightly
        return mask.filter(ImageFilter.GaussianBlur(3))
        
    treadmill_mask = create_feathered_mask(treadmill_crop.size, feather_pixels=25)
    grid_mask = create_feathered_mask(grid_crop.size, feather_pixels=25)
    
    # 3. Paste swapped and flipped using masks
    img_swapped = img.copy()
    
    # Posture grid goes to the treadmill's position (left side)
    # The original treadmill box was (160, 480, 520, 950)
    # The grid crop width is 410 (960 - 550)
    # We paste it such that its center matches the treadmill's center approximately.
    # Treadmill center x = (160 + 520) / 2 = 340.
    # Paste x = 340 - 410 / 2 = 135.
    img_swapped.paste(grid_flipped, (135, 480), grid_mask)
    
    # Treadmill goes to the grid's position (right side)
    # The original grid box was (550, 480, 960, 950)
    # Treadmill width is 360 (520 - 160)
    # Grid center x = (550 + 960) / 2 = 755.
    # Paste x = 755 - 360 / 2 = 575.
    img_swapped.paste(treadmill_flipped, (575, 480), treadmill_mask)
    
    # Save test image
    img_swapped.convert("RGB").save("scratch_swapped_feathered.png")
    print("Seamless individual swap done!")
else:
    print("Source not found")
