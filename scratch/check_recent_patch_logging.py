import os
import sys

report_path = "PORTFOLIO VITAL - Engineering Report.md"
if os.path.exists(report_path):
    with open(report_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Check if "모던" or "근접" is in the report
    sys.stdout.reconfigure(encoding='utf-8')
    if "모던" in content:
        print("Found '모던'")
        # print matching lines
        for line in content.split('\n'):
            if "모던" in line:
                print(line)
    else:
        print("'모던' not found")
else:
    print("Report not found")
