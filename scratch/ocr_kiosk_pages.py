import os
import sys
import google.generativeai as genai
from PIL import Image

# Read API Key from .env.local
api_key = None
env_path = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.env.local"
if os.path.exists(env_path):
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.startswith("GOOGLE_GEMINI_API_KEY="):
                api_key = line.split("=")[1].strip()
                break

if not api_key:
    print("API Key not found in .env.local")
    sys.exit(1)

genai.configure(api_key=api_key)
# gemini-2.5-flash is stable and fast for OCR tasks
model = genai.GenerativeModel('gemini-2.5-flash')

img_dir = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\kiosk_pages"
pages = sorted([f for f in os.listdir(img_dir) if f.endswith(".png")])

output_file = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\kiosk_specs_ocr.txt"

try:
    with open(output_file, 'w', encoding='utf-8') as out_f:
        for page in pages:
            img_path = os.path.join(img_dir, page)
            print(f"Processing {page}...")
            img = Image.open(img_path)
            
            prompt = (
                "이 이미지는 KIOSK 기초체력평가시스템 규격서 페이지의 스캔본입니다. "
                "이미지에 표시된 모든 한글 및 영문 텍스트(표 내용, 사양서, 장비 이름, 수량, 성능 사양 등)를 "
                "원본의 레이아웃과 순서에 맞게 정확하게 텍스트로 추출해 주세요. "
                "표의 경우 가능한 한 마크다운 표(Markdown Table) 형식으로 정리하여 가독성을 높여 주시기 바랍니다."
            )
            
            response = model.generate_content([prompt, img])
            out_f.write(f"=== {page} ===\n")
            out_f.write(response.text)
            out_f.write("\n\n")
            print(f"Finished {page}.")
    print("Success: OCR process finished.")
except Exception as e:
    print(f"Error during OCR: {e}", file=sys.stderr)
