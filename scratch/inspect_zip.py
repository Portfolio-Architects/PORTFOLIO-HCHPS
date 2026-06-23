import zipfile
import os

hwpx_path = r"D:\Desktop\공약제안 사업계획서(보건행정과)_1. AI 메디헬스 센터(가칭) 조성 계획_최종4.hwpx"

try:
    with zipfile.ZipFile(hwpx_path, 'r') as z:
        # Read Contents/section0.xml
        xml_data = z.read("Contents/section0.xml").decode('utf-8', errors='ignore')
        print("Length of section0.xml:", len(xml_data))
        
        # Save a copy to inspect
        with open("scratch/section0_inspect.xml", "w", encoding="utf-8") as f:
            f.write(xml_data)
        print("Saved section0.xml to scratch/section0_inspect.xml")
except Exception as e:
    print("Error:", e)
