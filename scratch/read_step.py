import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
log_path = r"C:\Users\user\.gemini\antigravity\brain\5d855805-4f15-491f-ad73-2701c6b1a755\.system_generated\logs\transcript.jsonl"

with open(log_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")
# Print details of the last 15 lines
for i in range(max(0, len(lines) - 15), len(lines)):
    obj = json.loads(lines[i])
    step_index = obj.get('step_index')
    source = obj.get('source')
    type_ = obj.get('type')
    print(f"=== Index {i} | Step {step_index} | Source: {source} | Type: {type_} ===")
    content = obj.get('content', '')
    if source == 'MODEL' and type_ in ['PLANNER_RESPONSE', 'FINAL_RESPONSE']:
        print(content)
        print("-" * 80)

