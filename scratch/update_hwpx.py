import zipfile
import os
import shutil
import xml.etree.ElementTree as ET
import copy

hwpx_path = r"D:\Desktop\공약제안 사업계획서(보건행정과)_1. AI 메디헬스 센터(가칭) 조성 계획_최종4.hwpx"
backup_path = hwpx_path + ".bak"
temp_dir = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\temp_hwpx"

# Restore from backup first to start clean
if os.path.exists(backup_path):
    shutil.copyfile(backup_path, hwpx_path)
    print("Restored original HWPX from backup.")
else:
    shutil.copyfile(hwpx_path, backup_path)
    print("Created backup of HWPX file.")

# Clean temp dir
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
    
    # Heading style model: index 171 (󰏚 향후 연계 계획(안))
    p_heading_model = copy.deepcopy(p_elements[171])
    # Subheading style model: index 192 (❍ 통합 센터 구축)
    p_subheading_model = copy.deepcopy(p_elements[192])
    # Item style model: index 213 (▪공공 PT 서비스 연계)
    p_item_model = copy.deepcopy(p_elements[213])
    
    def create_heading_p(text):
        new_p = copy.deepcopy(p_heading_model)
        # Update text
        t_elems = new_p.findall('.//hp:t', ns)
        if t_elems:
            t_elems[0].text = text
            for extra_t in t_elems[1:]:
                for r in new_p.findall('.//hp:run', ns):
                    if extra_t in r:
                        r.remove(extra_t)
        return new_p
        
    def create_subheading_p(text):
        new_p = copy.deepcopy(p_subheading_model)
        t_elems = new_p.findall('.//hp:t', ns)
        if t_elems:
            t_elems[0].text = text
            for extra_t in t_elems[1:]:
                for r in new_p.findall('.//hp:run', ns):
                    if extra_t in r:
                        r.remove(extra_t)
        return new_p
        
    def create_item_p(text):
        new_p = copy.deepcopy(p_item_model)
        t_elems = new_p.findall('.//hp:t', ns)
        if t_elems:
            t_elems[0].text = text
            for extra_t in t_elems[1:]:
                for r in new_p.findall('.//hp:run', ns):
                    if extra_t in r:
                        r.remove(extra_t)
        return new_p

    # Create new paragraphs
    new_ps = [
        create_item_p(""), # Spacer
        create_heading_p("󰏚 실질적 운영가능성 종합 검토 (수용능력 및 주차공간)"),
        
        create_subheading_p("❍ (단계별 추진 방법)"),
        create_item_p("  - 1단계(통합 공간 확보 전): 보건소 3층(약 200㎡)에서 헬스체크업, 대사증후군 센터, 신규 서울체력장 강남센터를 개별 운영하며 검진 데이터를 연계하고 AI 운동 처방 제공"),
        create_item_p("  - 2단계(통합 공간 확보 후): 보건소 4층 또는 5층(약 500㎡)에 공간 통합형 'AI 메디헬스센터'를 조성하여 자체 전산 시스템 구축 및 AI 활용 운동 처방 솔루션 가동"),
        
        create_subheading_p("❍ (수용능력 극복방안)"),
        create_item_p("  - '25년 이용자 총 8,544명(일 평균 36명)에서 '28년 일 평균 49명(연간 11,634명)으로 증가할 것으로 추산(일 평균 약 15명 증가)됨에 따라, 철저한 사전 예약제 시행으로 대기 시간 최소화 및 민원 분산 유도"),
        
        create_subheading_p("❍ (주차공간 해소방안)"),
        create_item_p("  - 보건소 총 주차 공간 41면 중 민원 주차는 12면(29%)에 불과하나, 지하철 강남구청역(7호선, 수인분당선) 도보 2분 거리로 접근성이 매우 우수한 점을 살려, 서비스 이용 시 대중교통 이용을 필수 사항으로 사전 안내하여 혼잡 방지")
    ]
    
    # We find the main {hs:sec} container
    # Since XML structure has hs:sec as root or main sub-child, let's find it.
    sec_container = root.find('.//{http://www.hancom.co.kr/hwpml/2011/section}sec')
    if sec_container is None and root.tag == '{http://www.hancom.co.kr/hwpml/2011/section}sec':
        sec_container = root
        
    if sec_container is not None:
        print(f"Found container: {sec_container.tag}")
        
        # Append our new paragraphs to the end of the container
        for new_p in new_ps:
            sec_container.append(new_p)
            
        print(f"Successfully appended {len(new_ps)} paragraphs to container.")
    else:
        print("Error: sec container not found.")
        
    # Write back section0.xml
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
