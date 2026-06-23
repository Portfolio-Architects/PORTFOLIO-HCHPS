import sys
import zipfile
import xml.etree.ElementTree as ET
import os

if sys.platform.startswith('win'):
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

if len(sys.argv) < 2:
    print("Usage: python read_hwpx.py <file_path>")
    exit(1)

hwpx_path = sys.argv[1]

if not os.path.exists(hwpx_path):
    print("File not found:", hwpx_path)
    exit(1)

try:
    with zipfile.ZipFile(hwpx_path, 'r') as z:
        namelist = z.namelist()
        sections = [name for name in namelist if 'Contents/section' in name and name.endswith('.xml')]
        sections.sort()
        
        for section in sections:
            print(f"\n=== {section} ===")
            xml_content = z.read(section)
            root = ET.fromstring(xml_content)
            
            paragraph_text = []
            for elem in root.iter():
                # Extract text from text run element (usually ends with }t)
                if elem.tag.endswith('}t') and elem.text:
                    paragraph_text.append(elem.text)
                elif elem.tag.endswith('}p'):
                    if paragraph_text:
                        print("".join(paragraph_text))
                        paragraph_text = []
            if paragraph_text:
                print("".join(paragraph_text))
except Exception as e:
    print("Error:", e)
