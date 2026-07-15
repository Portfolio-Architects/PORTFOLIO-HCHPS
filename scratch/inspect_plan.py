import zipfile
import xml.etree.ElementTree as ET
import os
import sys

# Configure UTF-8 stdout
sys.stdout.reconfigure(encoding='utf-8')

hwpx_path = r"d:\Desktop\서울체력장 강남센터, 체력 측정 장비 구매 계획.hwpx"

if not os.path.exists(hwpx_path):
    print("File not found:", hwpx_path)
    exit()

try:
    with zipfile.ZipFile(hwpx_path, 'r') as z:
        section_xml = z.read("Contents/section0.xml")
        root = ET.fromstring(section_xml)
        
        ns = {
            'hp': 'http://www.hancom.co.kr/hwpml/2011/paragraph',
            'hs': 'http://www.hancom.co.kr/hwpml/2011/section',
            'hc': 'http://www.hancom.co.kr/hwpml/2011/core'
        }
        
        p_elements = root.findall('.//hp:p', ns)
        print("Total paragraphs:", len(p_elements))
        
        # Print paragraphs with text
        for idx, p in enumerate(p_elements):
            t_texts = [t.text for t in p.findall('.//hp:t', ns) if t.text]
            combined_text = "".join(t_texts).strip()
            
            paraPrIDRef = p.attrib.get('paraPrIDRef', 'None')
            styleIDRef = p.attrib.get('styleIDRef', 'None')
            
            if combined_text:
                print(f"Index: {idx} | ParaPrIDRef: {paraPrIDRef} | StyleIDRef: {styleIDRef} | Text: {combined_text[:100]}")
except Exception as e:
    print("Error:", e)
