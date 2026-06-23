import os
from PIL import Image, ImageDraw, ImageFont

# Define paths
src_image_path = r"D:\Desktop\AI 스포츠_메디컬_트레이닝 센터_45도 사선구도_1920x1080.png"
dst_image_path1 = r"D:\Desktop\AI 스포츠_메디컬_트레이닝 센터_45도 사선구도_현판_1920x1080.png"
dst_image_path2 = r"D:\Desktop\AI 스포츠_메디컬_트레이닝 센터_45도 사선구도_현판_위치스왑_1920x1080.png"
artifact_dir = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e"
artifact_image_path = os.path.join(artifact_dir, "AI_sports_medical_center_signboards_1920x1080.png")

# Verify source image exists
if not os.path.exists(src_image_path):
    print(f"Error: Source image not found at {src_image_path}")
    exit(1)

# Load the original image (equipment is NOT swapped: treadmills on left, scanner on right)
img = Image.open(src_image_path).convert("RGBA")
width, height = img.size
print(f"Loaded image size: {width}x{height}")

# Create overlay layer for transparency
overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
draw = ImageDraw.Draw(overlay)

# Setup Font (26px)
font_path = r"C:\Windows\Fonts\malgunbd.ttf"  # Malgun Gothic Bold
if not os.path.exists(font_path):
    font_path = r"C:\Windows\Fonts\malgun.ttf"  # Fallback to regular
if not os.path.exists(font_path):
    font = ImageFont.load_default()
    print("Using default font")
else:
    font_size = 26
    font = ImageFont.truetype(font_path, font_size)
    print(f"Using Malgun Gothic font with size {font_size} from {font_path}")

# Original (Non-Swapped) signboard mapping:
# '체력측정' (Teal) at (980, 480) pointing to (750, 700) (treadmills on left)
# '헬스체크업' (Amber) at (1420, 460) pointing to (1320, 720) (scanner/track on right)
zones = [
    {
        'text': "대사증후군 측정 및 상담",
        'accent_color': (34, 197, 94, 255),  # Emerald green
        'tag_center': (300, 160),
        'point_to': (220, 320)
    },
    {
        'text': "AI 스마트짐",
        'accent_color': (59, 130, 246, 255),  # Blue
        'tag_center': (1300, 120),
        'point_to': (1300, 260)
    },
    {
        'text': "체력측정",
        'accent_color': (20, 184, 166, 255),  # Teal
        'tag_center': (980, 480),
        'point_to': (750, 700)
    },
    {
        'text': "헬스체크업",
        'accent_color': (245, 158, 11, 255),  # Amber/Orange
        'tag_center': (1420, 460),
        'point_to': (1320, 720)
    }
]

# Draw each signboard
for zone in zones:
    text = zone['text']
    accent_color = zone['accent_color']
    tx, ty = zone['tag_center']
    px, py = zone['point_to']

    # 1. Draw thin indicator line and dots
    line_color = (255, 255, 255, 140)
    draw.line([tx, ty, px, py], fill=line_color, width=2)
    
    # Draw a small circle at the target point
    r = 7
    draw.ellipse([px - r, py - r, px + r, py + r], fill=accent_color, outline=(255, 255, 255, 220), width=2)
    
    # Draw a smaller center dot at the target point
    draw.ellipse([px - 2, py - 2, px + 2, py + 2], fill=(255, 255, 255, 255))

    # 2. Draw the signboard tag
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
    
    # Tag bounding box
    rx1 = tx - tag_w // 2
    ry1 = ty - tag_h // 2
    rx2 = tx + tag_w // 2
    ry2 = ty + tag_h // 2
    
    # Draw tag background (dark semi-transparent slate)
    bg_color = (15, 23, 42, 210)  # Slate-900 with ~82% opacity
    draw.rounded_rectangle([rx1, ry1, rx2, ry2], radius=12, fill=bg_color, outline=(255, 255, 255, 90), width=2)
    
    # Draw accent dot inside the tag
    dot_x = rx1 + padding_x + dot_radius
    dot_y = ty
    draw.ellipse([dot_x - dot_radius, dot_y - dot_radius, dot_x + dot_radius, dot_y + dot_radius], fill=accent_color)
    
    # Draw text
    text_x = dot_x + dot_radius + dot_spacing
    text_y = ty - text_h // 2 - 2
    draw.text((text_x, text_y), text, font=font, fill=(255, 255, 255, 255))

# Composite the overlay onto the original image
final_img = Image.alpha_composite(img, overlay).convert("RGB")

# Save the outputs
final_img.save(dst_image_path1, "PNG")
final_img.save(dst_image_path2, "PNG")
print(f"Saved modified image to Desktop: {dst_image_path1} and {dst_image_path2}")

# Ensure artifact directory exists
os.makedirs(artifact_dir, exist_ok=True)
final_img.save(artifact_image_path, "PNG")
print(f"Saved modified image to Artifacts: {artifact_image_path}")
