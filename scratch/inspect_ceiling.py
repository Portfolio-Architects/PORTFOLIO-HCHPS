import os
from PIL import Image

conv_dir = r"C:\Users\user\.gemini\antigravity\brain\05a6beb4-b68a-4abe-b884-18e2496bc40b"
uploaded_path = os.path.join(conv_dir, "media__1781249084991.jpg")
generated_path = os.path.join(conv_dir, "AI_sports_medical_center_signboards_modern_1920x1080.png")

if os.path.exists(uploaded_path) and os.path.exists(generated_path):
    up = Image.open(uploaded_path)
    gen = Image.open(generated_path)
    
    # Save the original uploaded image and our generated image as-is into scratch folder so we can check their sizes and offsets
    up.save("scratch_uploaded.png")
    gen.save("scratch_generated.png")
    print(f"Uploaded size: {up.size}")
    print(f"Generated size: {gen.size}")
else:
    print("Files not found")
