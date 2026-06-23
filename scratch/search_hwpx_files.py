import os
import sys
import zipfile
import re

sys.stdout.reconfigure(encoding='utf-8')
desktop_dir = r"d:\Desktop"

print("Searching all HWPX files for clinical keywords...")

keywords = ['김광숙', '69.85', '127', '48도', '48', '10.2', '24.9', '체형불균형']
skip_dirs = ['.git', 'node_modules', '.next', 'PORTFOLIO', 'AppData']

def search_text(text, filename):
    for kw in keywords:
        if kw in text:
            print(f"  [MATCH] '{kw}' in {filename}")
            idx = text.find(kw)
            print(f"    Snippet: {text[max(0, idx-100):min(len(text), idx+200)]}")

for root, dirs, files in os.walk(desktop_dir):
    dirs[:] = [d for d in dirs if d not in skip_dirs]
    for file in files:
        if file.lower().endswith('.hwpx'):
            path = os.path.join(root, file)
            try:
                with zipfile.ZipFile(path, 'r') as z:
                    if "Preview/PrvText.txt" in z.namelist():
                        text = z.read("Preview/PrvText.txt").decode('utf-8', errors='ignore')
                        search_text(text, path)
            except Exception as e:
                pass
