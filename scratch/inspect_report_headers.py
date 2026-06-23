import os
import sys

report_path = "PORTFOLIO VITAL - Engineering Report.md"
if os.path.exists(report_path):
    with open(report_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Let's find lines starting with ## in the last 20000 characters
    lines = content[-20000:].split('\n')
    sys.stdout.reconfigure(encoding='utf-8')
    for line in lines:
        if line.startswith('##') or line.startswith('###') or line.startswith('####'):
            print(line)
else:
    print("Report not found")
