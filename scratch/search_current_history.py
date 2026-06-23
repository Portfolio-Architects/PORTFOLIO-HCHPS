import json
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
log_path = r"C:\Users\user\.gemini\antigravity\brain\05a6beb4-b68a-4abe-b884-18e2496bc40b\.system_generated\logs\transcript.jsonl"

if os.path.exists(log_path):
    with open(log_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                obj = json.loads(line)
            except Exception:
                continue
            content = obj.get('content', '')
            step_idx = obj.get('step_index')
            source = obj.get('source')
            type_ = obj.get('type')
            
            if source == 'USER_EXPLICIT' or type_ == 'USER_INPUT':
                print(f"=== Step {step_idx} | Source: {source} | Type: {type_} ===")
                print(content)
                print("-" * 80)
else:
    print("Transcript not found")
