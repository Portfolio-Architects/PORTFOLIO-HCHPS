import os
import sys

report_path = "PORTFOLIO VITAL - Engineering Report.md"
if os.path.exists(report_path):
    with open(report_path, "r", encoding="utf-8") as f:
        content = f.read()
    # Print the last 1000 characters
    sys.stdout.reconfigure(encoding='utf-8')
    print(content[-1500:])
else:
    print("Report not found")
