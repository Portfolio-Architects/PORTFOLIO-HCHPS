import zipfile
import xml.etree.ElementTree as ET
import re

hwpx_path = r"d:\Desktop\서울체력장 강남센터, 체력 측정 장비 구매 계획.hwpx"

try:
    with zipfile.ZipFile(hwpx_path, 'r') as z:
        namelist = z.namelist()
        section_files = [name for name in namelist if 'section' in name and name.endswith('.xml')]
        
        text_content = []
        for sec_file in section_files:
            xml_data = z.read(sec_file)
            root = ET.fromstring(xml_data)
            
            for elem in root.iter():
                if elem.tag.endswith('t') and elem.text:
                    text_content.append(elem.text)
                    
        full_text = "\n".join(text_content)
        
        with open(r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\hwpx_text_sample.txt", "w", encoding="utf-8") as f:
            f.write(full_text)
        print("Success: HWPX written successfully without stdout issues.")
            
except Exception as e:
    print(f"Error: {e}")
