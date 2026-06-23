import os
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
data_dir = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\data"

print("Searching data folder JSONs for clinical terms...")

keywords = ['체형불균형', '김광숙', '거북목', '골반', '편평족', 'CVA', '수축기', '이완기']

for file in os.listdir(data_dir):
    if file.endswith('.json'):
        path = os.path.join(data_dir, file)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                found = [kw for kw in keywords if kw in content]
                if found:
                    print(f"  [FOUND] in {file} | Matches: {found}")
                    idx = content.find(found[0])
                    print(f"    Snippet: {content[max(0, idx-100):min(len(content), idx+500)]}")
                    print("-" * 80)
        except Exception as e:
            pass
