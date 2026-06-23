import os
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
log_file = r"C:\Users\user\.gemini\antigravity\brain\6cca3b74-37ae-4bb0-850d-c939ea94ed66\.system_generated\logs\transcript.jsonl"

with open(log_file, 'r', encoding='utf-8') as f:
    for line in f:
        obj = json.loads(line)
        if obj.get('step_index') == 340:
            print("Step 340 detail:")
            print(json.dumps(obj, indent=2, ensure_ascii=False))
            break
        # also print if we have tool_calls in 341
        if obj.get('step_index') == 341:
            print("Step 341 tool calls:")
            print(json.dumps(obj.get('tool_calls'), indent=2, ensure_ascii=False))
