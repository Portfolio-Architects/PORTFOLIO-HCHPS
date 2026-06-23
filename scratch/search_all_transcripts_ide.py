import os
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
keywords = ['체질량지수', 'CVA', '머리척추각', '수축기', '이완기']

search_paths = [
    r"C:\Users\user\.gemini\antigravity\brain",
    r"C:\Users\user\.gemini\antigravity-ide\brain"
]

print("Searching all conversation transcripts in both paths...")

for base_dir in search_paths:
    if not os.path.exists(base_dir):
        continue
    for folder in os.listdir(base_dir):
        folder_path = os.path.join(base_dir, folder)
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
                        found_kws = [kw for kw in keywords if kw in content or kw in calls]
                        if found_kws:
                            if folder == '5d855805-4f15-491f-ad73-2701c6b1a755':
                                continue
                            print(f"Match in {os.path.basename(base_dir)}/{folder} | Step {obj.get('step_index')} | KWs: {found_kws}")
                            print(content[:500])
                            print("=" * 80)
            except Exception as e:
                print(f"Error reading {log_file}: {e}")
