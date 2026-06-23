import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
brain_dir = r"C:\Users\user\.gemini\antigravity\brain"

print("Searching all conversation folders recursively for clinical terms...")

keywords = ['거북목증후군', '골반 전방경사', '편평족', '체형불균형.csv']

for folder in os.listdir(brain_dir):
    folder_path = os.path.join(brain_dir, folder)
    if not os.path.isdir(folder_path):
        continue
    for root, dirs, files in os.walk(folder_path):
        # Skip task logs to avoid clutter
        if '.system_generated' in root:
            continue
        for file in files:
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    text = f.read()
                    found = [kw for kw in keywords if kw in text]
                    if found:
                        print(f"  [FOUND] in {path} | Matches: {found}")
                        # Print snippet
                        idx = text.find(found[0])
                        print(text[max(0, idx-100):min(len(text), idx+500)])
                        print("-" * 80)
            except Exception as e:
                pass
