import os
from PIL import Image

src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"

if os.path.exists(src_image_path):
    img = Image.open(src_image_path).convert("RGBA")
    
    # Crop treadmill box
    treadmill_box = (160, 480, 520, 950)
    treadmill_crop = img.crop(treadmill_box)
    
    # Process pixels: if it's floor (warm/light color), set alpha to 0
    pixels = treadmill_crop.load()
    w, h = treadmill_crop.size
    for x in range(w):
        for y in range(h):
            r, g, b, a = pixels[x, y]
            # Floor color is typically bright and warm: R is high, G is medium, B is lower
            # Let's check if it fits the wood floor color threshold
            if r > 120 and g > 90 and b > 60 and (r - b) > 15:
                # Make floor transparent
                pixels[x, y] = (r, g, b, 0)
                
    treadmill_crop.save("scratch_treadmill_segmented.png")
    print("Threshold segmentation test done")
else:
    print("Source not found")
