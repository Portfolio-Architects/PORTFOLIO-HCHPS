import os
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
log_file = r"C:\Users\user\.gemini\antigravity\brain\5d855805-4f15-491f-ad73-2701c6b1a755\.system_generated\logs\transcript.jsonl"

with open(log_file, 'r', encoding='utf-8') as f:
    for line in f:
        obj = json.loads(line)
        idx = obj.get('step_index')
        if idx == 355:
            print("Step 355 SYSTEM output:")
            print(json.dumps(obj, indent=2, ensure_ascii=False))
            break
