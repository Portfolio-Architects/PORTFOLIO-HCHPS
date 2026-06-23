from PIL import Image

src_path = "C:/Users/user/.gemini/antigravity/brain/f27721f9-e653-4960-aee5-7b1cd30ff566/sports_interior_eyelevel_1781163187569.png"
dst_path = "D:/Desktop/AI \uc2a4\ud3ec\uce20_\uba54\ub514\uceec_\ud2b8\ub808\uc774\ub2dd \uc13c\ud130_\ub0b4\ubd80\ud22c\uc2dc\ub3c4_\uce5c\uc1a1_1920x1080.png" # AI 스포츠_메디컬_트레이닝 센터_내부투시도_최종_1920x1080.png

img = Image.open(src_path)
width, height = img.size

# 16:9 crop
new_width = width
new_height = int(width * 9 / 16)

left = 0
top = (height - new_height) // 2
right = width
bottom = top + new_height

cropped_img = img.crop((left, top, right, bottom))
resized_img = cropped_img.resize((1920, 1080), Image.Resampling.LANCZOS)
resized_img.save("D:/Desktop/AI \uc2a4\ud3ec\uce20_\uba54\ub514\uceec_\ud2b8\ub808\uc774\ub2dd \uc13c\ud130_\ub0b4\ubd80\ud22c\uc2dc\ub3c4_\ucd5c\uc885_1920x1080.png".encode('utf-8').decode('utf-8'), "PNG")
print("Process completed successfully!")
