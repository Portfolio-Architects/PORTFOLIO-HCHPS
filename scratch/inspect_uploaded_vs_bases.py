import os
from PIL import Image, ImageChops

conv_dir = r"C:\Users\user\.gemini\antigravity\brain\05a6beb4-b68a-4abe-b884-18e2496bc40b"
uploaded_path = os.path.join(conv_dir, "media__1781249084991.jpg")

base1 = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"
base2 = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_diversified_1781247381651.png"

if os.path.exists(uploaded_path):
    up = Image.open(uploaded_path).convert("RGB")
    w_up, h_up = up.size
    
    for name, b_path in [("Real Photo", base1), ("Diversified", base2)]:
        if os.path.exists(b_path):
            b_img = Image.open(b_path).convert("RGB")
            # We crop the base at top=224 to match the 1024x576 size
            cropped = b_img.crop((0, 224, 1024, 800))
            
            # Check difference in a region where there are NO signboards: e.g. x=200 to 400, y=0 to 100
            up_sub = up.crop((200, 0, 400, 100))
            cropped_sub = cropped.crop((200, 0, 400, 100))
            
            diff = ImageChops.difference(up_sub, cropped_sub)
            stat = diff.histogram()
            sum_diff = sum(i * stat[i] for i in range(len(stat))) / (200 * 100 * 3)
            print(f"Diff in background for {name}: {sum_diff:.4f}")
        else:
            print(f"Base '{name}' not found")
else:
    print("Uploaded image not found")
