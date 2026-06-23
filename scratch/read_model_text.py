import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
log_path = r"C:\Users\user\.gemini\antigravity\brain\05a6beb4-b68a-4abe-b884-18e2496bc40b\.system_generated\logs\transcript_full.jsonl"

steps_to_read = [21, 22, 23, 73, 74, 75, 102, 103, 104, 118, 119, 120, 134, 135, 136, 190, 191, 192]

with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            obj = json.loads(line)
        except Exception:
            continue
        step_index = obj.get('step_index')
        if step_index in steps_to_read:
            print(f"=== Step {step_index} | Source: {obj.get('source')} | Type: {obj.get('type')} ===")
            content = obj.get('content', '')
            print(content[:3000])
            print("-" * 80)
