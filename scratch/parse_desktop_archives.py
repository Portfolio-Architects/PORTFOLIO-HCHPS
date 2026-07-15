import os
import re
import zipfile
import fitz # PyMuPDF
import itertools

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
    return "\n".join([t.strip() for t in clean_texts if t.strip()])

def extract_hwpx_text(zip_path):
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
        return f"Error HWPX: {e}"

def extract_pdf_text(pdf_path):
    try:
        doc = fitz.open(pdf_path)
        text = []
        for page in doc:
            words = page.get_text('words')
            words.sort(key=lambda w: (round(w[3]/5), w[0]))
            for k, g in itertools.groupby(words, key=lambda w: round(w[3]/5)):
                text.append(' '.join(w[4] for w in sorted(g, key=lambda w: w[0])))
        return '\n'.join(text)
    except Exception as e:
        return f"Error PDF: {e}"

desktop_path = r"d:\Desktop"
files_to_parse = [
    "(260629)서울형 체력측정 운영기준 수립을 위한연구용역 결과보고서_final(ver.7).pdf",
    "서울체력장 장비 구성안.hwpx",
    "서울체력장 강남센터 조성에 따른 체력측정 장비 구매를 위한 예산 전용 계획.hwpx",
    "서울체력장 강남센터, 체력 측정 장비 구매 계획.hwpx",
    "(주)시드테크 입니다 서울체력장관련 자료와 견적서 첨부합니다",
    "견적서 첨부합니다"
]

results_summary = []

for f_name in files_to_parse:
    path = os.path.join(desktop_path, f_name)
    if not os.path.exists(path):
        results_summary.append(f"NOT FOUND: {f_name}")
        continue
    
    # Check if folder or file
    if os.path.isdir(path):
        # List contents of directory
        subfiles = os.listdir(path)
        results_summary.append(f"DIR: {f_name} containing {subfiles}")
        # Parse text/docx/xlsx/pdf inside dir if any
        for sf in subfiles:
            sf_path = os.path.join(path, sf)
            if sf.endswith('.txt') or sf.endswith('.csv') or sf.endswith('.xml'):
                with open(sf_path, 'r', encoding='utf-8', errors='ignore') as sff:
                    content = sff.read()
                out_name = f"extracted_{f_name}_{sf}.txt"
                out_path = os.path.join("scratch", out_name)
                with open(out_path, 'w', encoding='utf-8') as out_f:
                    out_f.write(content)
                results_summary.append(f"  Parsed subfile {sf} -> {out_name} ({len(content)} chars)")
            elif sf.endswith('.pdf'):
                content = extract_pdf_text(sf_path)
                out_name = f"extracted_{f_name}_{sf}.txt"
                out_path = os.path.join("scratch", out_name)
                with open(out_path, 'w', encoding='utf-8') as out_f:
                    out_f.write(content)
                results_summary.append(f"  Parsed subfile PDF {sf} -> {out_name} ({len(content)} chars)")
    else:
        # File
        results_summary.append(f"FILE: {f_name} (Size: {os.path.getsize(path)} bytes)")
        if f_name.endswith('.pdf'):
            content = extract_pdf_text(path)
            out_name = f"extracted_{f_name.replace('.pdf', '')}.txt"
            out_path = os.path.join("scratch", out_name)
            with open(out_path, 'w', encoding='utf-8') as out_f:
                out_f.write(content)
            results_summary.append(f"  Parsed PDF -> {out_name} ({len(content)} chars)")
        elif f_name.endswith('.hwpx'):
            content = extract_hwpx_text(path)
            out_name = f"extracted_{f_name.replace('.hwpx', '')}.txt"
            out_path = os.path.join("scratch", out_name)
            with open(out_path, 'w', encoding='utf-8') as out_f:
                out_f.write(content)
            results_summary.append(f"  Parsed HWPX -> {out_name} ({len(content)} chars)")
        elif f_name.endswith('.txt') or f_name.endswith('.csv'):
            with open(path, 'r', encoding='utf-8', errors='ignore') as ff:
                content = ff.read()
            out_name = f"extracted_{f_name.replace('.txt', '')}.txt"
            out_path = os.path.join("scratch", out_name)
            with open(out_path, 'w', encoding='utf-8') as out_f:
                out_f.write(content)
            results_summary.append(f"  Parsed TXT -> {out_name} ({len(content)} chars)")
        else:
            # Try to read as raw text
            try:
                with open(path, 'r', encoding='utf-8', errors='ignore') as ff:
                    content = ff.read()
                out_name = f"extracted_{f_name}.txt"
                out_path = os.path.join("scratch", out_name)
                with open(out_path, 'w', encoding='utf-8') as out_f:
                    out_f.write(content)
                results_summary.append(f"  Read as RAW text -> {out_name} ({len(content)} chars)")
            except Exception as e:
                results_summary.append(f"  Failed raw read: {e}")

summary_text = "\n".join(results_summary)
print(summary_text)
with open('scratch/parse_summary.txt', 'w', encoding='utf-8') as sf:
    sf.write(summary_text)
