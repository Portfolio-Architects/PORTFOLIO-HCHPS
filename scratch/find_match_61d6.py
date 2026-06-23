import os
import sys
from PIL import Image, ImageChops

conv_dir = r"C:\Users\user\.gemini\antigravity\brain\61d68437-51ca-4089-989c-ec5574b9e9b2"
uploaded_path = os.path.join(conv_dir, "media__1781251142198.jpg")

if not os.path.exists(uploaded_path):
    print("Uploaded image not found")
    sys.exit(1)

uploaded_img = Image.open(uploaded_path).convert("RGB")
w_up, h_up = uploaded_img.size

desktop_dir = r"D:\Desktop"
candidates = []
for f in os.listdir(desktop_dir):
    if f.endswith(('.png', '.jpg')):
        candidates.append(os.path.join(desktop_dir, f))

# Also search previous conversation directories
parent_brain_dir = r"C:\Users\user\.gemini\antigravity\brain"
for folder in os.listdir(parent_brain_dir):
    folder_path = os.path.join(parent_brain_dir, folder)
    if os.path.isdir(folder_path):
        for f in os.listdir(folder_path):
            if f.endswith(('.png', '.jpg')):
                candidates.append(os.path.join(folder_path, f))

results = []
for cand in candidates:
    try:
        cand_img = Image.open(cand).convert("RGB")
        if cand_img.size == (1920, 1080):
            # Resize candidate to uploaded size
            cand_resized = cand_img.resize((w_up, h_up), Image.Resampling.LANCZOS)
            diff = ImageChops.difference(uploaded_img, cand_resized)
            # calculate average absolute pixel difference
            stat = diff.histogram()
            sum_diff = sum(i * stat[i] for i in range(len(stat))) / (w_up * h_up * 3)
            results.append((sum_diff, os.path.basename(cand), cand))
    except Exception as e:
        pass

results.sort()
print("Top 10 closest matches:")
for r in results[:10]:
    print(f"Diff={r[0]:.2f} | {r[1]} | Path: {r[2]}")
