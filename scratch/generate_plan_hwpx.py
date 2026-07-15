import zipfile
import os
import shutil
import xml.etree.ElementTree as ET
import copy
import sys

# Configure UTF-8 stdout
sys.stdout.reconfigure(encoding='utf-8')

hwpx_path = r"d:\Desktop\서울체력장 강남센터, 체력 측정 장비 구매 계획.hwpx"
backup_path = hwpx_path + ".bak"
temp_dir = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\temp_plan_hwpx"

# 1. Backup & Restore logic
if os.path.exists(backup_path):
    shutil.copyfile(backup_path, hwpx_path)
    print("Restored original HWPX from backup.")
else:
    shutil.copyfile(hwpx_path, backup_path)
    print("Created backup of HWPX file.")

# 2. Clean temp dir
if os.path.exists(temp_dir):
    shutil.rmtree(temp_dir)
os.makedirs(temp_dir)

try:
    # Extract
    with zipfile.ZipFile(hwpx_path, 'r') as z:
        z.extractall(temp_dir)
    print("Extracted HWPX to temp directory.")
    
    ET.register_namespace('hp', 'http://www.hancom.co.kr/hwpml/2011/paragraph')
    ET.register_namespace('hs', 'http://www.hancom.co.kr/hwpml/2011/section')
    ET.register_namespace('hc', 'http://www.hancom.co.kr/hwpml/2011/core')
    
    section_xml_path = os.path.join(temp_dir, "Contents", "section0.xml")
    tree = ET.parse(section_xml_path)
    root = tree.getroot()
    
    ns = {
        'hp': 'http://www.hancom.co.kr/hwpml/2011/paragraph',
        'hs': 'http://www.hancom.co.kr/hwpml/2011/section',
        'hc': 'http://www.hancom.co.kr/hwpml/2011/core'
    }
    
    p_elements = root.findall('.//hp:p', ns)
    print("Found total paragraphs:", len(p_elements))
    
    # We want to find the paragraph that contains "강남체력인증센터 추진 계획" (under 추진근거)
    target_p_idx = -1
    for idx, p in enumerate(p_elements):
        t_texts = [t.text for t in p.findall('.//hp:t', ns) if t.text]
        combined = "".join(t_texts)
        if "강남체력인증센터 추진 계획" in combined:
            target_p_idx = idx
            break
            
    if target_p_idx == -1:
        print("Could not find reference paragraph for '추진근거'.")
        # Find index of "추진근거" label cell and append there
        for idx, p in enumerate(p_elements):
            t_texts = [t.text for t in p.findall('.//hp:t', ns) if t.text]
            combined = "".join(t_texts)
            if "추진근거" in combined:
                target_p_idx = idx
                break
                
    if target_p_idx != -1:
        print(f"Target paragraph found at index {target_p_idx}.")
        
        # Style models to copy
        # We can copy the target paragraph itself as base style
        p_model = p_elements[target_p_idx]
        
        def create_custom_p(text):
            new_p = copy.deepcopy(p_model)
            # Remove any existing ids or adjust attributes to prevent duplicate IDs
            new_p.attrib.pop('id', None)
            
            # Find and replace text
            t_elems = new_p.findall('.//hp:t', ns)
            if t_elems:
                t_elems[0].text = text
                # Remove extra <hp:t> siblings to avoid duplicated text
                for extra_t in t_elems[1:]:
                    for r in new_p.findall('.//hp:run', ns):
                        if extra_t in r:
                            r.remove(extra_t)
            return new_p

        # We will insert new paragraphs right after target_p_idx in the parent container
        parent_map = {c: p for p in root.iter() for c in p}
        parent_container = parent_map.get(p_model)
        
        if parent_container is not None:
            insert_idx = list(parent_container).index(p_model) + 1
            
            new_paragraphs_data = [
                "▢ 법령 및 조례적 추진 근거",
                "  - 「지역보건법」 제11조(보건소의 기능 및 업무) 제1항 제5호 (국민건강증진 및 영양관리 등)",
                "  - 「국민체육진흥법」 제15조(체력인증 등) 및 동법 시행령 제16조",
                "  - 「서울특별시 강남구 구민체육진흥에 관한 조례」 제4조(사업 및 재정지원)",
                "  - 「서울특별시 강남구 보건소 수가 조례」 제3조"
            ]
            
            # Insert in order by reversing so they end up in the correct visual sequence
            for text in reversed(new_paragraphs_data):
                new_p = create_custom_p(text)
                parent_container.insert(insert_idx, new_p)
                
            print(f"Successfully inserted {len(new_paragraphs_data)} legal grounds paragraphs after index {target_p_idx}.")
        else:
            print("Error: Parent container of target paragraph not found.")
            
    # Write back XML
    tree.write(section_xml_path, encoding='utf-8', xml_declaration=True)
    print("Wrote updated section0.xml.")
    
    # Zip back
    if os.path.exists(hwpx_path):
        os.remove(hwpx_path)
        
    with zipfile.ZipFile(hwpx_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for root_dir, dirs, files in os.walk(temp_dir):
            for file in files:
                full_path = os.path.join(root_dir, file)
                rel_path = os.path.relpath(full_path, temp_dir)
                z.write(full_path, rel_path)
    print(f"Successfully updated HWPX: {hwpx_path}")
    
except Exception as e:
    print("Error during execution:", e)
finally:
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
        print("Cleaned up temp directory.")
