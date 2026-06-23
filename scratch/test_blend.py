import os
from PIL import Image, ImageDraw

src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"
if os.path.exists(src_image_path):
    img = Image.open(src_image_path).convert("RGBA")
    w, h = img.size
    
    # 1. Create flipped image of the entire source
    img_flipped = img.transpose(Image.FLIP_LEFT_RIGHT)
    
    # 2. Create gradient mask for blending at y = 450
    mask = Image.new("L", (w, h), 255)
    draw = ImageDraw.Draw(mask)
    
    # y = 440 to 460 is the blend zone
    blend_start = 440
    blend_end = 460
    
    # Fill below blend_end with 0 (which will show the flipped image)
    draw.rectangle([0, blend_end, w, h], fill=0)
    
    # Draw linear gradient in the blend zone
    for y in range(blend_start, blend_end):
        alpha = int(255 * (blend_end - y) / (blend_end - blend_start))
        draw.line([0, y, w, y], fill=alpha)
        
    # 3. Composite original and flipped
    img_blended = Image.composite(img, img_flipped, mask)
    img_blended.convert("RGB").save("scratch_blended_mirrored.png")
    print("Blended mirror done")
else:
    print("Source not found")
