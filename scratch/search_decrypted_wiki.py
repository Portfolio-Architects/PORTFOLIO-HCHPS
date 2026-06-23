import sys

sys.stdout.reconfigure(encoding='utf-8')
wiki_path = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\decrypted_wiki.txt"

print("Searching decrypted_wiki.txt for clinical terms...")

keywords = ['체질량지수', 'CVA', '머리척추각', '수축기', '이완기', '체형불균형', '검진결과']

with open(wiki_path, 'r', encoding='utf-8') as f:
    text = f.read()
    for kw in keywords:
        pos = 0
        while True:
            pos = text.find(kw, pos)
            if pos == -1:
                break
            print(f"Found keyword '{kw}' at position {pos}")
            snippet = text[max(0, pos-200):min(len(text), pos+300)]
            print("--- Snippet ---")
            print(snippet)
            print("="*60)
            pos += len(kw)
