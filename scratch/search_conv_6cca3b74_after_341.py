import os
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
log_file = r"C:\Users\user\.gemini\antigravity\brain\6cca3b74-37ae-4bb0-850d-c939ea94ed66\.system_generated\logs\transcript.jsonl"

print("Searching transcript.jsonl of 6cca3b74-37ae-4bb0-850d-c939ea94ed66 for PDF actions...")

with open(log_file, 'r', encoding='utf-8') as f:
    for line in f:
        obj = json.loads(line)
        idx = obj.get('step_index')
        content = obj.get('content', '')
        calls = str(obj.get('tool_calls', ''))
        
        # Search for '검진결과설명서' or 'view_file' with '.pdf' or '검진'
        if '검진' in content or '검진' in calls or 'view_file' in calls or 'pdf' in calls.lower():
            print(f"Match in Step {idx} | Source: {obj.get('source')} | Type: {obj.get('type')}")
            if 'view_file' in calls or 'run_command' in calls:
                print("  Tool call:", calls[:500])
            if '김광숙' in content or '체질량' in content or 'CVA' in content or '허리' in content:
                print("  Content snippet:", content[:1000])
            print("=" * 80)

