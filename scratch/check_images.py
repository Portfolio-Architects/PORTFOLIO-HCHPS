import os
from PIL import Image

src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"
uploaded_image_path = r"C:\Users\user\.gemini\antigravity\brain\bdfeb9bb-6a3d-46bf-9590-3d6351385614\media__1781252444253.jpg"

print("High-res original exists:", os.path.exists(src_image_path))
if os.path.exists(src_image_path):
    with Image.open(src_image_path) as img:
        print("High-res original size:", img.size)

print("Uploaded image exists:", os.path.exists(uploaded_image_path))
if os.path.exists(uploaded_image_path):
    with Image.open(uploaded_image_path) as img:
        print("Uploaded image size:", img.size)
