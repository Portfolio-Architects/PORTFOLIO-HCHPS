import os
from PIL import Image, ImageDraw, ImageFont

# 1. Paths
conv_dir = r"C:\Users\user\.gemini\antigravity\brain\61d68437-51ca-4089-989c-ec5574b9e9b2"
uploaded_image_path = os.path.join(conv_dir, "media__1781251142198.jpg")

# Output paths for Version 1 (Direct pixel flip)
version1_output_path = os.path.join(conv_dir, "bottom_flipped_direct.png")

# High-res source image for Version 2 (Clean re-render)
src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"
version2_highres_output = r"D:\Desktop\AI 스포츠_메디컬_트레이닝 센터_45도 사선구도_통사각_실사진_현판_1920x1080_하단반전.png"
version2_preview_output = os.path.join(conv_dir, "bottom_flipped_clean.png")

# Ensure output directories exist
os.makedirs(conv_dir, exist_ok=True)

# ----------------- VERSION 1: Direct Pixel Flip -----------------
if os.path.exists(uploaded_image_path):
    img_uploaded = Image.open(uploaded_image_path)
    w_up, h_up = img_uploaded.size
    mid_y_up = h_up // 2  # 288
    
    # Crop bottom half, flip, paste back
    bottom_half_up = img_uploaded.crop((0, mid_y_up, w_up, h_up))
    bottom_flipped_up = bottom_half_up.transpose(Image.FLIP_LEFT_RIGHT)
    
    img_v1 = img_uploaded.copy()
    img_v1.paste(bottom_flipped_up, (0, mid_y_up))
    img_v1.save(version1_output_path)
    print(f"[Version 1] Direct pixel flip saved to: {version1_output_path}")
else:
    print(f"Uploaded image not found at: {uploaded_image_path}")

# ----------------- VERSION 2: Clean Re-Render -----------------
if os.path.exists(src_image_path):
    # Load 1024x1024 base image
    img_orig = Image.open(src_image_path)
    width, height = img_orig.size # 1024x1024
    
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
    
    # Create the background with bottom half flipped horizontally
    # In 1920x1080, middle point is y = 540
    img_background = img_widescreen.copy()
    bottom_half_bg = img_widescreen.crop((0, 540, 1920, 1080))
    bottom_flipped_bg = bottom_half_bg.transpose(Image.FLIP_LEFT_RIGHT)
    img_background.paste(bottom_flipped_bg, (0, 540))
    
    # Create transparent overlay layer for text labels
    overlay = Image.new("RGBA", img_background.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    
    # Setup Font (26px)
    font_path = r"C:\Windows\Fonts\malgunbd.ttf"
    if not os.path.exists(font_path):
        font_path = r"C:\Windows\Fonts\malgun.ttf"
    if not os.path.exists(font_path):
        font = ImageFont.load_default()
    else:
        font = ImageFont.truetype(font_path, 26)
        
    # Define zones with re-positioned bottom half labels
    # Symmetrical horizontal mirror for Zone 2 and Zone 3
    zones = [
        {
            'text': "1. 대사증후군 측정 및 상담",
            'accent_color': (34, 197, 94, 255),  # Green
            'tag_center': (300, 160),
            'point_to': (220, 320)
        },
        {
            'text': "2. 서울체력장",
            'accent_color': (20, 184, 166, 255),  # Teal
            'tag_center': (940, 480),             # Mirrored (originally 980, now 1920 - 980 = 940)
            'point_to': (1170, 700)               # Mirrored (originally 750, now 1920 - 750 = 1170)
        },
        {
            'text': "3. 헬스체크업",
            'accent_color': (245, 158, 11, 255),  # Amber
            'tag_center': (500, 460),             # Mirrored (originally 1420, now 1920 - 1420 = 500)
            'point_to': (600, 720)                # Mirrored (originally 1320, now 1920 - 1320 = 600)
        },
        {
            'text': "4. AI 스마트짐",
            'accent_color': (59, 130, 246, 255),  # Blue
            'tag_center': (1300, 120),
            'point_to': (1300, 260)
        }
    ]
    
    # Draw signboards
    for zone in zones:
        text = zone['text']
        accent_color = zone['accent_color']
        tx, ty = zone['tag_center']
        px, py = zone['point_to']
        
        # Indicator line
        draw.line([tx, ty, px, py], fill=(255, 255, 255, 140), width=2)
        
        # Target dot
        r = 7
        draw.ellipse([px - r, py - r, px + r, py + r], fill=accent_color, outline=(255, 255, 255, 220), width=2)
        draw.ellipse([px - 2, py - 2, px + 2, py + 2], fill=(255, 255, 255, 255))
        
        # Measure text
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
        
        # Container background
        bg_color = (15, 23, 42, 210)
        draw.rounded_rectangle([rx1, ry1, rx2, ry2], radius=12, fill=bg_color, outline=(255, 255, 255, 90), width=2)
        
        # Accent dot
        dot_x = rx1 + padding_x + dot_radius
        dot_y = ty
        draw.ellipse([dot_x - dot_radius, dot_y - dot_radius, dot_x + dot_radius, dot_y + dot_radius], fill=accent_color)
        
        # Text
        text_x = dot_x + dot_radius + dot_spacing
        text_y = ty - text_h // 2 - 2
        draw.text((text_x, text_y), text, font=font, fill=(255, 255, 255, 255))
        
    # Composite background and overlay
    final_img = Image.alpha_composite(img_background, overlay).convert("RGB")
    
    # Save Version 2 High-Res output to Desktop
    final_img.save(version2_highres_output, "PNG")
    print(f"[Version 2] Clean re-rendered high-res image saved to: {version2_highres_output}")
    
    # Save Version 2 Preview output (1024x576) to conversation folder
    preview_img = final_img.resize((1024, 576), Image.Resampling.LANCZOS)
    preview_img.save(version2_preview_output)
    print(f"[Version 2] Clean preview image saved to: {version2_preview_output}")
else:
    print(f"Source image not found at: {src_image_path}")
