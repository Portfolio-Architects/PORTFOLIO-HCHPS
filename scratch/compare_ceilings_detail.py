import os
from PIL import Image

conv_dir = r"C:\Users\user\.gemini\antigravity\brain\05a6beb4-b68a-4abe-b884-18e2496bc40b"
uploaded_path = os.path.join(conv_dir, "media__1781249084991.jpg")
generated_path = os.path.join(conv_dir, "AI_sports_medical_center_signboards_modern_1920x1080.png")

if os.path.exists(uploaded_path) and os.path.exists(generated_path):
    up = Image.open(uploaded_path).convert("RGB")
    gen = Image.open(generated_path).convert("RGB").resize((1024, 576), Image.Resampling.LANCZOS)
    
    # We will print pixel color along x=200 for y=0 to 100, which has no signboards
    print("Comparing pixels along x=200 (should be background wall/ceiling):")
    for y in range(0, 101, 10):
        p_up = up.getpixel((200, y))
        p_gen = gen.getpixel((200, y))
        print(f"y={y:3d} | Uploaded: {p_up} | Generated: {p_gen} | Diff: {abs(p_up[0]-p_gen[0]) + abs(p_up[1]-p_gen[1]) + abs(p_up[2]-p_gen[2])}")
else:
    print("Files not found")
