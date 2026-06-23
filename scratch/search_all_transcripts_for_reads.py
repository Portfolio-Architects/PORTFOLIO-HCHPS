import os
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
brain_dir = r"C:\Users\user\.gemini\antigravity\brain"

print("Searching all transcripts for occurrences of '검진결과설명서'...")

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
                    
                    if '검진결과설명서' in content or '검진결과설명서' in calls:
                        print(f"=== Conv: {folder} | Step: {step_idx} | Type: {obj.get('type')} ===")
                        # Print what tool was called and if there is a response
                        if 'view_file' in calls or 'read_file' in calls or 'run_command' in calls:
                            print(f"  Tool Call: {calls[:300]}")
                        # If there is content containing clinical keywords, print it!
                        if any(kw in content for kw in ['체질량지수', 'CVA', '수축기', '이완기']):
                            print(content[:1000])
                            print("..." if len(content) > 1000 else "")
                        else:
                            print(f"  Snippet: {content[:300]}")
                        print("=" * 80)
        except Exception as e:
            pass
