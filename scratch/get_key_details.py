import re

filepath = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\source_docs.txt"
output_path = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\key_details.txt"

try:
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()
        
    lines = text.split('\n')
    print(f"Total lines in source docs: {len(lines)}")
    
    # We want to extract lines that mention budget numbers, timelines, staff, or background.
    results = []
    
    sections_to_print = []
    # Let's search for some markers or write out sections.
    # We can also do regex search.
    keywords = ["추진개요", "추진배경", "현황", "추진계획", "예산", "장비", "인력", "일정", "인증센터"]
    
    results.append("=== KEY EXTRACED SECTIONS ===")
    
    # Let's find index of "강남체력인증센터 추진계획.hwpx" and print it fully
    hwp_index = text.find("강남체력인증센터 추진계획.hwpx")
    if hwp_index != -1:
        results.append("\n\n--- HWP CONTENT ---")
        results.append(text[hwp_index:hwp_index+10000]) # next 10k chars
        
    pdf_index = text.find("20260421_서울체력장(서울형 체력기준안).pdf")
    if pdf_index != -1:
        results.append("\n\n--- PDF CONTENT (First 10k) ---")
        results.append(text[pdf_index:pdf_index+10000])
        
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(results))
        
    print(f"Key details saved to {output_path}")
    
except Exception as e:
    print(f"Error: {e}")
