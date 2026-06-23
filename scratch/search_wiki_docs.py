import os
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
data_dir = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\data"

print("Searching wiki documents in data folder for clinical terms...")

keywords = ['체형불균형', '김광숙', '거북목', '골반', '편평족', 'CVA', '수축기', '이완기']

for file in os.listdir(data_dir):
    if file.startswith('WIKI_DOC_') and file.endswith('.json'):
        path = os.path.join(data_dir, file)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                content = str(data)
                found = [kw for kw in keywords if kw in content]
                if found:
                    print(f"  [MATCH] {file} | Matches: {found}")
                    # Print snippet of the content
                    if 'content' in data:
                        text = data['content']
                        idx = text.find(found[0])
                        print(text[max(0, idx-100):min(len(text), idx+500)])
                    else:
                        print(str(data)[:600])
                    print("-" * 80)
        except Exception as e:
            pass
