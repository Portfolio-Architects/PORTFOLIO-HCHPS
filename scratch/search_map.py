import json
import re

filepath = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\data\MAP_CUSTOMIZATION.json"
keywords = ["메디스포츠", "체력장", "HCHPS", "Medi-Sports", "MediSports", "인증센터", "체력인증", "건강", "수호천사", "헬스체크업", "AI"]

try:
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
        # Let's inspect the keys and items in the json
        # Often it is a list of node customizations
        print(f"Data type: {type(data)}")
        
        # We can dump elements that match our keywords
        matches = []
        str_data = json.dumps(data, ensure_ascii=False)
        for kw in keywords:
            if kw in str_data:
                print(f"[FOUND] '{kw}' in MAP_CUSTOMIZATION.json")
                # Let's find specific nodes/edges
                # If it's a list or dict, let's search it recursively
                def search_recursive(val, path=""):
                    if isinstance(val, dict):
                        for k, v in val.items():
                            search_recursive(v, f"{path}.{k}")
                    elif isinstance(val, list):
                        for i, item in enumerate(val):
                            search_recursive(item, f"{path}[{i}]")
                    elif isinstance(val, str):
                        if any(k.lower() in val.lower() for k in keywords):
                            matches.append((path, val))
                search_recursive(data)
                break
                
        print(f"Total matching paths: {len(matches)}")
        for path, val in matches[:20]:
            print(f"  {path}: {val}")
except Exception as e:
    print(f"Error: {e}")
