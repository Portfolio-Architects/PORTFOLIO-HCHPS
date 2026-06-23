import json
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
log_path = r"C:\Users\user\.gemini\antigravity\brain\9a4baee2-b73b-4085-a276-29c86d3b46cb\.system_generated\logs\transcript_full.jsonl"

if os.path.exists(log_path):
    print("=== TRANSCRIPT FOR 9a4baee2-b73b-4085-a276-29c86d3b46cb ===")
    with open(log_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                obj = json.loads(line)
            except Exception:
                continue
            step_idx = obj.get('step_index')
            source = obj.get('source')
            type_ = obj.get('type')
            content = obj.get('content', '')
            
            if source == 'USER_EXPLICIT' or type_ == 'USER_INPUT':
                print(f"Step {step_idx} | User Request:")
                print(content[:500])
                print("-" * 40)
            elif source == 'MODEL' and type_ == 'PLANNER_RESPONSE':
                print(f"Step {step_idx} | Model Output:")
                print(content[:500])
                print("-" * 40)
else:
    print("Transcript not found")
