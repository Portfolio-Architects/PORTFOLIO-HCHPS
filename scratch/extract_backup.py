import json

filepath = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\hchps-backup.json"
output_path = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\backup_matches.txt"
keywords = ["메디", "스포츠", "체력", "인증", "건강", "수호천사", "HCHPS", "AI", "서울체력장"]

try:
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    results = []
    
    # We will scan through the database structure in hchps-backup.json
    # Usually it's a dict of tables or files
    for key, value in data.items():
        val_str = json.dumps(value, ensure_ascii=False)
        matched = [kw for kw in keywords if kw in val_str]
        if matched:
            results.append(f"=== KEY: {key} (Matched: {matched}) ===")
            # Pretty print value
            results.append(json.dumps(value, indent=2, ensure_ascii=False))
            results.append("=" * 80)
            
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(results))
        
    print(f"Extracted matches saved to {output_path}")
    
except Exception as e:
    print(f"Error: {e}")
