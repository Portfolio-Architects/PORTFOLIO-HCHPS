import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
wiki_path = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\decrypted_wiki.txt"

print("Searching decrypted_wiki.txt...")
if os.path.exists(wiki_path):
    with open(wiki_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    # Search for 김광숙 or related terms
    terms = ['김광숙', '69.85', '48도', '체질량지수', '골반 경사', 'CVA']
    for term in terms:
        idx = 0
        while True:
            idx = text.find(term, idx)
            if idx == -1:
                break
            print(f"Found '{term}' at index {idx}:")
            start = max(0, idx - 100)
            end = min(len(text), idx + 200)
            print(text[start:end])
            print("-" * 50)
            idx += len(term)
else:
    print("decrypted_wiki.txt does not exist")
