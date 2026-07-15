import zipfile
import sys
import os

def dump_xml():
    sys.stdout.reconfigure(encoding='utf-8')
    path = "d:\\Desktop\\PORTFOLIO\\PORTFOLIO - VITAL\\scratch\\서울체력장_테스트.hwpx"
    if not os.path.exists(path):
        print(f"Error: Test file not found at {path}")
        return
        
    try:
        z = zipfile.ZipFile(path, 'r')
        data = z.read("Contents/section0.xml")
        print("XML Length:", len(data))
        print("XML Content Head (1500 chars):")
        print(data[:1500].decode('utf-8'))
    except Exception as e:
        print("Error reading output XML:", e)

if __name__ == "__main__":
    dump_xml()
