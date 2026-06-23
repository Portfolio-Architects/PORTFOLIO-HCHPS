import os
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

keywords = ['24.9', '127/82', '48도', '10.2', '김광숙']
search_roots = [
    r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL"
]

print("Searching files for target values...")

for sroot in search_roots:
    for root, dirs, files in os.walk(sroot):
        # Skip node_modules, .git, .next, etc.
        dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules', '.next', 'AppData']]
        for file in files:
            if file.endswith('.txt') or file.endswith('.json') or file.endswith('.md') or file.endswith('.py'):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                        text = f.read()
                        found = [kw for kw in keywords if kw in text]
                        if found:
                            print(f"  [FOUND] in {path} | Match: {found}")
                            # Print surrounding lines
                            lines = text.split('\n')
                            for line in lines:
                                if any(kw in line for kw in keywords):
                                    print("    Line:", line.strip()[:200])
                except Exception as e:
                    pass
