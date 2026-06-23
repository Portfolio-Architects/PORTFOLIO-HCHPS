import os
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
log_file = r"C:\Users\user\.gemini\antigravity\brain\5d855805-4f15-491f-ad73-2701c6b1a755\.system_generated\logs\transcript.jsonl"

print("Searching steps 350 to 623 for target values...")

targets = ['127/82', '48도', '24.9', '10.2']

with open(log_file, 'r', encoding='utf-8') as f:
    for line in f:
        obj = json.loads(line)
        idx = obj.get('step_index')
        if idx is not None and idx >= 350 and idx <= 623:
            content = obj.get('content', '')
            calls = str(obj.get('tool_calls', ''))
            
            found = [t for t in targets if t in content or t in calls]
            if found:
                print(f"Match in Step {idx} | Source: {obj.get('source')} | Type: {obj.get('type')} | Matches: {found}")
                if obj.get('source') == 'SYSTEM':
                    print("  SYSTEM Content:")
                    print(content[:1500])
                    print("=" * 80)
                else:
                    print("  Content:")
                    print(content[:1000])
                    print("=" * 80)
