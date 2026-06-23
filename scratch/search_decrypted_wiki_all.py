import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

keywords = ['체형불균형', '거북목', '골반', '편평족', 'CVA', '수축기', '이완기', '김광숙']

files = [
    r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\decrypted_wiki.txt",
    r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\decrypted_wiki_texts.txt"
]

for filepath in files:
    if os.path.exists(filepath):
        print(f"Searching {filepath}...")
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            text = f.read()
            for kw in keywords:
                idx = 0
                while True:
                    idx = text.find(kw, idx)
                    if idx == -1:
                        break
                    print(f"  [FOUND] '{kw}' at {idx}")
                    print(f"  Snippet: {text[max(0, idx-100):min(len(text), idx+300)]}")
                    print("-" * 50)
                    idx += len(kw)
    else:
        print(f"File not found: {filepath}")
