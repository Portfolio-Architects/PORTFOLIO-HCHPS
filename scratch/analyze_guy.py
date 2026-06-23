from PIL import Image

# Load scratch_guy.png (x: 600-680, y: 450-750 of img_widescreen)
guy_img = Image.open(r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch_guy.png")
w, h = guy_img.size

# Check row averages
for y in range(0, h, 10):
    row_pixels = [guy_img.getpixel((x, y)) for x in range(w)]
    avg_r = sum(p[0] for p in row_pixels) // w
    avg_g = sum(p[1] for p in row_pixels) // w
    avg_b = sum(p[2] for p in row_pixels) // w
    print(f"Row {y:3d} (widescreen y={450+y:3d}): Avg=({avg_r:3d}, {avg_g:3d}, {avg_b:3d})")
