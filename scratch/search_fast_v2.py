import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

search_dirs = [
    r"d:\Desktop",
    r"d:\Desktop\PORTFOLIO",
    r"C:\Users\user\.gemini",
    r"C:\Users\user\Downloads",
    r"C:\Users\user\Desktop"
]

keywords = ['검진결과', '체형불균형', '설명서', '체질량', '수축기', '이완기']

output_file = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\search_fast_output.txt"

with open(output_file, 'w', encoding='utf-8') as out:
    out.write("Starting search...\n")
    for sdir in search_dirs:
        if not os.path.exists(sdir):
            out.write(f"Directory not found: {sdir}\n")
            continue
        out.write(f"Searching {sdir}...\n")
        for root, dirs, files in os.walk(sdir):
            skip = False
            for part in ['node_modules', '.git', '.next', 'AppData']:
                if part in root:
                    skip = True
                    break
            if skip:
                continue
            for file in files:
                name_lower = file.lower()
                if any(kw in name_lower for kw in keywords):
                    out.write(f"  [MATCH] {os.path.join(root, file)}\n")
    out.write("Search completed.\n")

print("Done! Output written to scratch/search_fast_output.txt")
