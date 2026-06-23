import os
from PIL import Image

conv_dir = r"C:\Users\user\.gemini\antigravity\brain\05a6beb4-b68a-4abe-b884-18e2496bc40b"
uploaded_path = os.path.join(conv_dir, "media__1781249084991.jpg")
generated_path = os.path.join(conv_dir, "AI_sports_medical_center_signboards_modern_1920x1080.png")

if os.path.exists(uploaded_path) and os.path.exists(generated_path):
    up = Image.open(uploaded_path).convert("RGB") # 1024x576
    gen = Image.open(generated_path).convert("RGB").resize((1024, 576), Image.Resampling.LANCZOS)
    
    # We will find the bounding box of pixels that are different by more than 10 levels in any channel
    diff_pixels = []
    for x in range(1024):
        for y in range(576):
            p_up = up.getpixel((x, y))
            p_gen = gen.getpixel((x, y))
            if any(abs(p_up[i] - p_gen[i]) > 15 for i in range(3)):
                diff_pixels.append((x, y))
                
    if diff_pixels:
        xs = [p[0] for p in diff_pixels]
        ys = [p[1] for p in diff_pixels]
        print(f"Total different pixels: {len(diff_pixels)}")
        print(f"Bounding box of difference: x in [{min(xs)}, {max(xs)}], y in [{min(ys)}, {max(ys)}]")
    else:
        print("No different pixels found!")
else:
    print("Files not found")
