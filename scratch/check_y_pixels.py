from PIL import Image
import os

src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"
if os.path.exists(src_image_path):
    img = Image.open(src_image_path)
    print("Original size:", img.size)
    # Check pixels along x=500 for y=0, 50, 100, 150, 200, 250, 300, 350, 400
    for y in [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500]:
        print(f"y={y}: {img.getpixel((500, y))}")
else:
    print("Source image not found")
