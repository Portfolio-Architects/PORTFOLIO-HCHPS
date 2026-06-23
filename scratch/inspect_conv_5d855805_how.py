import os
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
log_file = r"C:\Users\user\.gemini\antigravity\brain\5d855805-4f15-491f-ad73-2701c6b1a755\.system_generated\logs\transcript.jsonl"

print("Finding first occurrence of '48도' in conversation 5d855805...")

with open(log_file, 'r', encoding='utf-8') as f:
    for line in f:
        obj = json.loads(line)
        content = obj.get('content', '')
        calls = str(obj.get('tool_calls', ''))
        step_idx = obj.get('step_index')
        
        if '48도' in content or '48도' in calls:
            print(f"Occurrence in Step {step_idx} | Source: {obj.get('source')} | Type: {obj.get('type')}")
            if obj.get('source') == 'SYSTEM':
                print(content[:1500])
            else:
                print(content[:1000])
            print("=" * 80)
            break

