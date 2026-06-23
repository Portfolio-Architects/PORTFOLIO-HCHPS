import os
from PIL import Image

conv_dir = r"C:\Users\user\.gemini\antigravity\brain\05a6beb4-b68a-4abe-b884-18e2496bc40b"
uploaded_path = os.path.join(conv_dir, "media__1781249084991.jpg")
src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"

if os.path.exists(uploaded_path) and os.path.exists(src_image_path):
    up = Image.open(uploaded_path).convert("RGB")
    src = Image.open(src_image_path).convert("RGB")
    
    cropped_src = src.crop((0, 224, 1024, 800))
    
    print("Comparing pixels along x=100:")
    for y in [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500]:
        print(f"y={y:3d} | Uploaded: {up.getpixel((100, y))} | Cropped Src: {cropped_src.getpixel((100, y))}")
        
    print("\nComparing pixels along x=500:")
    for y in [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500]:
        print(f"y={y:3d} | Uploaded: {up.getpixel((500, y))} | Cropped Src: {cropped_src.getpixel((500, y))}")
else:
    print("Files not found")
