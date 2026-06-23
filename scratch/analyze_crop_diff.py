import os
from PIL import Image

diff_path = "scratch_crop_diff.png"
if os.path.exists(diff_path):
    img = Image.open(diff_path).convert("L")
    w, h = img.size
    
    # Calculate average difference per row
    row_diffs = []
    for y in range(h):
        row_pixels = [img.getpixel((x, y)) for x in range(w)]
        avg_diff = sum(row_pixels) / w
        row_diffs.append((avg_diff, y))
        
    # Print the top 10 rows with highest differences, and average diff in top half vs bottom half
    top_half_diff = sum(d[0] for d in row_diffs[:h//2]) / (h//2)
    bottom_half_diff = sum(d[0] for d in row_diffs[h//2:]) / (h//2)
    print(f"Average diff in top half: {top_half_diff:.2f}")
    print(f"Average diff in bottom half: {bottom_half_diff:.2f}")
    
    # Check if the diff is very high at the very top (e.g. y < 50)
    very_top_diff = sum(d[0] for d in row_diffs[:50]) / 50
    print(f"Average diff in very top 50 rows: {very_top_diff:.2f}")
    
    # Print row diffs for every 50 rows
    for y in range(0, h, 50):
        chunk_avg = sum(d[0] for d in row_diffs[y:y+50]) / min(50, h - y)
        print(f"Row {y:3d} - {y+50:3d}: {chunk_avg:.2f}")
else:
    print("Diff image not found")
