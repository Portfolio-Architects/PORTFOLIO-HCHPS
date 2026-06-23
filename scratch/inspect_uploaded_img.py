from PIL import Image
import os

img_path = r"C:\Users\user\AppData\Local\Programs\Python\Python313" # No, wait, current conversation directory
conv_dir = r"C:\Users\user\.gemini\antigravity\brain\05a6beb4-b68a-4abe-b884-18e2496bc40b"
img_file = os.path.join(conv_dir, "media__1781249084991.jpg")

if os.path.exists(img_file):
    img = Image.open(img_file)
    print(f"Dimensions: {img.size}")
else:
    print("Image not found")
