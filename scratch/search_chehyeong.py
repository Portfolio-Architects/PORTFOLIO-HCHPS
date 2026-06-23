import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
log_path = r"C:\Users\user\.gemini\antigravity\brain\5d855805-4f15-491f-ad73-2701c6b1a755\.system_generated\logs\transcript.jsonl"

print("Searching transcript.jsonl for '체형불균형'...")

with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            obj = json.loads(line)
        except Exception:
            continue
        content = obj.get('content', '')
        calls = str(obj.get('tool_calls', ''))
        step_idx = obj.get('step_index')
        
        if '체형불균형' in content or '체형불균형' in calls:
            # Check if this is a model response or user input or system message
            source = obj.get('source')
            type_ = obj.get('type')
            
            # Print steps that might contain the actual files or data.
            # Especially we want to find if the model read any file contents or if there was an artifact or if it executed something.
            if source == 'MODEL' and type_ == 'PLANNER_RESPONSE':
                # Check if it has a large content or describes what it found
                print(f"=== Step {step_idx} | Source: {source} | Type: {type_} ===")
                print(content[:1000])
                print("-" * 80)
            elif source == 'SYSTEM' or type_ == 'RUN_COMMAND':
                print(f"=== Step {step_idx} | Source: {source} | Type: {type_} ===")
                print(content[:1000])
                print("-" * 80)
