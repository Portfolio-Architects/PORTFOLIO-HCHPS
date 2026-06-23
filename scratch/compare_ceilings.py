import os
from PIL import Image, ImageChops

conv_dir = r"C:\Users\user\.gemini\antigravity\brain\05a6beb4-b68a-4abe-b884-18e2496bc40b"
uploaded_path = os.path.join(conv_dir, "media__1781249084991.jpg")
generated_path = os.path.join(conv_dir, "AI_sports_medical_center_signboards_modern_1920x1080.png")

if os.path.exists(uploaded_path) and os.path.exists(generated_path):
    up = Image.open(uploaded_path).convert("RGB") # 1024x576
    gen = Image.open(generated_path).convert("RGB") # 1920x1080
    
    # Resize gen to 1024x576
    gen_resized = gen.resize((1024, 576), Image.Resampling.LANCZOS)
    
    # Compare top 200 pixels vertically
    diff = ImageChops.difference(up, gen_resized)
    stat = diff.histogram()
    print("Total diff between uploaded and resized generated:", sum(i * stat[i] for i in range(len(stat))) / (1024 * 576 * 3))
    
    # Let's save a visual diff of the top 200 rows
    up_top = up.crop((0, 0, 1024, 200))
    gen_top = gen_resized.crop((0, 0, 1024, 200))
    
    # Print average pixel diff in the top 200 rows
    top_diff = ImageChops.difference(up_top, gen_top)
    top_stat = top_diff.histogram()
    print("Diff in top 200 rows:", sum(i * top_stat[i] for i in range(len(top_stat))) / (1024 * 200 * 3))
    
    # Let's save them side-by-side
    comp = Image.new("RGB", (1024, 400))
    comp.paste(up_top, (0, 0))
    comp.paste(gen_top, (0, 200))
    comp.save("scratch_ceilings_comp.png")
    print("Saved scratch_ceilings_comp.png")
else:
    print("Files not found")
