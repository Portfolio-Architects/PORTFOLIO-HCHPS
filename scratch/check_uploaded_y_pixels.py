from PIL import Image
import os

conv_dir = r"C:\Users\user\.gemini\antigravity\brain\05a6beb4-b68a-4abe-b884-18e2496bc40b"
uploaded_path = os.path.join(conv_dir, "media__1781249084991.jpg")

if os.path.exists(uploaded_path):
    img = Image.open(uploaded_path)
    print("Uploaded image size:", img.size)
    for y in [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 400]:
        print(f"y={y}: {img.getpixel((500, y))}")
else:
    print("Uploaded image not found")
