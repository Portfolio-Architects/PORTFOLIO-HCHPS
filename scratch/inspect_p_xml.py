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
    
    # Let's print the first 20 paragraphs with their full XML structure
    p_elements = root.findall('.//hp:p', ns)
    print(f"Total p elements: {len(p_elements)}")
    
    for i, p in enumerate(p_elements[:15]):
        p_text = "".join([t.text for t in p.findall('.//hp:t', ns) if t.text])
        print(f"P[{i}]: Text: '{p_text}'")
        # Dump XML string
        xml_str = ET.tostring(p, encoding='utf-8').decode('utf-8')
        print(f"XML: {xml_str[:300]}...")
        print("-" * 50)
        
except Exception as e:
    print("Error:", e)
