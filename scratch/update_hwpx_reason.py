import zipfile
import os
import shutil
import xml.etree.ElementTree as ET
import sys

def has_ctrl_objects(p_node, ns):
    # 문단 하위에 표(tbl), 상자(box), 그림(picture) 등 레이아웃 오브젝트가 있는지 검사
    tbls = p_node.findall('.//hp:tbl', ns)
    if tbls:
        return True
    for elem in p_node.iter():
        tag_local = elem.tag.split('}')[-1]
        if tag_local in ['tbl', 'box', 'picture', 'equation', 'shape', 'container']:
            return True
    return False

def update_hwpx_reason():
    sys.stdout.reconfigure(encoding='utf-8')
    
    template_path = r"d:\Desktop\서울체력장 강남센터 조성에 따른 체력측정 장비 구매를 위한 예산 전용 계획.hwpx"
    output_path = r"d:\Desktop\서울체력장 강남센터 조성에 따른 체력측정 장비 구매를 위한 예산 전용 계획_수정.hwpx"
    temp_dir = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\temp_update_reason"
    
    if not os.path.exists(template_path):
        print(f"Error: Template file not found at {template_path}")
        return
        
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    os.makedirs(temp_dir)
    
    try:
        # HWPX 복사
        shutil.copyfile(template_path, output_path)
        print(f"Copied template to {output_path}")
        
        # 압축 해제
        with zipfile.ZipFile(output_path, 'r') as z:
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
        print(f"Found {len(p_elements)} paragraphs in template.")
        
        # 하위에 드로잉/테이블 오브젝트를 가지지 않는 말단 문단만 필터링
        # (테이블 셀 내부의 텍스트 문단 등은 여기에 포함됨)
        direct_p_nodes = []
        for p in p_elements:
            if not has_ctrl_objects(p, ns):
                direct_p_nodes.append(p)
                
        print(f"Filtered {len(direct_p_nodes)} leaf plain text paragraphs.")
        
        updated_count = 0
        
        for p in direct_p_nodes:
            # 말단 문단이므로 p 내부의 모든 hp:t를 가져옴
            t_nodes = p.findall('.//hp:t', ns)
            if not t_nodes:
                continue
                
            combined_text = "".join(t.text for t in t_nodes if t.text)
            
            # 매칭 대상 감지
            is_matched = False
            new_text = ""
            
            # 1. 첫 번째 사유 문장 (간주예산 단가 과소 산출)
            if "2차 간주예산" in combined_text and "과소 산출" in combined_text:
                is_matched = True
                if combined_text.strip().startswith("-"):
                    new_text = "- 서울체력장 강남센터는 2026년 신규 사업으로, 기존 국민체력100 사업에서 서울체력장 사업으로 전환됨에 따라 측정 항목 및 도입 대상 장비 규격이 전면 변경됨"
                else:
                    new_text = "○ 서울체력장 강남센터는 2026년 신규 사업으로, 기존 국민체력100 사업에서 서울체력장 사업으로 전환됨에 따라 측정 항목 및 도입 대상 장비 규격이 전면 변경됨"
            
            # 2. 두 번째 사유 문장 (서울시 전산 연동 등)
            elif ("서울시 전산 시스템" in combined_text and "전용 추진" in combined_text) or ("계약 갱신에 따른 사업 중단 우려" in combined_text):
                is_matched = True
                if combined_text.strip().startswith("-"):
                    new_text = "- 당초 계획 대비 실제 변경된 서울체력장 측정 장비 규격(KIOSK형 6종) 간의 단가 차이로 인해 자산취득 예산 부족분이 발생하여 예산 전용 추진"
                else:
                    new_text = "○ 당초 계획 대비 실제 변경된 서울체력장 측정 장비 규격(KIOSK형 6종) 간의 단가 차이로 인해 자산취득 예산 부족분이 발생하여 예산 전용 추진"
            
            if is_matched:
                print(f"Original Text: {combined_text}")
                print(f"-> Replacing with: {new_text}")
                
                # 첫 번째 hp:t에 새 텍스트를 대입하고, 나머지 hp:t는 제거
                t_nodes[0].text = new_text
                
                # 중복 방지를 위해 문단 내의 나머지 hp:t 엘리먼트 제거
                for extra_t in t_nodes[1:]:
                    for run in p.findall('.//hp:run', ns):
                        if extra_t in run:
                            run.remove(extra_t)
                
                updated_count += 1
                
        if updated_count == 0:
            print("Warning: No matching paragraphs found to update.")
        else:
            print(f"Successfully updated {updated_count} paragraphs.")
            
        # XML 저장
        tree.write(section_xml_path, encoding='utf-8', xml_declaration=False)
        
        # XML 선언 복구
        with zipfile.ZipFile(template_path, 'r') as z_orig:
            orig_xml = z_orig.read('Contents/section0.xml').decode('utf-8')
            sec_start = orig_xml.find('<hs:sec')
            sec_end = orig_xml.find('>', sec_start)
            orig_header = orig_xml[:sec_end+1]
            
        with open(section_xml_path, 'r', encoding='utf-8') as f:
            generated_xml = f.read()
            
        g_sec_start = generated_xml.find('<hs:sec')
        g_sec_end = generated_xml.find('>', g_sec_start)
        
        final_xml = orig_header + generated_xml[g_sec_end+1:]
        
        with open(section_xml_path, 'w', encoding='utf-8') as f:
            f.write(final_xml)
            
        # ZIP 패키징
        with zipfile.ZipFile(template_path, 'r') as z_in:
            with zipfile.ZipFile(output_path, 'w') as z_out:
                for info in z_in.infolist():
                    if info.filename == "Contents/section0.xml":
                        with open(section_xml_path, 'rb') as f:
                            xml_data = f.read()
                        info.file_size = len(xml_data)
                        z_out.writestr(info, xml_data)
                    else:
                        file_data = z_in.read(info.filename)
                        z_out.writestr(info, file_data)
                        
        # ZIP 플래그 패치
        import struct
        with open(output_path, 'r+b') as f:
            data = bytearray(f.read())
        
        offset = 0
        while offset < len(data) - 30:
            if data[offset:offset+4] == b'PK\x03\x04':
                comp_method = struct.unpack_from('<H', data, offset+8)[0]
                if comp_method == 8:
                    struct.pack_into('<H', data, offset+6, 4)
            offset += 1
            
        offset = 0
        while offset < len(data) - 46:
            if data[offset:offset+4] == b'PK\x01\x02':
                comp_method = struct.unpack_from('<H', data, offset+10)[0]
                if comp_method == 8:
                    struct.pack_into('<H', data, offset+8, 4)
            offset += 1
            
        with open(output_path, 'wb') as f:
            f.write(data)
            
        print("HWPX repackaging complete.")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error: {e}")
    finally:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

if __name__ == "__main__":
    update_hwpx_reason()
