import os
import zipfile
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
scan_dir = r"d:\Desktop\VITAL_Scan"

print("Searching HWPX files in VITAL_Scan...")

keywords = ['체질량지수', 'CVA', '머리척추각', '수축기', '이완기']

for file in os.listdir(scan_dir):
    if file.lower().endswith(".hwpx"):
        filepath = os.path.join(scan_dir, file)
        print(f"\nChecking file: {file}")
        try:
            with zipfile.ZipFile(filepath, 'r') as z:
                # Print all files in zip to see where text is
                names = z.namelist()
                text = ""
                # Try section0.xml first (main text in HWPX)
                section_files = [n for n in names if 'section' in n.lower() and n.endswith('.xml')]
                if section_files:
                    print(f"  Found section files: {section_files}")
                    for sf in section_files:
                        xml_content = z.read(sf).decode('utf-8', errors='ignore')
                        # Strip XML tags
                        txt = re.sub(r'<[^>]+>', ' ', xml_content)
                        text += txt + "\n"
                elif "Preview/PrvText.txt" in names:
                    text = z.read("Preview/PrvText.txt").decode('utf-8', errors='ignore')
                
                # Check for keywords
                found = [kw for kw in keywords if kw in text]
                if found:
                    print(f"  Match found! KWs: {found}")
                    # Print matching segments
                    lines = text.split('\n')
                    for line in lines:
                        if any(kw in line for kw in keywords):
                            print("    Line:", line.strip()[:200])
                else:
                    print("  No keywords found.")
        except Exception as e:
            print(f"  Error reading {file}: {e}")
