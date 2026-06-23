import zipfile
import os
import xml.etree.ElementTree as ET
import re

def extract_text_from_section_xml(xml_content):
    # XML 태그 내의 텍스트를 추출하기 위한 정규식
    # 특히 <hp:t>태그나 일반 텍스트 태그 <t>에 들어있는 텍스트를 추출
    # xml_content가 문자열인 경우
    # 네임스페이스 제거
    xml_content = re.sub(r'xmlns="[^"]+"', '', xml_content)
    xml_content = re.sub(r'xmlns:[^=]+="[^"]+"', '', xml_content)
    
    # <hp:t> or <t> 추출
    texts = re.findall(r'<h[ps]:t.*?>(.*?)</h[ps]:t>', xml_content, re.DOTALL)
    if not texts:
        texts = re.findall(r'<t.*?>(.*?)</t>', xml_content, re.DOTALL)
    
    clean_texts = []
    for t in texts:
        # nested tags 제거
        clean = re.sub(r'<[^>]+>', '', t)
        # HTML 엔티티 변환 (간단히 &lt;, &gt;, &amp;, &quot; 등)
        clean = clean.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&').replace('&quot;', '"').replace('&apos;', "'")
        clean_texts.append(clean)
    
    # 만약 위의 태그가 발견되지 않았다면, XML 구조에서 모든 텍스트 노드를 파싱
    if not clean_texts:
        try:
            # XML 파서 사용
            root = ET.fromstring(xml_content)
            clean_texts = [elem.text for elem in root.iter() if elem.text]
        except Exception as e:
            # 정규식으로 태그가 없는 순수 텍스트만 대략 추출
            clean_texts = re.findall(r'>([^<]+)<', xml_content)
            
    return "\n".join([t.strip() for t in clean_texts if t.strip()])

def extract_hwpx_text(zip_path):
    print(f"--- Extracting {os.path.basename(zip_path)} ---")
    try:
        with zipfile.ZipFile(zip_path, 'r') as z:
            # Force XML parsing instead of PrvText
            sections = sorted([name for name in z.namelist() if 'Contents/section' in name])
            print(f"Found sections: {sections}")
            all_text = []
            for sec in sections:
                with z.open(sec) as f:
                    xml_data = f.read().decode('utf-8', errors='ignore')
                    all_text.append(extract_text_from_section_xml(xml_data))
            return "\n\n".join(all_text)
    except Exception as e:
        return f"Error: {e}"

desktop_path = r"d:\Desktop"
hwpx_files = [
    "구정주요업무보고 백데이터 작성 서식.hwpx",
    "실적 현황.hwpx",
    "1.구정주요업무보고_건생최종.hwpx",
    "2026년 구의회 주요업무보고(건생)_최종.hwpx",
    "건강 뜀, 비만예방 프로그램 하반기 운영 계획.hwpx"
]

for f_name in hwpx_files:
    path = os.path.join(desktop_path, f_name)
    if os.path.exists(path):
        text = extract_hwpx_text(path)
        out_path = os.path.join(os.path.dirname(__file__), f_name.replace('.hwpx', '_extracted.txt'))
        with open(out_path, 'w', encoding='utf-8') as out_f:
            out_f.write(text)
        print(f"Saved extracted text to {out_path} (length: {len(text)})")
    else:
        print(f"File not found: {path}")
