import json
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
log_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\.system_generated\logs\transcript.jsonl"

if os.path.exists(log_path):
    print("=== TRANSCRIPT FOR d05a464b-fea6-416e-b3aa-d924b8ee9a5e ===")
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
                print(f"Step {step_idx} | Source: {source} | Type: {type_}")
                print(content[:1500])
                print("-" * 80)
else:
    print("Transcript not found")
