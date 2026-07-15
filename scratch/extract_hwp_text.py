import olefile
import zlib
import struct
import sys

def parse_hwp_text(file_path):
    sys.stdout.reconfigure(encoding='utf-8')
    
    if not olefile.isOleFile(file_path):
        print(f"Error: {file_path} is not a valid OLE file.")
        return

    ole = olefile.OleFileIO(file_path)
    dirs = ole.listdir()
    
    # HWP5 문서인지 확인
    has_bodytext = False
    for d in dirs:
        if d[0] == "BodyText":
            has_bodytext = True
            break
            
    if not has_bodytext:
        print("Error: BodyText directory not found inside the HWP file. Might not be HWP5.")
        return

    # Section 스트림들을 추출
    sections = []
    for d in dirs:
        if d[0] == "BodyText" and d[1].startswith("Section"):
            sections.append(d)
            
    sections.sort(key=lambda x: x[1])

    all_text = []

    for section in sections:
        stream = ole.openstream(section)
        data = stream.read()
        
        # 압축 해제 시도
        try:
            decompressed = zlib.decompress(data, -15) # HWP OLE 스트림은 zlib 헤더가 없을 수 있어 raw deflate(-15)로 해제
        except Exception:
            try:
                decompressed = zlib.decompress(data) # 헤더가 있는 경우
            except Exception as e:
                print(f"Decompression failed for {section}: {e}")
                continue
                
        # 레코드 단위로 파싱하여 HWPTAG_PARA_TEXT (67) 검색
        idx = 0
        length = len(decompressed)
        while idx < length:
            if idx + 4 > length:
                break
            header = struct.unpack("<I", decompressed[idx:idx+4])[0]
            idx += 4
            
            tag_id = header & 0x3FF
            level = (header >> 10) & 0x3FF
            size = (header >> 20) & 0xFFF
            
            if size == 0xFFF:
                if idx + 4 > length:
                    break
                size = struct.unpack("<I", decompressed[idx:idx+4])[0]
                idx += 4
                
            if idx + size > length:
                break
                
            record_data = decompressed[idx:idx+size]
            idx += size
            
            # HWPTAG_PARA_TEXT = 67
            if tag_id == 67:
                # 텍스트 레코드 디코딩
                # UTF-16LE 2바이트 문자열 추출
                try:
                    # HWP5 텍스트 레코드는 중간에 컨트롤 코드가 들어갈 수 있으므로, 
                    # 2바이트씩 읽으면서 일반 글자 영역만 추출
                    text_chars = []
                    i = 0
                    while i + 2 <= len(record_data):
                        char_code = struct.unpack("<H", record_data[i:i+2])[0]
                        # HWP 컨트롤 코드 및 Surrogate 필터링 (0~31 특수 코드 제외, 0xD800~0xDFFF 제외)
                        if (char_code >= 32 and not (0xD800 <= char_code <= 0xDFFF)) or char_code in (10, 13, 9):
                            text_chars.append(chr(char_code))
                        i += 2
                    para_text = "".join(text_chars)
                    all_text.append(para_text)
                except Exception as e:
                    pass
                    
    # 결과 파일 저장 및 출력
    output_text = "\n".join(all_text)
    print("=== Extracted Text Preview (First 500 chars) ===")
    print(output_text[:500])
    print("================================================")
    
    with open("scratch/extracted_hwp_guideline.txt", "w", encoding="utf-8") as f:
        f.write(output_text)
    print("Full text saved to scratch/extracted_hwp_guideline.txt")

if __name__ == "__main__":
    parse_hwp_text("d:\\Desktop\\20250118_공문서 작성법 길라잡이.hwp")
