import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
log_path = r"C:\Users\user\.gemini\antigravity\brain\2d43b048-e79a-4eb1-b2d4-ce407ad1d197\.system_generated\logs\transcript.jsonl"

print("Searching conversation 2d43b048-e79a-4eb1-b2d4-ce407ad1d197 transcript...")

keywords = ['체질량지수', 'CVA', '머리척추각', '수축기', '이완기', '체형불균형', '검진결과설명서']

with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            obj = json.loads(line)
        except Exception:
            continue
        content = obj.get('content', '')
        calls = str(obj.get('tool_calls', ''))
        step_idx = obj.get('step_index')
        source = obj.get('source')
        type_ = obj.get('type')
        
        found = [kw for kw in keywords if kw in content or kw in calls]
        if found:
            print(f"=== Step {step_idx} | Source: {source} | Type: {type_} | KWs: {found} ===")
            print(content[:1500])
            print("-" * 80)
