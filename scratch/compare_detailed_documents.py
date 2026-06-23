import os
import sys
import fitz
import re

sys.stdout.reconfigure(encoding='utf-8')

scan_dir = r"d:\Desktop\VITAL_Scan"
out_path = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\compare_details.txt"

# 대조할 핵심 파일 리스트 정의
target_files = [
    # 1. 서울체력장 / 영상정보장치 / 9종 장비
    "20260303_서울체력장 특별조정교부금 교부 통보.pdf",
    "20260327_강남체력인증센터 추진계획(수정).pdf",
    "20260330_간주처리 요청(서울체력장 조성·운영 특별조정교부금).pdf",
    "20260413_강남체력인증센터 영상정보장치 구매 계획.pdf",
    "20260414_강남체력인증센터 영상정보장치 구매 계획.pdf",
    "20260416_(조달구매)서울체력장 강남센터 영상정보장치 구매비 지출.pdf",
    "20260417_분할납품요구서(서울체력장 강남센터 영상정보장치 구매)_보건행정과 오창선.pdf",
    "20260420_강남구 보건소 기초체력 9종 구매견적서.pdf",
    "20260420_강남구 보건소 기초체력 9종 임대견적서.pdf",
    
    # 2. 바른자세 개선사업
    "20260202_지역특화 바른자세 개선 사업 추진계획.pdf",
    "20260326_바른자세 개선 출장검진 용역 계획.pdf",
    "20260407_강남구 바른자세 개선 출장검진 용역(실태조사 등) 전자공개 수의계약 의뢰.pdf",
    "20260429_바른자세 개선 사업, 계약 방법 변경 계획.pdf",
    
    # 3. 건강 뜀
    "20260126_건강 뜀, 건강관리교육 지원 사업 계획.pdf",
    "20260311_건강 뜀, 비만예방 프로그램 운영 계획.pdf",
    "20260417_건강 뜀, 비만예방 프로그램 강사 운영 계획.pdf",
    
    # 4. 아이뛰움 프로그램
    "20260212_아이뛰움 프로그램 운영 계획.pdf",
    "20260220_아이뛰움 프로그램 용역 계획.pdf",
    "20260313_아이뛰움 프로그램 용역 계약.pdf",
    "20260319_용역계약서(2026년 아이뛰움 프로그램 용역).pdf",
    
    # 5. 비만예방 합동 캠페인
    "20260212_지역사회 비만예방 합동 캠페인 운영 계획.pdf",
    
    # 6. 공약 사업
    "20260331_민선8기 구청장 공약사업 관리카드 (보건행정과).pdf"
]

print("Starting detailed text extraction for key files...")

with open(out_path, 'w', encoding='utf-8') as out:
    for filename in target_files:
        path = os.path.join(scan_dir, filename)
        if not os.path.exists(path):
            out.write(f"FILE NOT FOUND: {filename}\n\n")
            continue
            
        out.write("="*100 + "\n")
        out.write(f"FILE: {filename}\n")
        out.write("="*100 + "\n")
        
        try:
            doc = fitz.open(path)
            # 1페이지와 2페이지의 텍스트를 주로 추출하여 상세 정보 확인
            for page_num in range(len(doc)):
                page = doc[page_num]
                text = page.get_text()
                out.write(f"--- Page {page_num + 1} ---\n")
                out.write(text + "\n")
        except Exception as e:
            out.write(f"Error reading PDF: {e}\n")
        out.write("\n\n")

print(f"Detailed extraction completed. Saved to {out_path}")
