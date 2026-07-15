import zipfile
import xml.etree.ElementTree as ET
import sys

def analyze_diffs():
    sys.stdout.reconfigure(encoding='utf-8')
    orig_zip_path = "d:\\Desktop\\서울체력장 강남센터, 체력 측정 장비 구매 계획.hwpx.bak"
    gen_zip_path = "d:\\Desktop\\서울체력장 강남센터 장비구매계획서_최종_완성.hwpx"
    
    try:
        z_orig = zipfile.ZipFile(orig_zip_path, 'r')
        z_gen = zipfile.ZipFile(gen_zip_path, 'r')
        
        orig_xml = z_orig.read("Contents/section0.xml")
        gen_xml = z_gen.read("Contents/section0.xml")
        
        orig_root = ET.fromstring(orig_xml)
        gen_root = ET.fromstring(gen_xml)
        
        print("Original root tag:", orig_root.tag)
        print("Generated root tag:", gen_root.tag)
        
        orig_children = list(orig_root)
        gen_children = list(gen_root)
        
        print(f"Original child count: {len(orig_children)}")
        print(f"Generated child count: {len(gen_children)}")
        
        # Compare element by element
        mismatches = 0
        for idx in range(max(len(orig_children), len(gen_children))):
            if idx >= len(orig_children):
                print(f"[Diff at index {idx}] Generated has extra element: {gen_children[idx].tag}")
                mismatches += 1
                continue
            if idx >= len(gen_children):
                print(f"[Diff at index {idx}] Original has extra element: {orig_children[idx].tag}")
                mismatches += 1
                continue
                
            orig_child = orig_children[idx]
            gen_child = gen_children[idx]
            
            if orig_child.tag != gen_child.tag:
                print(f"[Diff at index {idx}] Tag mismatch. Original: {orig_child.tag}, Generated: {gen_child.tag}")
                mismatches += 1
                continue
                
            # Compare attributes
            orig_attrs = orig_child.attrib
            gen_attrs = gen_child.attrib
            if orig_attrs != gen_attrs:
                print(f"[Diff at index {idx}] Attribute mismatch. Original: {orig_attrs}, Generated: {gen_attrs}")
                mismatches += 1
                
        if mismatches == 0:
            print("Structural validation passed: No element level mismatches found at root level.")
        else:
            print(f"Found {mismatches} mismatches.")
            
    except Exception as e:
        print("Error during diff analysis:", e)

if __name__ == "__main__":
    analyze_diffs()
