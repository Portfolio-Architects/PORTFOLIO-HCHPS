import os
from PIL import Image

conv_dir = r"C:\Users\user\.gemini\antigravity\brain\61d68437-51ca-4089-989c-ec5574b9e9b2"
split_ys = [400, 420, 440, 460, 480, 500, 520, 540]

for split_y in split_ys:
    filename = f"test_split_{split_y}.png"
    filepath = os.path.join(conv_dir, filename)
    if os.path.exists(filepath):
        img = Image.open(filepath)
        # Rescale the image to 1024x576 to analyze in 1024x576 coordinates
        img_1024 = img.resize((1024, 576), Image.Resampling.LANCZOS)
        pixels = img_1024.load()
        
        # Count dark pixels in the guy's original head region (x: 340-365, y: 270-288)
        dark_pixels = 0
        for y in range(270, 288):
            for x in range(340, 365):
                r, g, b = pixels[x, y][:3]
                # Stricter threshold for black hair
                if r < 110 and g < 110 and b < 110:
                    dark_pixels += 1
                    
        print(f"split_y={split_y} (1024x576 y={int(split_y*576/1080)}): Dark pixels left behind = {dark_pixels}")
    else:
        print(f"File not found: {filepath}")
