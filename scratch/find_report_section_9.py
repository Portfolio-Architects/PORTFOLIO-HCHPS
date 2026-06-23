import os

report_path = "PORTFOLIO VITAL - Engineering Report.md"
if os.path.exists(report_path):
    with open(report_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for idx, line in enumerate(lines):
        if "## 9. 감사 기반 로드맵 및 전략적 지평" in line:
            print(f"Line number: {idx + 1}")
else:
    print("Report not found")
