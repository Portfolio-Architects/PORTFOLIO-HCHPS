import os
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
brain_dir = r"C:\Users\user\.gemini\antigravity\brain"

print("Searching all transcripts for target files...")

targets = ['검진결과설명서', '체형불균형.csv']

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
                    
                    found = [t for t in targets if t in content or t in calls]
                    if found:
                        print(f"Match in Conv: {folder} | Step: {obj.get('step_index')} | Targets: {found}")
                        # Print surrounding text
                        lines = content.split('\n')
                        for line in lines:
                            if any(t in line for t in targets):
                                print("  Line:", line.strip())
        except Exception as e:
            print(f"Error reading {log_file}: {e}")
