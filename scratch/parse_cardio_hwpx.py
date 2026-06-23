import zipfile
import os
import xml.etree.ElementTree as ET
import re

def extract_text_from_section_xml(xml_content):
    xml_content = re.sub(r'xmlns="[^"]+"', '', xml_content)
    xml_content = re.sub(r'xmlns:[^=]+="[^"]+"', '', xml_content)
    
    texts = re.findall(r'<h[ps]:t.*?>(.*?)</h[ps]:t>', xml_content, re.DOTALL)
    if not texts:
        texts = re.findall(r'<t.*?>(.*?)</t>', xml_content, re.DOTALL)
    
    clean_texts = []
    for t in texts:
        clean = re.sub(r'<[^>]+>', '', t)
        clean = clean.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&').replace('&quot;', '"').replace('&apos;', "'")
        clean_texts.append(clean)
    
    if not clean_texts:
        try:
            root = ET.fromstring(xml_content)
            clean_texts = [elem.text for elem in root.iter() if elem.text]
        except Exception as e:
            clean_texts = re.findall(r'>([^<]+)<', xml_content)
            
    return "\n".join([t.strip() for t in clean_texts if t.strip()])

def extract_hwpx_text(zip_path):
    print(f"--- Extracting {os.path.basename(zip_path)} ---")
    try:
        with zipfile.ZipFile(zip_path, 'r') as z:
            sections = sorted([name for name in z.namelist() if 'Contents/section' in name])
            all_text = []
            for sec in sections:
                with z.open(sec) as f:
                    xml_data = f.read().decode('utf-8', errors='ignore')
                    all_text.append(extract_text_from_section_xml(xml_data))
            return "\n\n".join(all_text)
    except Exception as e:
        return f"Error: {e}"

desktop_path = r"d:\Desktop"
cardio_files = [
    "2025년 심뇌혈관질환 예방관리사업 결과보고.hwpx",
    "2026년 심뇌혈관질환 예방관리사업 계획.hwpx"
]

for f_name in cardio_files:
    path = os.path.join(desktop_path, f_name)
    if os.path.exists(path):
        text = extract_hwpx_text(path)
        out_path = os.path.join(os.path.dirname(__file__), f_name.replace('.hwpx', '_extracted.txt'))
        with open(out_path, 'w', encoding='utf-8') as out_f:
            out_f.write(text)
        print(f"Saved extracted text to {out_path} (length: {len(text)})")
    else:
        print(f"File not found: {path}")
