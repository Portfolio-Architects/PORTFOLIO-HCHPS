import os
from PIL import Image

desktop_dir = r"D:\Desktop"
for f in os.listdir(desktop_dir):
    if f.endswith(".png") and "AI 스포츠" in f:
        path = os.path.join(desktop_dir, f)
        img = Image.open(path)
        # Check left 10 pixels and right 10 pixels to see if they are a solid color (like black or gray)
        left_slice = img.crop((0, 0, 10, img.height))
        right_slice = img.crop((img.width - 10, 0, img.width, img.height))
        
        # Check if color is uniform
        l_colors = set(left_slice.getdata())
        r_colors = set(right_slice.getdata())
        
        print(f"File: {f} | Size: {img.size} | Left colors: {len(l_colors)} | Right colors: {len(r_colors)}")
