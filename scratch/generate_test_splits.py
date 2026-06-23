import os
from PIL import Image

# Paths
src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"
conv_dir = r"C:\Users\user\.gemini\antigravity\brain\61d68437-51ca-4089-989c-ec5574b9e9b2"

if os.path.exists(src_image_path):
    img_orig = Image.open(src_image_path)
    width, height = img_orig.size # 1024x1024
    
    # 16:9 crop from center
    new_width = width
    new_height = int(width * 9 / 16) # 576
    left = 0
    top = (height - new_height) // 2 # 224
    right = width
    bottom = top + new_height # 800
    
    cropped = img_orig.crop((left, top, right, bottom))
    img_widescreen = cropped.resize((1920, 1080), Image.Resampling.LANCZOS).convert("RGBA")
    
    # Test dividing lines
    test_lines = [400, 420, 440, 460, 480, 500, 520, 540]
    for split_y in test_lines:
        img_background = img_widescreen.copy()
        
        # Crop bottom half at split_y
        bottom_half = img_widescreen.crop((0, split_y, 1920, 1080))
        bottom_flipped = bottom_half.transpose(Image.FLIP_LEFT_RIGHT)
        
        # Paste back
        img_background.paste(bottom_flipped, (0, split_y))
        
        # Save test image
        out_name = f"test_split_{split_y}.png"
        out_path = os.path.join(conv_dir, out_name)
        img_background.save(out_path)
        print(f"Generated test split at y={split_y} -> {out_path}")
else:
    print("Source image not found")
