import os
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
log_file = r"C:\Users\user\.gemini\antigravity\brain\5d855805-4f15-491f-ad73-2701c6b1a755\.system_generated\logs\transcript.jsonl"

print("Searching transcript.jsonl of 5d855805-4f15-491f-ad73-2701c6b1a755 for PDF reading...")

with open(log_file, 'r', encoding='utf-8') as f:
    for line in f:
        obj = json.loads(line)
        content = obj.get('content', '')
        calls = str(obj.get('tool_calls', ''))
        step_idx = obj.get('step_index')
        
        # We search for view_file or read_file or run_command where the command lists or views pdf files
        if obj.get('source') == 'SYSTEM' and ('pdf' in calls or 'pdf' in content or 'pdf_text' in content):
            if any(kw in content for kw in ['체질량지수', 'CVA', '수축기', '이완기']):
                print(f"=== SYSTEM Step {step_idx} ===")
                print(content[:2000])
                print("-" * 80)
        elif obj.get('source') == 'MODEL' and ('pdf' in calls or 'pdf' in content):
            if 'view_file' in calls or 'run_command' in calls:
                print(f"=== MODEL Step {step_idx} ===")
                print("Calls:", calls)
                print("Content:", content[:500])
                print("-" * 80)
