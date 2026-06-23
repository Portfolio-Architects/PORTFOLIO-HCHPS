import os

filepath = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\decrypted_wiki_texts.txt"
keywords = ["메디", "스포츠", "체력", "인증", "건강", "수호천사", "HCHPS", "AI", "서울체력장"]

try:
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    print(f"Total lines: {len(lines)}")
    
    matches = 0
    for i, line in enumerate(lines):
        for kw in keywords:
            if kw.lower() in line.lower():
                matches += 1
                print(f"Line {i+1} matches '{kw}':")
                print(f"  {line.strip()[:200]}")
                print("-" * 50)
                break
        if matches > 15:
            print("Truncated further matches.")
            break
            
except Exception as e:
    print(f"Error: {e}")
