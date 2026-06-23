import os
from PIL import Image

# Path to the uploaded image in this conversation
conv_dir = r"C:\Users\user\.gemini\antigravity\brain\61d68437-51ca-4089-989c-ec5574b9e9b2"
src_image_path = os.path.join(conv_dir, "media__1781251142198.jpg")
dst_image_path = os.path.join(conv_dir, "bottom_flipped.png")

if os.path.exists(src_image_path):
    img = Image.open(src_image_path)
    w, h = img.size
    
    # Calculate the midpoint of the height
    mid_y = h // 2  # 576 // 2 = 288
    
    # Crop the bottom half (y from mid_y to h)
    bottom_half = img.crop((0, mid_y, w, h))
    
    # Flip the bottom half horizontally
    bottom_flipped = bottom_half.transpose(Image.FLIP_LEFT_RIGHT)
    
    # Create a copy and paste the flipped bottom half back
    result_img = img.copy()
    result_img.paste(bottom_flipped, (0, mid_y))
    
    # Save the output
    result_img.save(dst_image_path)
    print(f"Flipped bottom half successfully. Saved to: {dst_image_path}")
else:
    print(f"Error: Source image not found at {src_image_path}")
