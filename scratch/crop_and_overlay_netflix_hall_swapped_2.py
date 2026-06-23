import os
from PIL import Image, ImageDraw, ImageFont

# Define paths
src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_diversified_1781247381651.png"
dst_image_path = r"D:\Desktop\AI 스포츠_메디컬_트레이닝 센터_45도 사선구도_통사각_넷플릭스현판_1920x1080_위치스왑.png"
artifact_dir = r"C:\Users\user\.gemini\antigravity\brain\c36768e1-c5d8-4c57-a408-37cc121ba020"
artifact_image_path = os.path.join(artifact_dir, "AI_sports_medical_center_signboards_netflix_1920x1080_swapped.png")

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

# Setup Fonts
font_path = r"C:\Windows\Fonts\malgunbd.ttf"  # Malgun Gothic Bold
if not os.path.exists(font_path):
    font_path = r"C:\Windows\Fonts\malgun.ttf"

sub_font_path = r"C:\Windows\Fonts\segoeuib.ttf" # Segoe UI Bold
if not os.path.exists(sub_font_path):
    sub_font_path = r"C:\Windows\Fonts\arial.ttf"

if os.path.exists(font_path):
    font = ImageFont.truetype(font_path, 20)
else:
    font = ImageFont.load_default()

if os.path.exists(sub_font_path):
    sub_font = ImageFont.truetype(sub_font_path, 11)
else:
    sub_font = ImageFont.load_default()

# Swapped order:
zones = [
    {
        'text': "1. 대사증후군 측정 및 상담",
        'sub_text': "METABOLIC CLINIC",
        'accent_color': (34, 197, 94, 255),  # Emerald green
        'tag_center': (300, 160),
        'point_to': (220, 320)
    },
    {
        'text': "2. 서울체력장",
        'sub_text': "FITNESS CERTIFICATION",
        'accent_color': (20, 184, 166, 255),  # Teal
        'tag_center': (980, 480),  # Left side tag
        'point_to': (750, 700)  # Points to left-side fitness treadmills
    },
    {
        'text': "3. 헬스체크업",
        'sub_text': "MUSCULOSKELETAL CHECKUP",
        'accent_color': (245, 158, 11, 255),  # Amber/Orange
        'tag_center': (1420, 460),  # Right side tag
        'point_to': (1320, 720)  # Points to right-side musculoskeletal area
    },
    {
        'text': "4. AI 스마트짐",
        'sub_text': "AI SMART GYM",
        'accent_color': (59, 130, 246, 255),  # Blue
        'tag_center': (1300, 120),
        'point_to': (1300, 260)
    }
]

# Draw each signboard
for zone in zones:
    text = zone['text']
    sub_text = zone['sub_text']
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

    # Calculate text sizes
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        
        s_bbox = draw.textbbox((0, 0), sub_text, font=sub_font)
        sub_w = s_bbox[2] - s_bbox[0]
        sub_h = s_bbox[3] - s_bbox[1]
    except AttributeError:
        text_w, text_h = draw.textsize(text, font=font)
        sub_w, sub_h = draw.textsize(sub_text, font=sub_font)

    padding_x = 24
    padding_y = 14
    
    max_w = max(text_w, sub_w)
    tag_w = max_w + padding_x * 2
    tag_h = text_h + sub_h + padding_y * 2 + 6
    
    rx1 = tx - tag_w // 2
    ry1 = ty - tag_h // 2
    rx2 = tx + tag_w // 2
    ry2 = ty + tag_h // 2
    
    # Draw container with Netflix-style sharp corners and near-opaque background
    bg_color = (15, 15, 15, 230)
    draw.rounded_rectangle([rx1, ry1, rx2, ry2], radius=4, fill=bg_color, outline=(255, 255, 255, 40), width=1)
    
    # Draw Netflix-style progress bar at the bottom
    bar_height = 3
    draw.rectangle([rx1, ry2 - bar_height, rx2, ry2], fill=accent_color)
    
    # Draw texts
    tx_start = rx1 + padding_x
    ty1 = ry1 + padding_y
    draw.text((tx_start, ty1), text, font=font, fill=(255, 255, 255, 255))
    
    ty2 = ty1 + text_h + 6
    draw.text((tx_start, ty2), sub_text, font=sub_font, fill=accent_color)

# Composite and save
final_img = Image.alpha_composite(img_widescreen, overlay).convert("RGB")
final_img.save(dst_image_path, "PNG")
print(f"Saved widescreen modified image to Desktop: {dst_image_path}")

os.makedirs(artifact_dir, exist_ok=True)
final_img.save(artifact_image_path, "PNG")
print(f"Saved widescreen modified image to Artifacts: {artifact_image_path}")
