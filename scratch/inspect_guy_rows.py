from PIL import Image

guy_img = Image.open(r"C:\Users\user\.gemini\antigravity\brain\61d68437-51ca-4089-989c-ec5574b9e9b2\original_guy_1024.png")
w, h = guy_img.size

# Check row averages
for y in range(0, h, 5):
    row_pixels = [guy_img.getpixel((x, y)) for x in range(w)]
    avg_r = sum(p[0] for p in row_pixels) // w
    avg_g = sum(p[1] for p in row_pixels) // w
    avg_b = sum(p[2] for p in row_pixels) // w
    print(f"Row {y:3d} (y in 1024x576={220+y:3d}): Avg=({avg_r:3d}, {avg_g:3d}, {avg_b:3d})")
