import sys

sys.stdout.reconfigure(encoding='utf-8')
dump_path = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\dump_transcript_utf8.txt"

print("Searching dump_transcript_utf8.txt for clinical terms...")

keywords = ['체질량지수', 'CVA', '머리척추각', '수축기', '이완기', '체형불균형', '검진결과설명서']

with open(dump_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()
    for idx, line in enumerate(lines):
        found = [kw for kw in keywords if kw in line]
        if found:
            print(f"Line {idx+1} | KWs: {found}")
            # Print the line and a few surrounding lines
            start = max(0, idx - 3)
            end = min(len(lines), idx + 4)
            for j in range(start, end):
                prefix = ">>> " if j == idx else "    "
                print(f"{prefix}{j+1}: {lines[j].strip()}")
            print("-" * 80)
