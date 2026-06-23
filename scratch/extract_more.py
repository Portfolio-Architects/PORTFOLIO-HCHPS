import sys
import os
import fitz # PyMuPDF
import itertools

def parse_pdf(file_path):
    try:
        doc = fitz.open(file_path)
        text = []
        for page in doc:
            words = page.get_text('words')
            # sort by vertical line (rounded by 5) then horizontal position
            words.sort(key=lambda w: (round(w[3]/5), w[0]))
            for k, g in itertools.groupby(words, key=lambda w: round(w[3]/5)):
                line = ' '.join(w[4] for w in sorted(g, key=lambda w: w[0]))
                text.append(line)
        return '\n'.join(text)
    except Exception as e:
        return f"PDF 파싱 오류: {str(e)}"

# Extract
pdf_path_1 = r'd:\Desktop\VITAL_Scan\20250701_건강증진지원실 운영 활성화 계획.pdf'
pdf_path_2 = r'd:\Desktop\VITAL_Scan\20260501_건강증진팀 업무분장(2026. 5. 1.字).pdf'

print("Extracting health promotion plan...")
txt1 = parse_pdf(pdf_path_1)
with open(r'd:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\health_promotion_plan.txt', 'w', encoding='utf-8') as f:
    f.write(txt1)

print("Extracting business role distribution...")
txt2 = parse_pdf(pdf_path_2)
with open(r'd:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\team_roles.txt', 'w', encoding='utf-8') as f:
    f.write(txt2)

print("Done!")
