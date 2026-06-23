import os
from PIL import Image, ImageChops

uploaded_path = r"C:\Users\user\.gemini\antigravity\brain\bdfeb9bb-6a3d-46bf-9590-3d6351385614\media__1781252444253.jpg"
real_photo_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"

if os.path.exists(uploaded_path) and os.path.exists(real_photo_path):
    img_up = Image.open(uploaded_path).convert("RGB")
    img_real = Image.open(real_photo_path)
    
    # Crop and resize real photo to 1024x576 to match uploaded image
    w, h = img_real.size
    new_h = int(w * 9 / 16)
    top = (h - new_h) // 2
    cropped = img_real.crop((0, top, w, top + new_h))
    resized = cropped.resize((1024, 576), Image.Resampling.LANCZOS).convert("RGB")
    
    # Calculate difference
    diff = ImageChops.difference(img_up, resized)
    stat = diff.getbbox()
    if stat is None:
        print("Images are identical (without labels? No, uploaded image has labels so it should have differences).")
    else:
        # Calculate average difference manually
        diff_data = list(diff.getdata())
        avg_diff = sum(sum(pixel) for pixel in diff_data) / (len(diff_data) * 3)
        print("Average pixel difference:", avg_diff)
    
    # Check if there are other files in d05a464b-fea6-416e-b3aa-d924b8ee9a5e
    d05a_dir = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e"
    print("Files in d05a folder:")
    for f in os.listdir(d05a_dir):
        if f.endswith(".png") or f.endswith(".jpg"):
            print(f, os.path.getsize(os.path.join(d05a_dir, f)))
else:
    print("Paths do not exist!")
