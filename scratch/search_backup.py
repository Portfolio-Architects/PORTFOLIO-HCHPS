import json

filepath = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\hchps-backup.json"
keywords = ["메디", "스포츠", "체력", "인증", "건강", "수호천사", "HCHPS", "AI", "서울체력장"]

try:
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    print("Successfully loaded hchps-backup.json")
    str_data = json.dumps(data, ensure_ascii=False)
    
    matches = []
    for kw in keywords:
        if kw in str_data:
            print(f"[FOUND] '{kw}' in hchps-backup.json")
            
            # Find matching items in backup keys
            for k, v in data.items():
                str_v = str(v)
                if kw in str_v:
                    matches.append((k, kw))
                    
    print(f"Matches keys: {matches}")
    
except Exception as e:
    print(f"Error: {e}")
