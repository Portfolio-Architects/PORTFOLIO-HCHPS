import os
import sys
from PIL import Image, ImageChops

conv_dir = r"C:\Users\user\.gemini\antigravity\brain\05a6beb4-b68a-4abe-b884-18e2496bc40b"
uploaded_path = os.path.join(conv_dir, "media__1781249084991.jpg")

if not os.path.exists(uploaded_path):
    print("Uploaded image not found")
    sys.exit(1)

uploaded_img = Image.open(uploaded_path).convert("RGB")
w_up, h_up = uploaded_img.size

desktop_dir = r"D:\Desktop"
candidates = []
for f in os.listdir(desktop_dir):
    if f.endswith(('.png', '.jpg')) and "AI 스포츠" in f:
        candidates.append(os.path.join(desktop_dir, f))

# Also scan previous conversation directories
parent_brain_dir = r"C:\Users\user\.gemini\antigravity\brain"
for folder in os.listdir(parent_brain_dir):
    folder_path = os.path.join(parent_brain_dir, folder)
    if os.path.isdir(folder_path):
        for f in os.listdir(folder_path):
            if f.endswith(('.png', '.jpg')) and "sports" in f.lower():
                candidates.append(os.path.join(folder_path, f))

sys.stdout.reconfigure(encoding='utf-8')
print(f"Uploaded dimensions: {w_up}x{h_up}")

for cand in candidates:
    try:
        cand_img = Image.open(cand).convert("RGB")
        # Resize to uploaded size for comparison
        cand_resized = cand_img.resize((w_up, h_up), Image.Resampling.LANCZOS)
        diff = ImageChops.difference(uploaded_img, cand_resized)
        # Calculate mean absolute difference
        stat = diff.histogram()
        sum_diff = sum(i * stat[i] for i in range(len(stat))) / (w_up * h_up * 3)
        print(f"Diff with {os.path.basename(cand)}: {sum_diff:.2f}")
    except Exception as e:
        print(f"Error reading {cand}: {e}")
