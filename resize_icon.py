from PIL import Image
import os

def scale_icon(filepath, scale=0.8):
    if not os.path.exists(filepath):
        print(f"Skipping {filepath}, does not exist.")
        return
    
    img = Image.open(filepath).convert("RGBA")
    w, h = img.size
    
    new_w = int(w * scale)
    new_h = int(h * scale)
    
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # Create new transparent canvas
    canvas = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    
    # Paste resized into center
    paste_x = (w - new_w) // 2
    paste_y = (h - new_h) // 2
    canvas.paste(resized, (paste_x, paste_y), mask=resized)
    
    canvas.save(filepath)
    print(f"Scaled {filepath} successfully.")

scale_icon("src/app/icon.png")
scale_icon("src/app/apple-icon.png")
