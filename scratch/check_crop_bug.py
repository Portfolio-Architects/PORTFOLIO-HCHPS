import os
from PIL import Image

conv_dir = r"C:\Users\user\.gemini\antigravity\brain\05a6beb4-b68a-4abe-b884-18e2496bc40b"
uploaded_path = os.path.join(conv_dir, "media__1781249084991.jpg")
generated_path = os.path.join(conv_dir, "AI_sports_medical_center_signboards_modern_1920x1080.png")

if os.path.exists(uploaded_path) and os.path.exists(generated_path):
    up = Image.open(uploaded_path).convert("RGB")
    gen = Image.open(generated_path).convert("RGB")
    
    # Let's save a downscaled diff of the two images to see where the mismatch is
    w_up, h_up = up.size
    gen_resized = gen.resize((w_up, h_up), Image.Resampling.LANCZOS)
    
    # Check average color difference
    from PIL import ImageChops
    diff = ImageChops.difference(up, gen_resized)
    diff.save("scratch_crop_diff.png")
    
    print("Saved crop diff image to scratch_crop_diff.png")
else:
    print("Files not found")
