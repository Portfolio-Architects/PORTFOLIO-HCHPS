import os
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
log_file = r"C:\Users\user\.gemini\antigravity\brain\6cca3b74-37ae-4bb0-850d-c939ea94ed66\.system_generated\logs\transcript.jsonl"

print("Searching transcript.jsonl for reading of 검진결과설명서...")

with open(log_file, 'r', encoding='utf-8') as f:
    for line in f:
        obj = json.loads(line)
        content = obj.get('content', '')
        calls = str(obj.get('tool_calls', ''))
        step_idx = obj.get('step_index')
        
        if '검진결과설명서' in content or '검진결과설명서' in calls or '체형불균형' in content or '체형불균형' in calls:
            # Check if this step is a tool response (source SYSTEM) and has actual file contents.
            # Usually tool response of view_file has the file contents in obj['content']
            if obj.get('source') == 'SYSTEM' and ('체질량지수' in content or 'CVA' in content or '허리둘레' in content or '혈압' in content):
                print(f"=== Found file content in Step {step_idx} (SYSTEM) ===")
                print(content[:3000])
                print("-" * 80)
            elif obj.get('source') == 'MODEL' and ('체질량지수' in content or 'CVA' in content or '허리둘레' in content or '혈압' in content):
                print(f"=== Found analysis in Step {step_idx} (MODEL) ===")
                print(content[:2000])
                print("-" * 80)
