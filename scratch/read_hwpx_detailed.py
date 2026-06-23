import sys
import zipfile
import xml.etree.ElementTree as ET
import os

if sys.platform.startswith('win'):
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

hwpx_path = r"d:\Desktop\공약제안 사업계획서(보건행정과)_1. AI 메디헬스 센터(가칭) 조성 계획_최종4.hwpx"

try:
    with zipfile.ZipFile(hwpx_path, 'r') as z:
        namelist = z.namelist()
        sections = [name for name in namelist if 'Contents/section' in name and name.endswith('.xml')]
        sections.sort()
        
        for section in sections:
            xml_content = z.read(section)
            root = ET.fromstring(xml_content)
            
            # Let's print paragraph by paragraph, look for target words
            paragraph_text = []
            for elem in root.iter():
                if elem.tag.endswith('}t') and elem.text:
                    paragraph_text.append(elem.text)
                elif elem.tag.endswith('}p'):
                    if paragraph_text:
                        full_line = "".join(paragraph_text)
                        if any(kw in full_line for kw in ["국비", "시비", "구비", "재원", "비율", "850"]):
                            print("LINE:", full_line)
                        paragraph_text = []
            if paragraph_text:
                full_line = "".join(paragraph_text)
                if any(kw in full_line for kw in ["국비", "시비", "구비", "재원", "비율", "850"]):
                    print("LINE:", full_line)
except Exception as e:
    print("Error:", e)
