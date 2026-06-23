import json
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
log_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\.system_generated\logs\transcript_full.jsonl"

if os.path.exists(log_path):
    print("=== TRANSCRIPT STEPS FROM 500 TO END ===")
    with open(log_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                obj = json.loads(line)
            except Exception:
                continue
            step_idx = obj.get('step_index')
            if step_idx >= 500:
                source = obj.get('source')
                type_ = obj.get('type')
                print(f"Step {step_idx} | Source: {source} | Type: {type_}")
                content = obj.get('content', '')
                if source == 'MODEL' and type_ == 'PLANNER_RESPONSE':
                    # Extract the response text
                    print(content[:1500])
                    print("="*40)
                elif source == 'USER_EXPLICIT' or type_ == 'USER_INPUT':
                    print("User Request:", content[:500])
                    print("="*40)
else:
    print("Transcript not found")
