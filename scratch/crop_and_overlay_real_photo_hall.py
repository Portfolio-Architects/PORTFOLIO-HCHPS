import os
from PIL import Image, ImageDraw, ImageFont

# Define paths
src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"
dst_image_path = r"D:\Desktop\AI 스포츠_메디컬_트레이닝 센터_45도 사선구도_통사각_실사진_현판_1920x1080.png"
artifact_dir = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e"
artifact_image_path = os.path.join(artifact_dir, "AI_sports_medical_center_signboards_real_photo_1920x1080.png")

if not os.path.exists(src_image_path):
    print(f"Error: Source image not found at {src_image_path}")
    exit(1)

# 1. Load, crop to 16:9, and resize to 1920x1080
img_orig = Image.open(src_image_path)
width, height = img_orig.size

# 16:9 crop from center
new_width = width
new_height = int(width * 9 / 16) # 576
left = 0
top = (height - new_height) // 2 # 224
right = width
bottom = top + new_height # 800

cropped = img_orig.crop((left, top, right, bottom))
img_widescreen = cropped.resize((1920, 1080), Image.Resampling.LANCZOS).convert("RGBA")
print(f"Cropped and resized image to 1920x1080")

# 2. Draw overlay
overlay = Image.new("RGBA", img_widescreen.size, (0, 0, 0, 0))
draw = ImageDraw.Draw(overlay)

# Setup Font (26px)
font_path = r"C:\Windows\Fonts\malgunbd.ttf"  # Malgun Gothic Bold
if not os.path.exists(font_path):
    font_path = r"C:\Windows\Fonts\malgun.ttf"
if not os.path.exists(font_path):
    font = ImageFont.load_default()
else:
    font_size = 26
    font = ImageFont.truetype(font_path, font_size)

# Initial layout and numbered mapping (Anticlockwise flow)
# 1. 대사증후군 측정 및 상담 (Green, top-left)
# 2. 서울체력장 (Teal, bottom-left)
# 3. 헬스체크업 (Amber, bottom-right)
# 4. AI 스마트짐 (Blue, top-right)
zones = [
    {
        'text': "1. 대사증후군 측정 및 상담",
        'accent_color': (34, 197, 94, 255),  # Emerald green
        'tag_center': (300, 160),
        'point_to': (220, 320)
    },
    {
        'text': "2. 서울체력장",
        'accent_color': (20, 184, 166, 255),  # Teal
        'tag_center': (980, 480),  # points to bottom-left
        'point_to': (750, 700)  # Public health fitness area
    },
    {
        'text': "3. 헬스체크업",
        'accent_color': (245, 158, 11, 255),  # Amber/Orange
        'tag_center': (1420, 460),  # points to bottom-right
        'point_to': (1320, 720)  # Musculoskeletal scanner area
    },
    {
        'text': "4. AI 스마트짐",
        'accent_color': (59, 130, 246, 255),  # Blue
        'tag_center': (1300, 120),
        'point_to': (1300, 260)
    }
]

# Draw each signboard
for zone in zones:
    text = zone['text']
    accent_color = zone['accent_color']
    tx, ty = zone['tag_center']
    px, py = zone['point_to']

    # Draw indicator line
    line_color = (255, 255, 255, 140)
    draw.line([tx, ty, px, py], fill=line_color, width=2)
    
    # Draw target dot
    r = 7
    draw.ellipse([px - r, py - r, px + r, py + r], fill=accent_color, outline=(255, 255, 255, 220), width=2)
    draw.ellipse([px - 2, py - 2, px + 2, py + 2], fill=(255, 255, 255, 255))

    # Draw tag background
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
    except AttributeError:
        text_w, text_h = draw.textsize(text, font=font)

    padding_x = 29
    padding_y = 14
    dot_radius = 6
    dot_spacing = 12
    
    accent_space = dot_radius * 2 + dot_spacing
    tag_w = text_w + padding_x * 2 + accent_space
    tag_h = text_h + padding_y * 2
    
    rx1 = tx - tag_w // 2
    ry1 = ty - tag_h // 2
    rx2 = tx + tag_w // 2
    ry2 = ty + tag_h // 2
    
    bg_color = (15, 23, 42, 210)
    draw.rounded_rectangle([rx1, ry1, rx2, ry2], radius=12, fill=bg_color, outline=(255, 255, 255, 90), width=2)
    
    dot_x = rx1 + padding_x + dot_radius
    dot_y = ty
    draw.ellipse([dot_x - dot_radius, dot_y - dot_radius, dot_x + dot_radius, dot_y + dot_radius], fill=accent_color)
    
    text_x = dot_x + dot_radius + dot_spacing
    text_y = ty - text_h // 2 - 2
    draw.text((text_x, text_y), text, font=font, fill=(255, 255, 255, 255))

# Composite and save
final_img = Image.alpha_composite(img_widescreen, overlay).convert("RGB")
final_img.save(dst_image_path, "PNG")
print(f"Saved widescreen modified image to Desktop: {dst_image_path}")

os.makedirs(artifact_dir, exist_ok=True)
final_img.save(artifact_image_path, "PNG")
print(f"Saved widescreen modified image to Artifacts: {artifact_image_path}")
