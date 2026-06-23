import json
import os

log_path = r"C:\Users\user\.gemini\antigravity\brain\dbbcf3b5-5dff-4f67-94b8-29398591f073\.system_generated\logs\transcript.jsonl"

with open(log_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")

# We will scan from the start of transcript.jsonl to find the latest VIEW_FILE tool result
# that contains a large part of PortfolioDashboardView.tsx BEFORE our current turn's git checkout (which happened near the end).
# Actually, the user requests 8) "이 부분 텍스트 크기 몇이야?" 이전에 이미 2열 분리 등의 모든 5/28 기능들이 다 적용되어 있었다.
# So we can search for a VIEW_FILE tool result (response) that contains the full file (Total Lines: 937 or similar) 
# and has "extractSplitFormulaFromNote" or "completedFormula".

found_contents = []

for idx, line in enumerate(lines):
    try:
        data = json.loads(line)
        content = data.get('content', '')
        if 'File Path: `file:///d:/Desktop/PORTFOLIO/PORTFOLIO%20-%20VITAL/src/components/dashboard/PortfolioDashboardView.tsx`' in content:
            if 'extractSplitFormulaFromNote' in content:
                # Count lines of the file in the log
                lines_in_content = [l for l in content.split('\n') if l.strip()]
                print(f"Found match at log line {idx}, length: {len(content)}, file lines count: {len(lines_in_content)}")
                found_contents.append((idx, content))
    except Exception as e:
        pass

# Save the latest one which contains the most complete file representation
if found_contents:
    # Pick the one with the maximum length or highest index before our checkout step
    # Our checkout step is near the end, so let's pick the one just before the checkout.
    # The checkout step happened at the very end of our current run, so the one with the largest index should be our latest good copy.
    idx, content = found_contents[-1]
    print(f"Dumping the best match from log line {idx}")
    with open("scratch/recovered_portfolio_view_full.txt", "w", encoding="utf-8") as out:
        out.write(content)
else:
    print("No complete match found with extractSplitFormulaFromNote")
