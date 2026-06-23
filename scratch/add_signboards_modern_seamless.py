import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# Define paths
src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"
dst_image_path = r"D:\Desktop\AI 스포츠_메디컬_트레이닝 센터_45도 사선구도_현판_모던_1920x1080.png"

# Verify source image exists
if not os.path.exists(src_image_path):
    print(f"Error: Source image not found at {src_image_path}")
    exit(1)

# Load the image (1024x1024)
img_orig = Image.open(src_image_path).convert("RGBA")

# 1. Crop and paste individual equipment zones to preserve background walls/ceiling completely (swapping without flipping)
# Treadmill (left)
treadmill_box = (160, 480, 520, 950)
treadmill_crop = img_orig.crop(treadmill_box)

# Grid screen (right)
grid_box = (550, 480, 960, 950)
grid_crop = img_orig.crop(grid_box)

# Create soft feathered masks for seamless blending
def create_feathered_mask(size, feather_pixels=25):
    mask = Image.new("L", size, 255)
    draw = ImageDraw.Draw(mask)
    for i in range(feather_pixels):
        alpha = int(255 * (i / feather_pixels))
        draw.rectangle(
            [i, i, size[0] - 1 - i, size[1] - 1 - i], 
            outline=alpha, 
            width=1
        )
    return mask.filter(ImageFilter.GaussianBlur(3))

treadmill_mask = create_feathered_mask(treadmill_crop.size, feather_pixels=25)
grid_mask = create_feathered_mask(grid_crop.size, feather_pixels=25)

# Paste swapped equipment on top of the original unflipped background
img_swapped = img_orig.copy()
# Grid goes to left
img_swapped.paste(grid_crop, (135, 480), grid_mask)
# Treadmill goes to right
img_swapped.paste(treadmill_crop, (575, 480), treadmill_mask)

# 2. Crop to 16:9 widescreen from center
width, height = img_swapped.size # 1024x1024
new_width = width
new_height = int(width * 9 / 16) # 576
left = 0
top = (height - new_height) // 2 # 224
right = width
bottom = top + new_height # 800

cropped = img_swapped.crop((left, top, right, bottom))
img_widescreen = cropped.resize((1920, 1080), Image.Resampling.LANCZOS).convert("RGBA")

# 3. Create overlay layer for signboards
overlay = Image.new("RGBA", img_widescreen.size, (0, 0, 0, 0))
draw = ImageDraw.Draw(overlay)

# Setup Font
font_path = r"C:\Windows\Fonts\malgunbd.ttf"
if not os.path.exists(font_path):
    font_path = r"C:\Windows\Fonts\malgun.ttf"
if not os.path.exists(font_path):
    font = ImageFont.load_default()
    font_bold = font
else:
    font_size = 28
    font = ImageFont.truetype(font_path, font_size)
    font_bold = ImageFont.truetype(font_path, font_size)

# Signboard definitions (Zone 2 and Zone 3 switched)
zones = [
    {
        'text': "1. 대사증후군 측정 및 상담",
        'accent_color': (34, 197, 94, 255), # Green
        'tag_center': (250, 270),
        'point_to': (220, 320)
    },
    {
        'text': "3. 서울체력장",
        'accent_color': (56, 189, 248, 255), # Sky Blue
        'tag_center': (550, 730),
        'point_to': (620, 800)
    },
    {
        'text': "2. 헬스체크업",
        'accent_color': (245, 158, 11, 255), # Amber
        'tag_center': (1300, 730),
        'point_to': (1380, 800)
    },
    {
        'text': "4. 스마트 짐",
        'accent_color': (59, 130, 246, 255), # Blue
        'tag_center': (1300, 210),
        'point_to': (1300, 260)
    }
]

def draw_glowing_line(draw, pt1, pt2, color, width=2):
    # draw glow
    for i in range(4):
        alpha = 50 - i*12
        draw.line([pt1, pt2], fill=(color[0], color[1], color[2], alpha), width=width + i*4)
    # core line
    draw.line([pt1, pt2], fill=(255, 255, 255, 220), width=width)

def draw_modern_tag(draw, tx, ty, text, accent_color):
    try:
        bbox = draw.textbbox((0, 0), text, font=font_bold)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
    except AttributeError:
        text_w, text_h = draw.textsize(text, font=font_bold)

    padding_x = 24
    padding_y = 16
    
    tag_w = text_w + padding_x * 2
    tag_h = text_h + padding_y * 2
    
    rx1 = tx - tag_w // 2
    ry1 = ty - tag_h // 2
    rx2 = tx + tag_w // 2
    ry2 = ty + tag_h // 2
    
    # Glow effect behind the tag
    for i in range(3):
        glow_alpha = 40 - i*10
        draw.rounded_rectangle(
            [rx1 - i*4, ry1 - i*4, rx2 + i*4, ry2 + i*4], 
            radius=16, 
            fill=(0, 0, 0, glow_alpha)
        )

    # Main dark glassmorphic background
    bg_color = (20, 25, 35, 220)
    draw.rounded_rectangle([rx1, ry1, rx2, ry2], radius=16, fill=bg_color)
    
    # Border outline
    draw.rounded_rectangle([rx1, ry1, rx2, ry2], radius=16, outline=(255, 255, 255, 60), width=1)
    
    # Left accent vertical bar
    bar_width = 6
    bar_rx1 = rx1 + 10
    bar_ry1 = ry1 + 12
    bar_rx2 = bar_rx1 + bar_width
    bar_ry2 = ry2 - 12
    draw.rounded_rectangle([bar_rx1, bar_ry1, bar_rx2, bar_ry2], radius=3, fill=accent_color)
    
    # Text
    text_x = bar_rx2 + 14
    text_y = ty - text_h // 2 - 2
    draw.text((text_x, text_y), text, font=font_bold, fill=(255, 255, 255, 255))
    
    return rx1, ry1, rx2, ry2

# Draw each signboard
for zone in zones:
    text = zone['text']
    accent_color = zone['accent_color']
    tx, ty = zone['tag_center']
    px, py = zone['point_to']

    # Draw target dot with glow
    r = 6
    for i in range(3):
        glow_r = r + 2 + i*3
        draw.ellipse([px - glow_r, py - glow_r, px + glow_r, py + glow_r], fill=(accent_color[0], accent_color[1], accent_color[2], 50 - i*15))
        
    draw.ellipse([px - r, py - r, px + r, py + r], fill=accent_color)
    draw.ellipse([px - 2, py - 2, px + 2, py + 2], fill=(255, 255, 255, 255))

    # Draw line from center to point
    draw_glowing_line(draw, (tx, ty), (px, py), accent_color, width=2)

    # Draw the tag card
    draw_modern_tag(draw, tx, ty, text, accent_color)

# Composite and save
final_img = Image.alpha_composite(img_widescreen, overlay).convert("RGB")
final_img.save(dst_image_path, "PNG")

# Save to artifact dir as well
artifact_dir = r"C:\Users\user\.gemini\antigravity\brain\05a6beb4-b68a-4abe-b884-18e2496bc40b"
artifact_swapped_path = os.path.join(artifact_dir, "AI_sports_medical_center_signboards_modern_1920x1080.png")
final_img.save(artifact_swapped_path, "PNG")

print(f"Generated modern seamless signboard preview at {dst_image_path}")
