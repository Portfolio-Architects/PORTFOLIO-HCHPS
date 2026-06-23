import sys
import os
import zipfile
import re
import xml.etree.ElementTree as ET

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

# Extract two files
txt2025 = parse_hwpx(r'd:\Desktop\2025년 심뇌혈관질환 예방관리사업 결과보고.hwpx')
with open(r'd:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\2025_report.txt', 'w', encoding='utf-8') as f:
    f.write(txt2025)

txt2026 = parse_hwpx(r'd:\Desktop\2026년 심뇌혈관질환 예방관리사업 계획.hwpx')
with open(r'd:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\2026_plan.txt', 'w', encoding='utf-8') as f:
    f.write(txt2026)

print("Extraction completed!")
