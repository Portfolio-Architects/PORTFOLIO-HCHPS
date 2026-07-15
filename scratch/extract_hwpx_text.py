import zipfile
import xml.etree.ElementTree as ET
import os
import sys

def extract_hwpx_text(file_path):
    sys.stdout.reconfigure(encoding='utf-8')
    
    if not os.path.exists(file_path):
        print(f"Error: File not found at {file_path}")
        return
        
    try:
        with zipfile.ZipFile(file_path, 'r') as z:
            # zip 내부 파일 목록 조회
            namelist = z.namelist()
            
            # 본문 콘텐츠는 주로 Contents/section*.xml 에 위치함
            section_files = [f for f in namelist if f.startswith('Contents/section') and f.endswith('.xml')]
            section_files.sort()
            
            if not section_files:
                print("Error: No section XML files found in HWPX. Might not be a valid HWPX file.")
                return
                
            all_text = []
            
            for sec_file in section_files:
                xml_data = z.read(sec_file)
                # XML 파싱
                root = ET.fromstring(xml_data)
                
                # HWPX XML 네임스페이스 정의
                # 보통 http://www.hancom.co.kr/hwpml/2011/paragraph 등의 네임스페이스가 지정됨
                # 네임스페이스에 무관하게 텍스트 노드를 추출하기 위해 tag에서 local-name만 비교하거나
                # ElementTree의 iter를 사용해 문자열이 있는 태그를 찾음
                
                # HWPX에서 글자는 <hp:t> 태그 내부에 위치함
                for elem in root.iter():
                    if elem.tag.endswith('}t') or elem.tag == 't':
                        if elem.text:
                            all_text.append(elem.text)
                    elif elem.tag.endswith('}p') or elem.tag == 'p':
                        # 문단 구분 용도로 빈 문자열 추가하여 줄바꿈 유도
                        all_text.append("\n")
            
            # 병합
            full_text = ""
            for token in all_text:
                if token == "\n":
                    full_text += "\n"
                else:
                    full_text += token
            
            # 연속된 줄바꿈 정제
            lines = [line.strip() for line in full_text.split('\n')]
            cleaned_text = "\n".join([l for l in lines if l])
            
            print(f"=== Successfully Extracted HWPX: {os.path.basename(file_path)} ===")
            print(f"Total extracted length: {len(cleaned_text)} chars")
            print("\n--- Preview (First 1000 chars) ---")
            print(cleaned_text[:1000])
            print("----------------------------------\n")
            
            # 결과 저장
            output_path = "scratch/extracted_hwpx_content.txt"
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(cleaned_text)
            print(f"Full text saved to {output_path}")
            
    except Exception as e:
        print(f"Failed to parse HWPX: {e}")

if __name__ == "__main__":
    # 인자로 파일 경로를 받거나 기본 경로 사용
    target = "d:\\Desktop\\서울체력장 강남센터, 체력 측정 장비 구매 계획 - 복사본.hwpx"
    if len(sys.argv) > 1:
        target = sys.argv[1]
    extract_hwpx_text(target)
