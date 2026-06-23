import os
from PIL import Image, ImageChops

conv_dir = r"C:\Users\user\.gemini\antigravity\brain\05a6beb4-b68a-4abe-b884-18e2496bc40b"
uploaded_path = os.path.join(conv_dir, "media__1781249084991.jpg")

desktop_dir = r"D:\Desktop"
files = [
    "AI 스포츠_메디컬_트레이닝 센터_45도 사선구도_1920x1080.png",
    "AI 스포츠_메디컬_트레이닝 센터_45도 사선구도_통사각_실사진_현판_1920x1080.png",
    "AI 스포츠_메디컬_트레이닝 센터_45도 사선구도_통사각_넷플릭스현판_1920x1080.png",
    "AI 스포츠_메디컬_트레이닝 센터_45도 사선구도_현판_모던_1920x1080.png"
]

if os.path.exists(uploaded_path):
    up = Image.open(uploaded_path).convert("RGB")
    w_up, h_up = up.size
    
    for f in files:
        f_path = os.path.join(desktop_dir, f)
        if os.path.exists(f_path):
            img = Image.open(f_path).convert("RGB")
            # Resize
            img_resized = img.resize((w_up, h_up), Image.Resampling.LANCZOS)
            diff = ImageChops.difference(up, img_resized)
            stat = diff.histogram()
            sum_diff = sum(i * stat[i] for i in range(len(stat))) / (w_up * h_up * 3)
            print(f"Diff with '{f}': {sum_diff:.4f}")
        else:
            print(f"File '{f}' not found")
else:
    print("Uploaded image not found")
