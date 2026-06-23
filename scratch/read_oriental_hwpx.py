import zipfile
import xml.etree.ElementTree as ET
import os

hwpx_path = r"D:\Desktop\1.공약검토 양식 (경로당 한의사 주치의 제도 도입).hwpx"
output_path = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\extracted_hwpx_oriental.txt"

try:
    with zipfile.ZipFile(hwpx_path, 'r') as z:
        section_files = sorted([name for name in z.namelist() if name.startswith("Contents/section") and name.endswith(".xml")])
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
                paragraphs.append(combined)
        with open(output_path, 'w', encoding='utf-8') as f:
            for p in paragraphs:
                f.write(p + "\n")
        print(f"Extracted {len(paragraphs)} paragraphs, saved to {output_path}")
except Exception as e:
    print(f"Error: {e}")
