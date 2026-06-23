import zipfile
import xml.etree.ElementTree as ET
import os

hwpx_path = r"D:\Desktop\공약제안 사업계획서(보건행정과)_1. AI 메디헬스 센터(가칭) 조성 계획_최종4.hwpx"
output_path = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\extracted_hwpx_final4.txt"

try:
    with zipfile.ZipFile(hwpx_path, 'r') as z:
        # Let's find all section files in Contents/
        section_files = sorted([name for name in z.namelist() if name.startswith("Contents/section") and name.endswith(".xml")])
        print(f"Found section files: {section_files}")
        
        paragraphs = []
        ns = {
            'hp': 'http://www.hancom.co.kr/hwpml/2011/paragraph',
            'hs': 'http://www.hancom.co.kr/hwpml/2011/section',
            'hc': 'http://www.hancom.co.kr/hwpml/2011/core'
        }
        
        for sf in section_files:
            xml_data = z.read(sf)
            root = ET.fromstring(xml_data)
            
            for p_elem in root.findall('.//hp:p', ns):
                p_text = []
                for t_elem in p_elem.findall('.//hp:t', ns):
                    if t_elem.text:
                        p_text.append(t_elem.text)
                combined = "".join(p_text).strip()
                if combined:
                    paragraphs.append(combined)
                else:
                    # Keep blank line if empty but inside section to preserve structure
                    paragraphs.append("")
                    
        with open(output_path, 'w', encoding='utf-8') as f:
            for p in paragraphs:
                f.write(p + "\n")
        
        print(f"Extracted {len(paragraphs)} paragraphs, saved to {output_path}")
except Exception as e:
    print(f"Error: {e}")
