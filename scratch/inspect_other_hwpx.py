import zipfile
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
filepath = r"D:\Desktop\외부행사 (Y-Balance, 악력).hwpx"

print("Inspecting 외부행사 (Y-Balance, 악력).hwpx...")

try:
    with zipfile.ZipFile(filepath, 'r') as z:
        names = z.namelist()
        text = ""
        section_files = [n for n in names if 'section' in n.lower() and n.endswith('.xml')]
        if section_files:
            for sf in section_files:
                xml_content = z.read(sf).decode('utf-8', errors='ignore')
                txt = re.sub(r'<[^>]+>', ' ', xml_content)
                text += txt + "\n"
        elif "Preview/PrvText.txt" in names:
            text = z.read("Preview/PrvText.txt").decode('utf-8', errors='ignore')
            
        print("=== Content Snippet ===")
        print(text[:2000])
        print("=== End ===")
except Exception as e:
    print("Error:", e)
