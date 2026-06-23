import os
from PIL import Image, ImageDraw

src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"
if os.path.exists(src_image_path):
    # Load and crop/resize
    img_orig = Image.open(src_image_path)
    width, height = img_orig.size
    new_width = width
    new_height = int(width * 9 / 16) # 576
    left = 0
    top = (height - new_height) // 2 # 224
    right = width
    bottom = top + new_height # 800
    
    cropped = img_orig.crop((left, top, right, bottom))
    img_widescreen = cropped.resize((1920, 1080), Image.Resampling.LANCZOS).convert("RGBA")
    
    # Mirror horizontally
    img_flipped = img_widescreen.transpose(Image.FLIP_LEFT_RIGHT)
    
    # Create blend mask
    w, h = 1920, 1080
    mask = Image.new("L", (w, h), 255)
    draw = ImageDraw.Draw(mask)
    
    blend_start = 380
    blend_end = 420
    
    draw.rectangle([0, blend_end, w, h], fill=0)
    for y in range(blend_start, blend_end):
        alpha = int(255 * (blend_end - y) / (blend_end - blend_start))
        draw.line([0, y, w, y], fill=alpha)
        
    img_blended = Image.composite(img_widescreen, img_flipped, mask)
    img_blended.convert("RGB").save("scratch_blended_widescreen.png")
    print("Blended widescreen done")
else:
    print("Source not found")
