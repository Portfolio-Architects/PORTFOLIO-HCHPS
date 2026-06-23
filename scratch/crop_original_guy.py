import os
from PIL import Image

conv_dir = r"C:\Users\user\.gemini\antigravity\brain\61d68437-51ca-4089-989c-ec5574b9e9b2"
uploaded_image_path = os.path.join(conv_dir, "media__1781251142198.jpg")

if os.path.exists(uploaded_image_path):
    img = Image.open(uploaded_image_path)
    w, h = img.size
    
    # Crop the guy in 1024x576 coordinates
    # Let's crop a box around him: x from 320 to 380, y from 220 to 420
    guy_crop = img.crop((320, 220, 380, 420))
    guy_crop.save(os.path.join(conv_dir, "original_guy_1024.png"))
    print("Saved original_guy_1024.png")
else:
    print("Uploaded image not found")
