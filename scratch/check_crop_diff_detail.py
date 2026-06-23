import os
from PIL import Image, ImageChops

conv_dir = r"C:\Users\user\.gemini\antigravity\brain\05a6beb4-b68a-4abe-b884-18e2496bc40b"
uploaded_path = os.path.join(conv_dir, "media__1781249084991.jpg")
src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"

if os.path.exists(uploaded_path) and os.path.exists(src_image_path):
    up = Image.open(uploaded_path).convert("RGB")
    src = Image.open(src_image_path).convert("RGB")
    
    # Let's crop src at top=224, height=576
    cropped_src = src.crop((0, 224, 1024, 800))
    
    # Compare
    diff = ImageChops.difference(up, cropped_src)
    diff.save("scratch_crop_diff_direct.png")
    
    # Print pixel values at some points
    print("Uploaded pixel at (100, 100):", up.getpixel((100, 100)))
    print("Cropped src pixel at (100, 100):", cropped_src.getpixel((100, 100)))
    
    # Save cropped src for comparison
    cropped_src.save("scratch_cropped_src_224.png")
    print("Saved scratch_cropped_src_224.png")
else:
    print("Files not found")
