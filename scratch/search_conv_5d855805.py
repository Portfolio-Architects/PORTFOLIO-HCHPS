import os
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
log_file = r"C:\Users\user\.gemini\antigravity\brain\5d855805-4f15-491f-ad73-2701c6b1a755\.system_generated\logs\transcript.jsonl"

print("Searching transcript.jsonl of 5d855805-4f15-491f-ad73-2701c6b1a755...")

with open(log_file, 'r', encoding='utf-8') as f:
    for line in f:
        obj = json.loads(line)
        content = obj.get('content', '')
        calls = str(obj.get('tool_calls', ''))
        step_idx = obj.get('step_index')
        
        # We want to see where "김광숙" first appeared in this conversation!
        if '김광숙' in content or '김광숙' in calls:
            print(f"Match in Step {step_idx} | Source: {obj.get('source')} | Type: {obj.get('type')}")
            # If it's a SYSTEM response (meaning it's output from a tool call), print it
            if obj.get('source') == 'SYSTEM':
                print(content[:1000])
                print("=" * 80)
            # If it's a USER_INPUT, print it
            elif obj.get('type') == 'USER_INPUT':
                print(content[:1000])
                print("=" * 80)
            elif 'view_file' in calls or 'read_file' in calls or 'run_command' in calls:
                print("  Tool call:", calls[:500])
                print("=" * 80)
