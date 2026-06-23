import xml.etree.ElementTree as ET

xml_path = "scratch/section0_inspect.xml"

ns = {
    'hp': 'http://www.hancom.co.kr/hwpml/2011/paragraph',
    'hs': 'http://www.hancom.co.kr/hwpml/2011/section',
    'hc': 'http://www.hancom.co.kr/hwpml/2011/core'
}

try:
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    parent_map = {c: p for p in root.iter() for c in p}
    p_elements = root.findall('.//hp:p', ns)
    
    p_171 = None
    for p in p_elements:
        p_text = "".join([t.text for t in p.findall('.//hp:t', ns) if t.text])
        if "향후 연계 계획(안)" in p_text:
            p_171 = p
            break
            
    if p_171 is not None:
        container = parent_map[p_171]
        siblings = list(container)
        print(f"Total siblings in sec: {len(siblings)}")
        
        # Let's print the last 5 elements of siblings list
        for idx in range(len(siblings) - 5, len(siblings)):
            sib = siblings[idx]
            p_text = "".join([t.text for t in sib.findall('.//hp:t', ns) if t.text])
            # safe text for printing (ascii only)
            p_text_safe = p_text.encode('ascii', errors='ignore').decode('ascii')
            print(f"Index: {idx} | Tag: {sib.tag} | Text: '{p_text_safe}'")
            
except Exception as e:
    print("Error:", e)
