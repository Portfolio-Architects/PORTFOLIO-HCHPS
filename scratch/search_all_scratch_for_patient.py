import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
scratch_dir = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch"

print("Searching all scratch files for '김광숙'...")

for root, dirs, files in os.walk(scratch_dir):
    for file in files:
        if file.endswith('.py') or file.endswith('.txt') or file.endswith('.json'):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    text = f.read()
                    if '김광숙' in text:
                        print(f"  [FOUND] in {path}")
                        # Print surrounding text
                        idx = text.find('김광숙')
                        print(text[max(0, idx-100):min(len(text), idx+500)])
                        print("-" * 80)
            except Exception as e:
                pass
