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
        source = obj.get('source')
        type_ = obj.get('type')
        content = obj.get('content', '')
        
        # Print a short summary of each step
        print(f"Step {step_index:3d} | Source: {source:15s} | Type: {type_:20s} | Content preview: {content[:100].strip()}")
