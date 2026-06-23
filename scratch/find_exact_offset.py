import os
from PIL import Image, ImageChops

conv_dir = r"C:\Users\user\.gemini\antigravity\brain\05a6beb4-b68a-4abe-b884-18e2496bc40b"
uploaded_path = os.path.join(conv_dir, "media__1781249084991.jpg")
src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"

if os.path.exists(uploaded_path) and os.path.exists(src_image_path):
    uploaded_img = Image.open(uploaded_path).convert("RGB")
    w_up, h_up = uploaded_img.size # 1024x576
    
    src_img = Image.open(src_image_path).convert("RGB")
    
    results = []
    # Check top from 0 to 448
    for top in range(0, 449):
        cropped = src_img.crop((0, top, 1024, top + 576))
        diff = ImageChops.difference(uploaded_img, cropped)
        stat = diff.histogram()
        sum_diff = sum(i * stat[i] for i in range(len(stat))) / (w_up * h_up * 3)
        results.append((sum_diff, top))
        
    results.sort()
    print("Top 10 exact crop offsets:")
    for r in results[:10]:
        print(f"Top: {r[1]} -> Diff: {r[0]:.4f}")
else:
    print("Files not found")
