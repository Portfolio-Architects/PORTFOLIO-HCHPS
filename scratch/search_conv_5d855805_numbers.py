import os
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
log_file = r"C:\Users\user\.gemini\antigravity\brain\5d855805-4f15-491f-ad73-2701c6b1a755\.system_generated\logs\transcript.jsonl"

print("Searching transcript.jsonl of 5d855805-4f15-491f-ad73-2701c6b1a755 for numbers...")

with open(log_file, 'r', encoding='utf-8') as f:
    for line in f:
        obj = json.loads(line)
        content = obj.get('content', '')
        calls = str(obj.get('tool_calls', ''))
        step_idx = obj.get('step_index')
        
        if '10.2' in content or '127/82' in content or '48도' in content or 'CVA' in content or '골반 경사' in content:
            # We want to see where these values first appeared or if they were read from a file!
            print(f"Match in Step {step_idx} | Source: {obj.get('source')} | Type: {obj.get('type')}")
            if obj.get('source') == 'SYSTEM':
                print(content[:1000])
                print("=" * 80)
            elif obj.get('type') == 'USER_INPUT':
                print(content[:1000])
                print("=" * 80)
            elif 'view_file' in calls or 'read_file' in calls or 'run_command' in calls:
                print("  Tool call:", calls[:500])
                print("=" * 80)
