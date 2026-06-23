import os
import sys
import fitz  # PyMuPDF
import re

sys.stdout.reconfigure(encoding='utf-8')

scan_dir = r"d:\Desktop\VITAL_Scan"
out_file = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\audit_pdf_results.txt"

pdf_files = [f for f in os.listdir(scan_dir) if f.lower().endswith('.pdf')]
pdf_files.sort()

def extract_meta_from_pdf(path):
    filename = os.path.basename(path)
    try:
        doc = fitz.open(path)
        first_page_text = doc[0].get_text() if len(doc) > 0 else ""
        full_text = ""
        for page in doc:
            full_text += page.get_text() + "\n"
        
        # 정규식을 이용해 예산/금액/날짜/계약상대방 등 주요 키워드 추출
        # 1. 예산/금액 (원 단위, 천원 단위 등)
        amounts = re.findall(r'(?:금액|예산|사업비|소요예산|계약금액|금)\s*(?:액)?\s*[:：=]?\s*(?:금)?\s*([\d,]+)\s*(?:원|천원|백만원)', full_text)
        
        # 2. 날짜 패턴 (2026. XX. XX 또는 2026년 XX월)
        dates = re.findall(r'(202[56][\.\s\-군물월일\d]+)', full_text)
        cleaned_dates = []
        for d in dates:
            d_clean = d.strip()
            # 숫자와 도트, 한글 월일만 대략 정리
            if len(d_clean) > 6:
                cleaned_dates.append(d_clean[:30])
        
        # 3. 주요 협력업체 / 기관명 / 학교명
        # 초등학교, 고등학교 패턴
        schools = re.findall(r'(\w+초등학교|\w+고등학교|\w+중학교)', full_text)
        
        # 업체명 (주식회사, (주) 등)
        companies = re.findall(r'(\(?주\)?\s*\w+|\w+\s*\(?주\)?공사|\w+종합관리|\w+텍|㈜\s*\w+)', full_text)

        # 요약 정보 리턴
        return {
            "filename": filename,
            "length": len(full_text),
            "sample": first_page_text[:400].replace('\n', ' '),
            "amounts": list(set(amounts))[:10],
            "dates": list(set(cleaned_dates))[:10],
            "schools": list(set(schools))[:10],
            "companies": list(set(companies))[:10],
            "full_text_preview": full_text[:2000] # Full text preview for details
        }
    except Exception as e:
        return {"filename": filename, "error": str(e)}

print(f"Auditing {len(pdf_files)} PDF files in VITAL_Scan...")

with open(out_file, 'w', encoding='utf-8') as out:
    for idx, pdf in enumerate(pdf_files):
        path = os.path.join(scan_dir, pdf)
        meta = extract_meta_from_pdf(path)
        
        out.write("="*80 + "\n")
        out.write(f"[{idx+1}] File: {meta['filename']}\n")
        out.write("="*80 + "\n")
        if "error" in meta:
            out.write(f"Error: {meta['error']}\n\n")
            continue
            
        out.write(f"Size (chars): {meta['length']}\n")
        out.write(f"Sample: {meta['sample']}\n")
        out.write(f"Extracted Amounts: {meta['amounts']}\n")
        out.write(f"Extracted Dates: {meta['dates']}\n")
        out.write(f"Extracted Schools/Institutions: {meta['schools']}\n")
        out.write(f"Extracted Companies: {meta['companies']}\n\n")
        
        # Write first 1000 chars of full text to verify details
        out.write("--- Preview Text ---\n")
        out.write(meta['full_text_preview'][:1500] + "\n")
        out.write("\n\n")

print(f"Audit completed. Results saved to {out_file}")
