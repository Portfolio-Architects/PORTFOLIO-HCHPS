import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
log_path = r"C:\Users\user\.gemini\antigravity\brain\05a6beb4-b68a-4abe-b884-18e2496bc40b\.system_generated\logs\transcript_full.jsonl"

with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            obj = json.loads(line)
        except Exception:
            continue
        step_index = obj.get('step_index')
        if step_index in [71, 72, 73]:
            print(f"=== Step {step_index} ===")
            print(obj.get('content', '')[:2000])
            print(str(obj.get('tool_calls', ''))[:1000])
            print("-" * 80)
