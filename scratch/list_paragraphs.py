import xml.etree.ElementTree as ET
import unicodedata

xml_path = "scratch/section0_inspect.xml"

ns = {
    'hp': 'http://www.hancom.co.kr/hwpml/2011/paragraph',
    'hs': 'http://www.hancom.co.kr/hwpml/2011/section',
    'hc': 'http://www.hancom.co.kr/hwpml/2011/core'
}

def clean_text(text):
    return unicodedata.normalize('NFC', text.strip())

try:
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    p_elements = root.findall('.//hp:p', ns)
    
    with open("scratch/paragraphs_list.txt", "w", encoding="utf-8") as f:
        for i, p in enumerate(p_elements):
            p_text = "".join([t.text for t in p.findall('.//hp:t', ns) if t.text])
            p_text_clean = clean_text(p_text)
            paraPrIDRef = p.get('paraPrIDRef', '')
            styleIDRef = p.get('styleIDRef', '')
            
            # Check for runs
            runs = p.findall('.//hp:run', ns)
            charPrIDRef = ""
            if runs:
                charPrIDRef = runs[0].get('charPrIDRef', '')
                
            f.write(f"Index: {i} | Text: '{p_text_clean}' | paraPrIDRef: {paraPrIDRef} | styleIDRef: {styleIDRef} | charPrIDRef: {charPrIDRef}\n")
            
    print("Saved paragraphs list to scratch/paragraphs_list.txt")
    
except Exception as e:
    print("Error:", e)
