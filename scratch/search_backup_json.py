import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
backup_path = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\hchps-backup.json"

print("Searching hchps-backup.json...")
if os.path.exists(backup_path):
    with open(backup_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        content = str(data)
        
        keywords = ['체형불균형', '김광숙', '거북목', '골반', '편평족', 'CVA', '수축기', '이완기']
        for kw in keywords:
            if kw in content:
                print(f"  [FOUND] '{kw}' in backup JSON")
                # Find occurrences
                idx = content.find(kw)
                print(f"    Snippet: {content[max(0, idx-100):min(len(content), idx+500)]}")
                print("-" * 80)
else:
    print("Backup JSON not found")
