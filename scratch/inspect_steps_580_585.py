import os
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
log_file = r"C:\Users\user\.gemini\antigravity\brain\5d855805-4f15-491f-ad73-2701c6b1a755\.system_generated\logs\transcript.jsonl"

with open(log_file, 'r', encoding='utf-8') as f:
    for line in f:
        obj = json.loads(line)
        idx = obj.get('step_index')
        if idx in range(576, 590):
            print(f"=== Step {idx} | Source: {obj.get('source')} | Type: {obj.get('type')} ===")
            print("Content:", obj.get('content', '')[:1000])
            print("Tool calls:", obj.get('tool_calls'))
            print("-" * 80)
