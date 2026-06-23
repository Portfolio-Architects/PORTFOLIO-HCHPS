import sys
import os
import fitz # PyMuPDF
import itertools
import zipfile
import re
import xml.etree.ElementTree as ET

def parse_pdf(file_path):
    try:
        doc = fitz.open(file_path)
        text = []
        for page in doc:
            words = page.get_text('words')
            words.sort(key=lambda w: (round(w[3]/5), w[0]))
            for k, g in itertools.groupby(words, key=lambda w: round(w[3]/5)):
                line = ' '.join(w[4] for w in sorted(g, key=lambda w: w[0]))
                text.append(line)
        return '\n'.join(text)
    except Exception as e:
        return f"PDF 파싱 오류: {str(e)}"

def parse_hwpx(file_path):
    try:
        text_content = []
        with zipfile.ZipFile(file_path, 'r') as zf:
            sections = [f for f in zf.namelist() if f.startswith('Contents/section') and f.endswith('.xml')]
            sections.sort()
            for section in sections:
                xml_data = zf.read(section)
                try:
                    root = ET.fromstring(xml_data)
                    text_parts = []
                    for elem in root.iter():
                        if elem.text and elem.tag.endswith('t'):
                            text_parts.append(elem.text)
                    if text_parts:
                        text_content.append(' '.join(text_parts))
                except Exception:
                    decoded = xml_data.decode('utf-8', errors='ignore')
                    cleaned = re.sub(r'<[^>]+>', ' ', decoded)
                    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
                    text_content.append(cleaned)
        return '\n'.join(text_content)
    except Exception as e:
        return f"HWPX 파싱 오류: {str(e)}"

# Extract
print("Extracting previous placement plan...")
txt1 = parse_pdf(r'd:\Desktop\VITAL_Scan\20260401_보건소 건강증진지원실 이전 배치 계획.pdf')
with open(r'd:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\previous_placement_plan.txt', 'w', encoding='utf-8') as f:
    f.write(txt1)

print("Extracting medi sports center plan...")
txt2 = parse_hwpx(r'd:\Desktop\VITAL_Scan\20260604_메디 스포츠(Medi-Sports), AI 신체활동 센터.hwpx')
with open(r'd:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\medi_sports_plan.txt', 'w', encoding='utf-8') as f:
    f.write(txt2)

print("Extracting seoul fitness standard...")
txt3 = parse_hwpx(r'd:\Desktop\VITAL_Scan\서울체력장(서울형 체력기준안).hwpx')
with open(r'd:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\seoul_fitness_standard.txt', 'w', encoding='utf-8') as f:
    f.write(txt3)

print("Done!")
