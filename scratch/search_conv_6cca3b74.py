import os
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
log_file = r"C:\Users\user\.gemini\antigravity\brain\6cca3b74-37ae-4bb0-850d-c939ea94ed66\.system_generated\logs\transcript.jsonl"

print("Searching transcript.jsonl of 6cca3b74-37ae-4bb0-850d-c939ea94ed66 for '검진결과설명서'...")

if not os.path.exists(log_file):
    print("File not found:", log_file)
    sys.exit(1)

with open(log_file, 'r', encoding='utf-8') as f:
    for line in f:
        obj = json.loads(line)
        content = obj.get('content', '')
        calls = str(obj.get('tool_calls', ''))
        step = obj.get('step_index')
        
        if '검진결과설명서' in content or '검진결과설명서' in calls:
            print(f"Match in Step {step} | Source: {obj.get('source')} | Type: {obj.get('type')}")
            if 'view_file' in calls or 'read_file' in calls or 'run_command' in calls:
                print("  Tool Call:", calls[:500])
            print("  Content snippet:", content[:1000])
            print("-" * 80)

