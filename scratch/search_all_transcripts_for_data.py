import os
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
brain_dir = r"C:\Users\user\.gemini\antigravity\brain"

print("Searching all transcripts for clinical data contents...")

keywords = ['체질량지수', 'CVA', '머리척추각', '수축기', '이완기']

for folder in os.listdir(brain_dir):
    folder_path = os.path.join(brain_dir, folder)
    if not os.path.isdir(folder_path):
        continue
    log_file = os.path.join(folder_path, ".system_generated", "logs", "transcript.jsonl")
    if os.path.exists(log_file):
        try:
            with open(log_file, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f):
                    obj = json.loads(line)
                    content = obj.get('content', '')
                    calls = str(obj.get('tool_calls', ''))
                    step_idx = obj.get('step_index')
                    
                    found = [kw for kw in keywords if kw in content or kw in calls]
                    if len(found) >= 3:
                        # Print step and first 1000 chars of content
                        print(f"=== Conv: {folder} | Step: {step_idx} | KWs: {found} ===")
                        print(content[:1500])
                        print("=" * 80)
        except Exception as e:
            pass
