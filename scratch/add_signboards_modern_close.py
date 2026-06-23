import os
from PIL import Image, ImageDraw, ImageFont

# Define paths
src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"
dst_image_path = r"D:\Desktop\AI 스포츠_메디컬_트레이닝 센터_45도 사선구도_실사진_현판_모던_1920x1080.png"
artifact_dir = r"C:\Users\user\.gemini\antigravity\brain\bdfeb9bb-6a3d-46bf-9590-3d6351385614"
artifact_image_path = os.path.join(artifact_dir, "AI_sports_medical_center_signboards_modern_close.png")
preview_image_path = os.path.join(artifact_dir, "media__1781252444253.jpg")

# Verify source image exists
if not os.path.exists(src_image_path):
    print(f"Error: Source image not found at {src_image_path}")
    exit(1)

# Load the image (1024x1024)
img_orig = Image.open(src_image_path)
width, height = img_orig.size

# 16:9 crop from center to match widescreen (1024x576)
new_width = width
new_height = int(width * 9 / 16) # 576
left = 0
top = (height - new_height) // 2 # 224
right = width
bottom = top + new_height # 800

cropped = img_orig.crop((left, top, right, bottom))
# Resize to 1920x1080
img_widescreen = cropped.resize((1920, 1080), Image.Resampling.LANCZOS).convert("RGBA")

# Create transparent overlay layer for text labels
overlay = Image.new("RGBA", img_widescreen.size, (0, 0, 0, 0))
draw = ImageDraw.Draw(overlay)

# Setup Font (28px Bold)
font_path = r"C:\Windows\Fonts\malgunbd.ttf"
if not os.path.exists(font_path):
    font_path = r"C:\Windows\Fonts\malgun.ttf"
if not os.path.exists(font_path):
    font_bold = ImageFont.load_default()
else:
    font_size = 28
    font_bold = ImageFont.truetype(font_path, font_size)

# Setup modern close coordinates and name update
zones = [
    {
        'text': "1. 대사증후군 측정 및 상담",
        'accent_color': (34, 197, 94, 255),  # Green
        'tag_center': (250, 270),
        'point_to': (220, 320)
    },
    {
        'text': "2. 서울체력장",
        'accent_color': (20, 184, 166, 255),  # Teal
        'tag_center': (800, 630),
        'point_to': (750, 700)
    },
    {
        'text': "3. 헬스체크업",
        'accent_color': (245, 158, 11, 255),  # Amber
        'tag_center': (1350, 650),
        'point_to': (1320, 720)
    },
    {
        'text': "4. 스마트 짐",
        'accent_color': (59, 130, 246, 255),  # Blue
        'tag_center': (1300, 210),
        'point_to': (1300, 260)
    }
]

def draw_glowing_line(draw, pt1, pt2, color, width=2):
    # Draw glow
    for i in range(4):
        alpha = 50 - i*12
        draw.line([pt1, pt2], fill=(color[0], color[1], color[2], alpha), width=width + i*4)
    # Core line
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

# Draw signboards
for zone in zones:
    text = zone['text']
    accent_color = zone['accent_color']
    tx, ty = zone['tag_center']
    px, py = zone['point_to']
    
    # Target dot with glow
    r = 6
    for i in range(3):
        glow_r = r + 2 + i*3
        draw.ellipse([px - glow_r, py - glow_r, px + glow_r, py + glow_r], fill=(accent_color[0], accent_color[1], accent_color[2], 50 - i*15))
    draw.ellipse([px - r, py - r, px + r, py + r], fill=accent_color)
    draw.ellipse([px - 2, py - 2, px + 2, py + 2], fill=(255, 255, 255, 255))
    
    # Glowing line (covered by tag at tag_center)
    draw_glowing_line(draw, (tx, ty), (px, py), accent_color, width=2)
    
    # Modern Glassmorphic Tag Card
    draw_modern_tag(draw, tx, ty, text, accent_color)

# Composite overlay on background
final_img = Image.alpha_composite(img_widescreen, overlay).convert("RGB")

# Save outputs
os.makedirs(artifact_dir, exist_ok=True)
final_img.save(dst_image_path, "PNG")
final_img.save(artifact_image_path, "PNG")

# Overwrite preview image (1024x576) to update user's chat preview
preview_img = final_img.resize((1024, 576), Image.Resampling.LANCZOS)
preview_img.save(preview_image_path, "JPEG")

print("Successfully generated and saved modern close-contact signboards rendering!")
