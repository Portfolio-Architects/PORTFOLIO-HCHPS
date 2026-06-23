import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
portfolio_dir = r"d:\Desktop\PORTFOLIO"

print(f"Searching {portfolio_dir} recursively for PDF or CSV files...")

for root, dirs, files in os.walk(portfolio_dir):
    if ".git" in root or ".next" in root or "node_modules" in root:
        continue
    for file in files:
        ext = os.path.splitext(file)[1].lower()
        if ext in ['.pdf', '.csv']:
            name = file.lower()
            if '검진' in name or '설명서' in name or '체형' in name or '불균형' in name:
                print(f"Match found: {os.path.join(root, file)}")
