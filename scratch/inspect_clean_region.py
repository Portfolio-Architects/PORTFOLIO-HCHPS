import os
from PIL import Image

conv_dir = r"C:\Users\user\.gemini\antigravity\brain\05a6beb4-b68a-4abe-b884-18e2496bc40b"
uploaded_path = os.path.join(conv_dir, "media__1781249084991.jpg")
src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"

if os.path.exists(uploaded_path) and os.path.exists(src_image_path):
    up = Image.open(uploaded_path).convert("RGB")
    src = Image.open(src_image_path).convert("RGB")
    cropped = src.crop((0, 224, 1024, 800))
    
    print("Comparing pixels at x=300 for y=0 to 100:")
    for y in range(0, 101, 10):
        print(f"y={y:3d} | Uploaded: {up.getpixel((300, y))} | Cropped Src: {cropped.getpixel((300, y))}")
else:
    print("Files not found")
