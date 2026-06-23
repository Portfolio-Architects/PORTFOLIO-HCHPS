import os
from PIL import Image

conv_dir = r"C:\Users\user\.gemini\antigravity\brain\05a6beb4-b68a-4abe-b884-18e2496bc40b"
uploaded_path = os.path.join(conv_dir, "media__1781249084991.jpg")
generated_path = os.path.join(conv_dir, "AI_sports_medical_center_signboards_modern_1920x1080.png")

if os.path.exists(uploaded_path) and os.path.exists(generated_path):
    up = Image.open(uploaded_path)
    gen = Image.open(generated_path)
    print(f"Uploaded size: {up.size}")
    print(f"Generated size: {gen.size}")
    
    # Check if there is a vertical difference (e.g. is the crop offset different?)
    # Let's save a side-by-side comparison of the top 200 pixels
    w_up, h_up = up.size
    gen_resized = gen.resize((w_up, h_up))
    
    # Save comparison of top 100 rows
    up_top = up.crop((0, 0, w_up, 100))
    gen_top = gen_resized.crop((0, 0, w_up, 100))
    
    comp = Image.new("RGB", (w_up, 200))
    comp.paste(up_top, (0, 0))
    comp.paste(gen_top, (0, 100))
    comp.save("scratch_top_comp.png")
    print("Saved comparison image 'scratch_top_comp.png'")
else:
    print("Files not found")
